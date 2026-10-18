import type {
  FoodNeedsSurveyProductRef,
  FoodNeedsSurveyResponse,
} from './foodNeedsSurvey';
import { fetchOwnFoodNeedsSurvey } from './foodNeedsSurveyApi';

/**
 * Answers are stored per user per product, so each product page needs its own
 * lookup. Caching them for the session keeps re-visits free.
 */
let cachedUserId: number | null = null;
/** Value null means "asked the server, and this product is unanswered". */
const memory = new Map<string, FoodNeedsSurveyResponse | null>();

function cacheKey(product: FoodNeedsSurveyProductRef): string {
  return `${product.catalog}:${product.productId}`;
}

function useUser(userId: number): void {
  if (cachedUserId !== userId) {
    memory.clear();
    cachedUserId = userId;
  }
}

export function saveCachedFoodNeedsSurvey(
  userId: number,
  product: FoodNeedsSurveyProductRef,
  saved: FoodNeedsSurveyResponse | null
): void {
  useUser(userId);
  memory.set(cacheKey(product), saved);
}

export function clearCachedFoodNeedsSurvey(): void {
  cachedUserId = null;
  memory.clear();
}

export async function loadOwnFoodNeedsSurvey(
  userId: number,
  token: string,
  product: FoodNeedsSurveyProductRef
): Promise<FoodNeedsSurveyResponse | null> {
  useUser(userId);
  const key = cacheKey(product);
  if (memory.has(key)) return memory.get(key) ?? null;
  const saved = await fetchOwnFoodNeedsSurvey(token, product);
  memory.set(key, saved);
  return saved;
}
