import { useState, useEffect } from "react";

const HISTORY_KEY = "barcode-history";
const MAX_HISTORY = 3;

export interface BarcodeHistoryItem {
  code: string;
  timestamp: number;
}

export const useBarcodeHistory = () => {
  const [history, setHistory] = useState<BarcodeHistoryItem[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch (error) {
        console.error("Error loading history:", error);
      }
    }
  }, []);

  const addToHistory = (code: string) => {
    const newItem: BarcodeHistoryItem = {
      code,
      timestamp: Date.now(),
    };

    setHistory((prev) => {
      // Remove duplicates and add new item at the start
      const filtered = prev.filter((item) => item.code !== code);
      const newHistory = [newItem, ...filtered].slice(0, MAX_HISTORY);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  return { history, addToHistory, clearHistory };
};
