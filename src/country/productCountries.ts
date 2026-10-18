/**
 * Catalog country code (ISO 3166-1 alpha-2, lower case). The backend defines
 * one products_<code> table per country, so any code may come back from a scan.
 */
export type ProductCountry = string;

const COUNTRY_PATTERN = /^[a-z]{2}$/;

export function isProductCountry(value: unknown): value is ProductCountry {
  return typeof value === 'string' && COUNTRY_PATTERN.test(value);
}

/**
 * Countries offered in the search filter. Deliberately short: this is a picker
 * the user taps through, not the set of catalogs the app can read.
 */
export const SEARCH_COUNTRIES: ProductCountry[] = ['no', 'se', 'dk', 'de'];

/**
 * Order selected countries with an optional preferred country first (GPS).
 * Remaining countries keep the stable SEARCH_COUNTRIES order.
 */
export function orderProductCountries(
  selected: readonly ProductCountry[],
  preferredFirst?: ProductCountry | null
): ProductCountry[] {
  const set = new Set(selected);
  const next: ProductCountry[] = [];
  if (preferredFirst && set.has(preferredFirst)) {
    next.push(preferredFirst);
  }
  for (const code of SEARCH_COUNTRIES) {
    if (set.has(code) && code !== preferredFirst) {
      next.push(code);
    }
  }
  // Anything outside the picker list (e.g. a GPS country) keeps its own order.
  for (const code of selected) {
    if (!next.includes(code)) {
      next.push(code);
    }
  }
  return next;
}

/** Toggle a country; always keeps at least one selected. */
export function toggleProductCountry(
  selected: ProductCountry[],
  code: ProductCountry,
  preferredFirst?: ProductCountry | null
): ProductCountry[] {
  const has = selected.includes(code);
  if (has) {
    if (selected.length <= 1) return selected;
    return orderProductCountries(
      selected.filter((c) => c !== code),
      preferredFirst
    );
  }
  return orderProductCountries([...selected, code], preferredFirst);
}

/** Catalog table a country code maps to, mirroring the backend registry. */
export function catalogTableForCountry(country: ProductCountry): string {
  const code = country.trim().toLowerCase();
  return code === 'no' || code.length === 0 ? 'products' : `products_${code}`;
}

/** Country code behind a catalog table name (`products_de` → `de`). */
export function countryForCatalogTable(catalog: string): ProductCountry {
  const match = /^products_([a-z]{2})$/.exec(catalog.trim().toLowerCase());
  return match ? match[1] : 'no';
}
