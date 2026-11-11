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

/** Source credit shown at the bottom of the recipe page (CC BY-SA recipes). Null for MENY. */
export type RecipeCredit = {
  sourceName: string;
  sourceUrl: string | null;
  author: string | null;
  authorsUrl: string | null;
  license: string;
  licenseUrl: string | null;
  /** e.g. "Oversatt og tilpasset av AltUten" */
  changes: string | null;
  imageAuthor: string | null;
  imageLicense: string | null;
  /** Ready-made full credit text. */
  text: string | null;
};

export type RecipeSuggestion = {
  id: number;
  name: string;
  imageUrl: string | null;
  /** Original recipe page (used for the credit, not opened on tap). */
  url: string;
  source: string;
  /** Allergens of the scanned products the recipe uses: "Gluten", "Melk", … */
  allergens: string[];
  /** "May contain" allergens of those products (not in `allergens`). */
  mayContain: string[];
  /** True when the recipe needs unscanned ingredients whose allergens are unknown. */
  allergensIncomplete: boolean;
  credit: RecipeCredit | null;
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
          mayContain: Array.isArray(r.mayContain) ? r.mayContain : [],
          allergensIncomplete: r.allergensIncomplete === true,
          credit: r.credit ?? null,
          matched: Array.isArray(r.matched) ? r.matched : [],
          missing: Array.isArray(r.missing) ? r.missing : [],
        }))
      : [],
  };
}

export type RecipeDetail = {
  id: number;
  name: string;
  imageUrl: string | null;
  url: string;
  source: string;
  language: string | null;
  /** Untranslated title, for the credit line. */
  originalName: string | null;
  ingredients: string[];
  steps: string[];
  credit: RecipeCredit | null;
};

export async function fetchRecipe(token: string, id: number): Promise<RecipeDetail> {
  let response: Response;
  try {
    response = await fetch(recipesUrl(`/${id}`), {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    const body = await readApiErrorBody(response);
    throw appErrorFromHttp(response.status, body.error, 'generic', body.retryAfterSeconds);
  }
  const data = (await response.json()) as Partial<RecipeDetail>;
  const strings = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];
  return {
    id: data.id ?? id,
    name: data.name ?? '',
    imageUrl: data.imageUrl ?? null,
    url: data.url ?? '',
    source: data.source ?? '',
    language: data.language ?? null,
    originalName: data.originalName ?? null,
    ingredients: strings(data.ingredients),
    steps: strings(data.steps),
    credit: data.credit ?? null,
  };
}
