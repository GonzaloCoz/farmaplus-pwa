// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header provided' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Initialize Supabase Client with the user's JWT
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'https://supabase.halu.com.ar'
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Get the logged in user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized or invalid token', details: userError }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse the request body
    const { messages } = await req.json()
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid or empty messages history' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Define static system prompt with core Farmaplus application domain knowledge
    const systemPrompt = `Eres el asistente de soporte técnico e inventarios de Farmaplus PWA.
CONOCIMIENTO DEL SISTEMA:
1. Inventario Cíclico: Operarios cuentan productos por laboratorios (Bagó, Roemmers, etc.). Comparan físico vs sistema. Las discrepancias se auditan y se ajustan al pulsar "Finalizar Laboratorio".
2. Control de Vencimientos: Se registran lotes y fechas de caducidad. Semáforo: Rojo (<3 meses - retirar/promoción), Amarillo (3-6 meses), Verde (>6 meses).
3. Alertas Teams: Botón para enviar reportes de desvíos graves o soporte técnico directo a Casa Central.

INSTRUCCIONES DE RESPUESTA:
- Utiliza el "CONTEXTO DE LA SUCURSAL ACTUAL" provisto para dar respuestas específicas sobre el avance y diferencias de la sucursal del operario.
- Habla en español rioplatense (usa voseo: "venís", "tenés", "hacés"). Sé breve, directo y responde en máximo 2 párrafos cortos.`

    // Call Ollama server
    const ollamaUrl = Deno.env.get('OLLAMA_URL') ?? 'http://172.18.0.1:11434/api/chat'
    const ollamaApiKey = Deno.env.get('OLLAMA_API_KEY') ?? 'CLAVE_SECRETA_INTERNA'
    const ollamaModel = Deno.env.get('OLLAMA_MODEL') ?? 'qwen2.5:1.5b'

    console.log(`Forwarding chat request to self-hosted Ollama (${ollamaModel}): ${ollamaUrl}`)

    const chatPayload = {
      model: ollamaModel,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      stream: true,
      keep_alive: '60m',
      options: {
        temperature: 0.1,
        num_ctx: 2048
      }
    }

    let ollamaResponse;
    try {
      ollamaResponse = await fetch(ollamaUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': ollamaApiKey
        },
        body: JSON.stringify(chatPayload),
        signal: req.signal // Automatically abort Ollama fetch if client disconnects
      })
    } catch (fetchErr) {
      const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
      console.error(`Failed to fetch Ollama at ${ollamaUrl}:`, errMsg)
      return new Response(JSON.stringify({ 
        error: 'Ollama service is unreachable', 
        details: errMsg
      }), {
        status: 504,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!ollamaResponse.ok) {
      const errText = await ollamaResponse.text()
      console.error(`Ollama error response (${ollamaResponse.status}):`, errText)
      return new Response(JSON.stringify({ error: `Ollama service returned error: ${ollamaResponse.status}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Set up Deno Streaming Response
    const textDecoder = new TextDecoder()
    const textEncoder = new TextEncoder()
    let buffer = ''

    const stream = new ReadableStream({
      async start(controller) {
        const reader = ollamaResponse.body?.getReader()
        if (!reader) {
          controller.close()
          return
        }

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += textDecoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.trim() === '') continue
              
              let parsed;
              try {
                parsed = JSON.parse(line)
              } catch (e) {
                console.warn('Failed parsing stream line JSON:', line, e)
                continue
              }

              if (parsed.message?.content) {
                try {
                  controller.enqueue(textEncoder.encode(parsed.message.content))
                } catch (enqueueErr) {
                  console.log('Stream enqueue failed, client disconnected. Closing reader.')
                  reader.cancel()
                  return
                }
              }
            }
          }

          // Flush remaining buffer
          if (buffer.trim()) {
            let parsed;
            try {
              parsed = JSON.parse(buffer)
            } catch (e) {
              console.warn('Failed parsing final stream buffer JSON:', buffer, e)
              return
            }

            if (parsed.message?.content) {
              try {
                controller.enqueue(textEncoder.encode(parsed.message.content))
              } catch (enqueueErr) {
                console.log('Stream flush enqueue failed, client disconnected.')
              }
            }
          }
        } catch (err) {
          console.error('Error reading Ollama stream:', err)
          try {
            controller.error(err)
          } catch (_) {
            // Controller might be closed
          }
        } finally {
          try {
            controller.close()
          } catch (_) {
            // Controller might already be closed or errored
          }
        }
      }
    })

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })

  } catch (error) {
    console.error('Fatal Edge Function Error:', error)
    const errorDetails = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: errorDetails }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
