import { supabase } from "@/integrations/supabase/client";

export interface AIAction {
  label: string;
  route?: string;
  target?: string;
  type: 'navigate' | 'teams';
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  displayContent?: string;
}

export interface StreamChatOptions {
  messages: ChatMessage[];
  branchName?: string | null;
  onChunk: (chunk: string) => void;
  onComplete: (finalText: string, actions: AIAction[]) => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
}



/**
 * Parses action buttons from the end of the AI response.
 * Formato esperado: ACTIONS:[{"label":"...", "route":"...", "type":"navigate"}]
 */
export function parseActions(text: string): { cleanText: string; actions: AIAction[] } {
  // Regex más robusto: busca ACTIONS:[...] tolerando espacios, saltos de línea y bloques de código de markdown
  const actionsRegex = /ACTIONS:\s*(?:```(?:json)?)?(\[[\s\S]*?\])(?:```)?/i;
  const match = text.match(actionsRegex);
  
  if (match) {
    try {
      const actionsJson = match[1].trim();
      const actions = JSON.parse(actionsJson) as AIAction[];
      const cleanText = text.replace(actionsRegex, '').trim();
      return { cleanText, actions };
    } catch (e) {
      console.error("Failed to parse ACTIONS JSON from model response:", e, match[1]);
    }
  }
  
  return { cleanText: text, actions: [] };
}

/**
 * Helper: gets auth headers for the Edge Function.
 */
async function getEdgeFunctionConfig() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const token = session?.access_token;
  if (!token) {
    throw new Error("No hay una sesión activa de usuario. Iniciá sesión de nuevo.");
  }

  const supabaseUrl = (supabase as any).supabaseUrl || "https://supabase.halu.com.ar";
  const supabaseKey = (supabase as any).supabaseKey;
  const functionUrl = `${supabaseUrl}/functions/v1/ai-chat`;

  return {
    functionUrl,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "apikey": supabaseKey,
    },
  };
}

/**
 * Retry-aware fetch with exponential backoff.
 * Only retries on network errors or 5xx status codes (typical cold-start failures).
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Don't retry on 4xx (client errors), only on 5xx (server/cold-start)
      if (response.ok || response.status < 500) {
        return response;
      }

      // 5xx — worth retrying
      const errBody = await response.text().catch(() => "");
      const statusCode = response.status;
      lastError = new Error(`Error del servidor de chat: ${statusCode} — ${errBody}`);
      console.warn(`[ai-chat] Attempt ${attempt + 1}/${maxRetries + 1} failed (${statusCode}). Retrying...`);
    } catch (err: any) {
      // Network error / timeout
      if (err.name === 'AbortError') throw err; // Don't retry user-aborted requests
      lastError = err instanceof Error ? err : new Error(err?.message || 'Network error');
      console.warn(`[ai-chat] Attempt ${attempt + 1}/${maxRetries + 1} network error:`, err.message);
    }

    // Exponential backoff: 1s, 2s
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  throw lastError || new Error("Error desconocido al conectar con el chat");
}

export const aiChatService = {

  streamChat: async ({
    messages,
    branchName,
    onChunk,
    onComplete,
    onError,
    signal
  }: StreamChatOptions): Promise<void> => {
    try {
      // 1. Get auth config
      const { functionUrl, headers } = await getEdgeFunctionConfig();

      // 2. Fetch the Supabase Edge Function with automatic retry
      const response = await fetchWithRetry(
        functionUrl,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            messages,
            branchName: branchName || null
          }),
          signal,
        },
        2 // max 2 retries
      );

      // fetchWithRetry only returns on ok or 4xx; 5xx are thrown as errors
      // so here response is always valid but could be a 4xx we need to surface
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(errorData.error || `Error del servidor de chat: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("El servidor no devolvió un flujo de datos (response body is empty).");
      }



      // 3. Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulatedText = "";

      while (!done) {
        if (signal?.aborted) {
          reader.cancel();
          throw new Error("Request aborted");
        }

        const { value, done: readerDone } = await reader.read();
        done = readerDone;

        if (value) {
          const chunkText = decoder.decode(value, { stream: !done });
          accumulatedText += chunkText;
          onChunk(chunkText);
        }
      }

      // 4. Parse any actions from the finished accumulated response
      const { cleanText, actions } = parseActions(accumulatedText);
      onComplete(cleanText, actions);

    } catch (error: any) {
      if (error.name === 'AbortError' || error.message === 'Request aborted') {
        console.log("Chat stream was aborted by user/hook.");
        return;
      }
      console.error("aiChatService stream error:", error);
      onError(error instanceof Error ? error : new Error(error?.message || "Error desconocido al procesar el chat"));
    }
  }
};
