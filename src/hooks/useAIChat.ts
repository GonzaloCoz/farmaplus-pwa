import { useState, useRef, useEffect, useCallback } from "react";
import { aiChatService, ChatMessage, AIAction } from "@/services/aiChatService";

export function useAIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // streamedText is the raw text arriving from the server
  const [streamedText, setStreamedText] = useState("");
  
  // displayedText is what the user actually sees (typing effect)
  const [displayedText, setDisplayedText] = useState("");
  
  const [actions, setActions] = useState<AIAction[]>([]);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const rawStreamRef = useRef("");
  const isTypingRef = useRef(false);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const abortChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    isTypingRef.current = false;
  }, []);

  const resetChat = useCallback(() => {
    abortChat();
    setMessages([]);
    setStreamedText("");
    setDisplayedText("");
    setActions([]);
    setError(null);
  }, [abortChat]);

  // Smooth typing effect effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let delayTimer: NodeJS.Timeout;

    if (isGenerating) {
      // Start with empty displayed text to show "Pensando..."
      setDisplayedText("");
      
      // Wait a tiny moment to accumulate a small initial buffer
      delayTimer = setTimeout(() => {
        isTypingRef.current = true;
        
        interval = setInterval(() => {
          setDisplayedText((current) => {
            const target = rawStreamRef.current;
            if (current.length < target.length) {
              // Type faster: 4 chars every 15ms (~260 chars/sec)
              // This is very responsive and prevents lagging behind fast LLMs
              return target.slice(0, current.length + 4);
            }
            return current;
          });
        }, 15);
      }, 150);
      
    } else {
      isTypingRef.current = false;
    }

    return () => {
      clearTimeout(delayTimer);
      clearInterval(interval);
    };
  }, [isGenerating]);

  const sendMessage = useCallback(
    async (query: string, branchName?: string | null) => {
      if (!query.trim()) return;

      abortChat();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setError(null);
      setIsGenerating(true);
      setStreamedText("");
      setDisplayedText("");
      setActions([]);
      rawStreamRef.current = "";

      const userMessage: ChatMessage = { role: "user", content: query };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);

      try {
        await aiChatService.streamChat({
          messages: updatedMessages,
          branchName,
          signal: controller.signal,
          onChunk: (chunk) => {
            rawStreamRef.current += chunk;
            setStreamedText(rawStreamRef.current); // mostly for debugging or dependency triggers
          },
          onComplete: (finalText, parsedActions) => {
            // We don't stop 'isGenerating' immediately if typing hasn't caught up.
            // But to keep it simple and robust: we can just snap to finish or fast forward.
            // Let's just snap to finish and append to history when network completes, 
            // the user gets the fast typing effect during generation, and instantly gets the rest.
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: finalText },
            ]);
            setActions(parsedActions);
            setStreamedText("");
            setDisplayedText("");
            rawStreamRef.current = "";
            setIsGenerating(false);
            abortControllerRef.current = null;
          },
          onError: (err) => {
            setError(err.message || "Error al generar la respuesta.");
            setIsGenerating(false);
            abortControllerRef.current = null;
          },
        });
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError(err.message || "Error inesperado en el chat.");
          setIsGenerating(false);
          abortControllerRef.current = null;
        }
      }
    },
    [messages, abortChat]
  );

  const injectProactiveMessage = useCallback(
    async (query: string, displayContent: string, branchName?: string | null) => {
      if (!query.trim()) return;

      abortChat();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setError(null);
      setIsGenerating(true);
      setStreamedText("");
      setDisplayedText("");
      setActions([]);
      rawStreamRef.current = "";

      const userMessage: ChatMessage = { 
        role: "user", 
        content: query,
        displayContent: displayContent
      };
      const updatedMessages = [userMessage];
      setMessages(updatedMessages);

      try {
        await aiChatService.streamChat({
          messages: updatedMessages,
          branchName,
          signal: controller.signal,
          onChunk: (chunk) => {
            rawStreamRef.current += chunk;
            setStreamedText(rawStreamRef.current);
          },
          onComplete: (finalText, parsedActions) => {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: finalText },
            ]);
            setActions(parsedActions);
            setStreamedText("");
            setDisplayedText("");
            rawStreamRef.current = "";
            setIsGenerating(false);
            abortControllerRef.current = null;
          },
          onError: (err) => {
            setError(err.message || "Error al generar la respuesta.");
            setIsGenerating(false);
            abortControllerRef.current = null;
          },
        });
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError(err.message || "Error inesperado en el chat.");
          setIsGenerating(false);
          abortControllerRef.current = null;
        }
      }
    },
    [abortChat]
  );

  return {
    messages,
    isGenerating,
    streamedText: displayedText, // We expose displayedText as streamedText so the UI doesn't need changes
    actions,
    error,
    sendMessage,
    injectProactiveMessage,
    resetChat,
    abortChat,
  };
}
