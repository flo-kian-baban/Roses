// Allergen and dietary words as customers read them, and the general allergy notice (Kian via the PM, 2026-10-12); the words and the
// notice live in allergens.json beside this file (the research tools and drill read the same file). The research drafts use only these
// allergen words, stored in items.notes.allergens in English; an owner's own word (typed in the admin) is shown as typed, in Persian too,
// unless it is one of these or one of the admin's suggested words (nuts, dairy, gluten). Server only (the public pages are plain HTML).
import type { Bi, Notes } from './types';
import words from './allergens.json';

export const ALLERGENS: { en: string; fa: string }[] = words.allergens;
const FA = new Map<string, string>([...words.allergens, ...words.ownerWords].map((a) => [a.en, a.fa]));
export const allergenFa = (word: string): string => FA.get(word.trim().toLowerCase()) ?? word;
const DIETARY_FA = new Map<string, string>(words.dietary.map((d) => [d.en.toLowerCase(), d.fa]));
export const dietaryFa = (word: string): string => DIETARY_FA.get(word.trim().toLowerCase()) ?? word;

// What customers may see of an item's notes: drafted allergen and dietary notes stay off the public page until an owner or admin
// confirms them (Kian's ruling, 2026-10-12); the halal choice and the free note are the owner's and always shown when set.
export function confirmedNotes(notes: Notes, drafts: string[] | null | undefined): Notes {
  const d = drafts ?? [];
  return { ...notes, allergens: d.includes('allergens') ? [] : notes.allergens, dietary: d.includes('dietary') ? [] : notes.dietary };
}

// The general notice, on every venue's page (the PM, 2026-10-12). Persian drafted for Kian's review.
export const ALLERGY_NOTICE: Bi = words.notice;
