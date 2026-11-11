import type { RecipeSuggestion } from '../data/recipesApi';

/**
 * Suggestions from the last recipe search, by id, so the recipe page can show
 * the title, image and "you have" info at once while the full recipe loads.
 */
const suggestions = new Map<number, RecipeSuggestion>();

export function rememberSuggestions(list: RecipeSuggestion[]): void {
  suggestions.clear();
  for (const r of list) suggestions.set(r.id, r);
}

export function getSuggestion(id: number): RecipeSuggestion | undefined {
  return suggestions.get(id);
}
