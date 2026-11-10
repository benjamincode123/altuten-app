import { config } from '../config';
import { AppError, appErrorFromHttp, readApiErrorBody } from '../errors/appError';
import type { ProductCatalog } from '../db/types';

export type RecipeProductRef = { catalog: ProductCatalog; id: number };

export type RecipeSuggestionRequest = {
  products?: RecipeProductRef[];
  listId?: number;
  /** 1–100, server default 20. */
  limit?: number;
  /** 0–1, server default 0.3. */
  minCoverage?: number;
};

export type RecipeSuggestion = {
  id: number;
  name: string;
  imageUrl: string | null;
  /** Original recipe (MENY). */
  url: string;
  source: string;
  /** Official allergen names: "Gluten", "Melk", … */
  allergens: string[];
  /** 0–1 */
  coverage: number;
  have: number;
  need: number;
  matched: { ingredient: string; fromProducts: string[] }[];
  missing: string[];
};

export type RecipeSuggestionResponse = {
  dataSource: 'database' | 'files';
  products: number;
  productsWithoutIngredients: { product: string; name: string | null }[];
  ingredientsYouHave: string[];
  matchingRecipes: number;
  recipes: RecipeSuggestion[];
};

function recipesUrl(path: string): string {
  return `${config.apiBaseUrl.replace(/\/+$/, '')}/api/recipes${path}`;
}

export async function fetchRecipeSuggestions(
  token: string,
  request: RecipeSuggestionRequest
): Promise<RecipeSuggestionResponse> {
  let response: Response;
  try {
    response = await fetch(recipesUrl('/suggestions'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    const body = await readApiErrorBody(response);
    throw appErrorFromHttp(response.status, body.error, 'generic', body.retryAfterSeconds);
  }
  const data = (await response.json()) as Partial<RecipeSuggestionResponse>;
  return {
    dataSource: data.dataSource ?? 'database',
    products: data.products ?? 0,
    productsWithoutIngredients: Array.isArray(data.productsWithoutIngredients)
      ? data.productsWithoutIngredients
      : [],
    ingredientsYouHave: Array.isArray(data.ingredientsYouHave) ? data.ingredientsYouHave : [],
    matchingRecipes: data.matchingRecipes ?? 0,
    recipes: Array.isArray(data.recipes)
      ? data.recipes.map((r) => ({
          ...r,
          allergens: Array.isArray(r.allergens) ? r.allergens : [],
          matched: Array.isArray(r.matched) ? r.matched : [],
          missing: Array.isArray(r.missing) ? r.missing : [],
        }))
      : [],
  };
}
