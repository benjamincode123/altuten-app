/**
 * Gluten rating for a product.
 *
 * - GLUTEN_FREE: confirmed gluten free.
 * - GLUTEN_TRACE: made with or near gluten-containing foods (may contain traces).
 * - GLUTEN_CONTENT: contains gluten.
 *
 * The string values are what gets stored in the database. Keeping them stable
 * makes it safe to move the same schema to MSSQL later.
 */
export enum GlutenRating {
  GlutenFree = 'gluten_free',
  GlutenTrace = 'gluten_trace',
  GlutenContent = 'gluten_content',
}

export const ALL_GLUTEN_RATINGS: GlutenRating[] = [
  GlutenRating.GlutenFree,
  GlutenRating.GlutenTrace,
  GlutenRating.GlutenContent,
];

export interface GlutenRatingMeta {
  value: GlutenRating;
  label: string;
  description: string;
  /** Foreground/accent color used for text and badges. */
  color: string;
  /** Softer background color for cards/badges. */
  backgroundColor: string;
}

export const GLUTEN_RATING_META: Record<GlutenRating, GlutenRatingMeta> = {
  [GlutenRating.GlutenFree]: {
    value: GlutenRating.GlutenFree,
    label: 'Gluten Free',
    description: 'Confirmed gluten free.',
    color: '#1B7F3B',
    backgroundColor: '#E4F6E9',
  },
  [GlutenRating.GlutenTrace]: {
    value: GlutenRating.GlutenTrace,
    label: 'May Contain Traces',
    description: 'Made with or near gluten-containing foods.',
    color: '#B26A00',
    backgroundColor: '#FCF0DA',
  },
  [GlutenRating.GlutenContent]: {
    value: GlutenRating.GlutenContent,
    label: 'Contains Gluten',
    description: 'This product contains gluten.',
    color: '#B3261E',
    backgroundColor: '#FBE5E4',
  },
};

export function getGlutenRatingMeta(rating: GlutenRating): GlutenRatingMeta {
  return GLUTEN_RATING_META[rating];
}

export function isGlutenRating(value: string): value is GlutenRating {
  return ALL_GLUTEN_RATINGS.includes(value as GlutenRating);
}

/**
 * Which catalog table a product came from (API). The backend registry defines
 * one table per country, so the app accepts any of them rather than a fixed
 * list — a barcode scan can resolve to any country's catalog.
 */
export type ProductCatalog = 'products' | `products_${string}`;

/** `products` (primary/NO) or `products_<iso2>`, matching catalog-tables.json. */
const PRODUCT_CATALOG_PATTERN = /^products(?:_[a-z]{2})?$/;

export function isProductCatalog(value: unknown): value is ProductCatalog {
  return typeof value === 'string' && PRODUCT_CATALOG_PATTERN.test(value);
}

/** Normalize an API/route value into a catalog, or null when unusable. */
export function parseProductCatalog(
  value: string | null | undefined
): ProductCatalog | null {
  const key = (value ?? '').trim().toLowerCase();
  return isProductCatalog(key) ? key : null;
}

export interface ProductAllergens {
  inneholder: string[];
  kanInneholde: string[];
  inneholderIkke: string[];
}

export interface Product {
  id: number;
  barcode: string;
  name: string;
  /** Manufacturer / brand name when available. */
  produsent?: string | null;
  /** Country of origin / production country when available. */
  productionCountry?: string | null;
  ingredients: string | null;
  /** English translation of ingredients when the API provides `ingredients_en`. */
  ingredientsEn?: string | null;
  /** Norwegian translation of ingredients when the API provides `ingredients_no`. */
  ingredientsNo?: string | null;
  glutenRating: GlutenRating;
  createdAt: string;
  updatedAt: string;
  /** Present when loaded from the catalog API. */
  catalog?: ProductCatalog;
  /** True when queued for admin review (not in live catalog yet). */
  pending?: boolean;
  /** Product image URL (or legacy data-URI / base64). */
  imageUrl?: string | null;
  /** Structured allergen declaration from dbo.products. */
  allergens?: ProductAllergens | null;
}

export function isUnknownBarcode(barcode: string | null | undefined): boolean {
  return (barcode ?? '').trim().toLowerCase() === 'unknown';
}

/** Shape used when creating a new product (no id/timestamps yet). */
export interface NewProduct {
  barcode: string;
  name: string;
  produsent?: string | null;
  ingredients?: string | null;
  /** Local/offline use only — the API derives the rating from `allergens`. */
  glutenRating: GlutenRating;
  imageBase64?: string | null;
  /** When set with catalog, admin update of an existing catalog row. */
  id?: number;
  catalog?: ProductCatalog;
  /** Structured allergen declaration (inneholder / kanInneholde / inneholderIkke). */
  allergens?: ProductAllergens | null;
  /** Optional GPS/catalog country (no/se/es/…). */
  country?: string | null;
  /**
   * Catalog region the submission belongs to (no/se/dk/de/…). Decides which
   * country table the product is stored in. Defaults to `country` when unset.
   */
  region?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}
