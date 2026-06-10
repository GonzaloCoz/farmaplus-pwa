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
    // We expect { messages: Array<{role: string, content: string}>, branchName: string }
    const { messages, branchName } = await req.json()
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid or empty messages history' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 1. Fetch branch stats from Supabase to enrich the context
    let contextEnrichment = `No se encontró información del inventario de la sucursal ${branchName || 'desconocida'}.`
    
    if (branchName) {
      // Fetch branch context using the optimized RPC function
      const { data: c, error: contextError } = await supabaseClient
        .rpc('get_branch_ai_context', { p_branch_name: branchName })

      if (contextError) {
        console.error('Error fetching branch AI context RPC:', contextError)
      } else if (c) {
        const pendingPercent = 100 - (c.progress_percent || 0);
        const maxFalt = c.max_faltante || {};
        const maxSobr = c.max_sobrante || {};

        const activeLabs = (c.active_labs_list || '')
          .split('\n')
          .filter((l: string) => l.trim())
          // Deduplicate by exact line content
          .filter((l: string, i: number, arr: string[]) => arr.indexOf(l) === i)
          .slice(0, 3)
          .join('\n')

        contextEnrichment = `
[Ficha Sucursal: ${branchName}]
- Labs: ${c.total_labs || 0} (OK: ${c.completed_labs || 0}, En Progreso: ${c.in_progress_labs || 0}, Pendientes: ${c.pending_labs || 0})
- Avance: ${c.progress_percent || 0}% controlado (faltan ${pendingPercent}% de laboratorios)
- Conteo Hoy: ${c.items_controlled_today || 0} items controlados hoy
- Diferencia Monetaria Neta: $${(c.net_value || 0).toFixed(2)} | Desvio Absoluto: $${(c.abs_value || 0).toFixed(2)} | Productos con diferencia: ${c.discrepant_count || 0}
${activeLabs ? `- Labs en progreso:\n${activeLabs}` : ''}
${maxFalt.value < 0 ? `- Mayor Faltante: ${maxFalt.name} ($${Math.abs(maxFalt.value).toFixed(2)}, ${maxFalt.units}u, Lab: ${maxFalt.lab})` : ''}
${maxSobr.value > 0 ? `- Mayor Sobrante: ${maxSobr.name} ($${maxSobr.value.toFixed(2)}, +${maxSobr.units}u, Lab: ${maxSobr.lab})` : ''}
`
      }

      // 2. Fetch active expiration control sessions for this branch
      const { data: expSessions, error: expError } = await supabaseClient
        .from('expiration_sessions')
        .select('id, sector, status, total_products, total_units')
        .eq('branch_name', branchName)
        .eq('status', 'active')

      if (expError) {
        console.error('Error fetching expiration sessions:', expError)
      } else if (expSessions && expSessions.length > 0) {
        const sessionDetails = expSessions.map(s => `- Sector "${s.sector}": ${s.total_products} productos registrados (${s.total_units} unidades totales)`).join('\n')
        contextEnrichment += `\nSESIONES DE CONTROL DE VENCIMIENTOS ACTIVAS:\n${sessionDetails}\n`
      }
    }

    // 3. Fetch matching help articles from database (RAG)
    let helpContext = ''
    const latestMessage = messages[messages.length - 1]
    const userQuery = latestMessage && latestMessage.role === 'user' ? latestMessage.content : ''

    if (userQuery) {
      const { data: helpArticles, error: helpError } = await supabaseClient
        .rpc('search_help_articles', { p_query: userQuery })

      if (helpError) {
        console.error('Error fetching help articles RPC:', helpError)
      } else if (helpArticles && helpArticles.length > 0) {
        const articlesList = helpArticles.map((a: any) => 
          `[Artículo: ${a.title}]\n${a.content}\nAcción recomendada si te pregunta por esto:\nACTIONS:${JSON.stringify([a.suggested_action])}`
        ).join('\n\n')
        helpContext = `\nPROCEDIMIENTOS INTERNOS Y SOPORTE DEL SISTEMA:\n${articlesList}\n`
      }
    }

    // 4. Define System Prompt with instructions and context
    const systemPrompt = `Eres el asistente de soporte e inventarios del sistema. Ayudas a los operarios y administradores de las sucursales a realizar el inventario cíclico, control de vencimiento y auditoría de stock.

INFORMACIÓN DEL DOMINIO DEL SISTEMA:
- Inventario cíclico: control periódico de stock por laboratorio (ej: BAGÓ, ROEMMERS, BAYER).
- Control de vencimientos: control de lotes y fechas de caducidad. Semáforo: Rojo (<3 meses), Amarillo (3-6 meses).
- Diferencias de stock: unidades faltantes (negativo) o sobrantes (positivo). Se audita tras el re-control físico.
- Proceso: Conteo físico -> Carga en aplicación -> Revisar Diferencias -> Finalizar Laboratorio (Ajuste).

${contextEnrichment}
${helpContext}

REGLAS DE RESPUESTA:
1. Responde SIEMPRE en español rioplatense (sé amigable, usa "vos", sé profesional).
2. Sé conciso y directo, ve al grano. Máximo 2 o 3 párrafos cortos.
3. Si el usuario te pregunta por procedimientos o dice tener problemas, dale 2-3 pasos de solución y ofrece un botón de acción rápida.
4. Al final de tu respuesta, si es relevante que el usuario vaya a una pantalla o inicie un chat, añade la sección ACTIONS en su propia línea EXACTAMENTE así:
ACTIONS:[{"label": "Texto del Botón", "route": "/cyclic-inventory", "type": "navigate"}]
O para soporte/Teams:
ACTIONS:[{"label": "Enviar Alerta por Teams", "target": "Hola, necesito asistencia con...", "type": "teams"}]

Tipos de acciones:
- "navigate": redirige dentro de la aplicación. Rutas válidas: "/cyclic-inventory" (laboratorios), "/stock/expiration-control" (vencimientos), "/reports" (reportes/dashboard).
- "teams": abre un chat de Teams pre-cargado con un mensaje.

5. IMPORTANTE: Si la sección 'PROCEDIMIENTOS INTERNOS Y SOPORTE DEL SISTEMA' contiene información relevante, basá tu respuesta en ella y añadí EXACTAMENTE la acción recomendada de ese procedimiento al final de tu respuesta (en la sección ACTIONS).

Ejemplo de salida con acción:
...
Espero que te sirva. Cualquier otra duda con el laboratorio me avisás.
ACTIONS:[{"label":"Ir a Inventarios","route":"/cyclic-inventory","type":"navigate"},{"label":"Reportar Diferencia por Teams","target":"Hola, detecté diferencias en el laboratorio...","type":"teams"}]

*IMPORTANTE*: La línea ACTIONS debe ir exactamente formateada al final, sin puntos ni texto después.`

    // 5. Call Ollama server
    const ollamaUrl = Deno.env.get('OLLAMA_URL') ?? 'http://172.18.0.1:11434/api/chat'
    const ollamaApiKey = Deno.env.get('OLLAMA_API_KEY') ?? 'CLAVE_SECRETA_INTERNA'
    const ollamaModel = Deno.env.get('OLLAMA_MODEL') ?? 'qwen2.5:3b'

    const chatPayload = {
      model: ollamaModel,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      stream: true,
      keep_alive: '30m',
      options: {
        temperature: 0.1,
        num_ctx: 4096,
        num_thread: 4
      }
    }

    console.log(`Forwarding chat request to self-hosted Ollama (${ollamaModel}): ${ollamaUrl}`)

    // Use AbortController to set a timeout on the Ollama connection
    // We set it to 60 seconds to allow the VPS enough time to load the model on cold start
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      console.error(`Ollama request timed out after 60 seconds. Url: ${ollamaUrl}`)
      controller.abort()
    }, 60000)

    let ollamaResponse;
    try {
      ollamaResponse = await fetch(ollamaUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': ollamaApiKey
        },
        body: JSON.stringify(chatPayload),
        signal: controller.signal
      })
    } catch (fetchErr) {
      const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
      console.error(`Failed to fetch Ollama at ${ollamaUrl}:`, errMsg)
      return new Response(JSON.stringify({ 
        error: 'Ollama service is unreachable or request timed out', 
        details: errMsg,
        suggestion: 'Verify Ollama is running and OLLAMA_URL is correct in your VPS configuration.'
      }), {
        status: 504,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } finally {
      clearTimeout(timeoutId)
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
              try {
                const parsed = JSON.parse(line)
                if (parsed.message?.content) {
                  controller.enqueue(textEncoder.encode(parsed.message.content))
                }
              } catch (e) {
                // Line might be incomplete or not JSON, skip/log
                console.warn('Failed parsing stream line:', line, e)
              }
            }
          }

          // Flush remaining buffer
          if (buffer.trim()) {
            try {
              const parsed = JSON.parse(buffer)
              if (parsed.message?.content) {
                controller.enqueue(textEncoder.encode(parsed.message.content))
              }
            } catch (e) {
              console.warn('Failed parsing final stream buffer:', buffer, e)
            }
          }
        } catch (err) {
          console.error('Error reading Ollama stream:', err)
          controller.error(err)
        } finally {
          controller.close()
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
