import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
};

export const normalizeString = (str: string): string => {
  return str
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
};

/**
 * Calculates a similarity score between two strings (0.0 to 1.0)
 * optimized for company/laboratory names that may have changed slightly.
 */
export function getStringSimilarity(str1: string, str2: string): number {
  const s1 = normalizeString(str1).toLowerCase();
  const s2 = normalizeString(str2).toLowerCase();
  
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  
  // Check if they start with the same first word (e.g., "GLAXO...")
  const w1 = s1.split(/[\s\-_]+/)[0];
  const w2 = s2.split(/[\s\-_]+/)[0];
  if (w1 && w2 && w1 === w2 && w1.length > 2) {
    return 0.85;
  }
  
  // Check if one contains the other entirely
  if (s1.includes(s2) || s2.includes(s1)) {
    // If it starts with the same characters, boost it
    if (s1.startsWith(s2) || s2.startsWith(s1)) {
      return 0.9;
    }
    return 0.8;
  }
  
  // Token-based matching
  const tokens1 = s1.split(/[\s\-_]+/).filter(t => t.length > 1);
  const tokens2 = s2.split(/[\s\-_]+/).filter(t => t.length > 1);
  
  if (tokens1.length === 0 || tokens2.length === 0) return 0;
  
  let matches = 0;
  for (const t1 of tokens1) {
    for (const t2 of tokens2) {
      if (t1 === t2 || t1.includes(t2) || t2.includes(t1)) {
        matches++;
        break;
      }
    }
  }
  
  return matches / Math.max(tokens1.length, tokens2.length);
}

