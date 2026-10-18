import { config } from '../config';
import { AppError, appErrorFromHttp, readApiErrorBody } from '../errors/appError';
import type {
  FoodNeedsSurveyProductRef,
  FoodNeedsSurveyRequest,
  FoodNeedsSurveyResponse,
} from './foodNeedsSurvey';

function surveyUrl(path = ''): string {
  return `${config.apiBaseUrl.replace(/\/+$/, '')}/api/food-needs-survey/${path}`;
}

function authHeaders(token: string, json = false): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

async function throwForResponse(
  response: Response,
  fallback: 'lookup_failed' | 'save_failed'
): Promise<never> {
  const body = await readApiErrorBody(response);
  throw appErrorFromHttp(
    response.status,
    body.error,
    fallback,
    body.retryAfterSeconds
  );
}

/**
 * The signed-in user's saved answers for one product, or null when they have
 * not answered for it.
 */
export async function fetchOwnFoodNeedsSurvey(
  token: string,
  product: FoodNeedsSurveyProductRef
): Promise<FoodNeedsSurveyResponse | null> {
  const query = `?catalog=${encodeURIComponent(product.catalog)}&productId=${product.productId}`;
  let response: Response;
  try {
    response = await fetch(surveyUrl(query), { headers: authHeaders(token) });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForResponse(response, 'lookup_failed');
  }
  const body = (await response.json()) as { response?: FoodNeedsSurveyResponse | null };
  return body.response ?? null;
}

/** Submit or update the answers. `created` is false when it replaced an answer. */
export async function submitFoodNeedsSurvey(
  token: string,
  request: FoodNeedsSurveyRequest
): Promise<{ created: boolean; response: FoodNeedsSurveyResponse }> {
  let response: Response;
  try {
    response = await fetch(surveyUrl(), {
      method: 'POST',
      headers: authHeaders(token, true),
      body: JSON.stringify(request),
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForResponse(response, 'save_failed');
  }
  const body = (await response.json()) as {
    created?: boolean;
    response: FoodNeedsSurveyResponse;
  };
  return { created: body.created === true, response: body.response };
}
