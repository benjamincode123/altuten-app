import * as Location from 'expo-location';

import {
  isProductCountry,
  orderProductCountries,
  PRODUCT_COUNTRIES,
  type ProductCountry,
} from './productCountries';

/** ISO 3166-1 alpha-2 → catalog country (submission + search). */
const ISO_TO_CATALOG_COUNTRY: Record<string, string> = {
  NO: 'no',
  SJ: 'no', // Svalbard
  SE: 'se',
  DK: 'dk',
  FO: 'dk', // Faroe Islands — closest catalog
  GL: 'dk', // Greenland
  DE: 'de',
  ES: 'es',
  FR: 'fr',
  IT: 'it',
  BE: 'be',
};

let cachedGpsCountry: ProductCountry | null | undefined;
let inflight: Promise<ProductCountry | null> | null = null;

function mapIsoCountryCode(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const key = iso.trim().toUpperCase();
  const mapped = ISO_TO_CATALOG_COUNTRY[key];
  if (mapped) return mapped;
  // Keep bare ISO-2 lowercase when outside known catalogs.
  if (key.length === 2 && /^[A-Z]{2}$/.test(key)) {
    return key.toLowerCase();
  }
  return null;
}

function mapIsoToProductCountry(iso: string | null | undefined): ProductCountry | null {
  const mapped = mapIsoCountryCode(iso);
  return mapped && isProductCountry(mapped) ? mapped : null;
}

/** Suggest app language from GPS country. Norway → Norwegian; otherwise English. */
export function suggestLocaleFromIsoCountry(
  iso: string | null | undefined
): 'en' | 'nb' {
  const key = iso?.trim().toUpperCase();
  if (key === 'NO' || key === 'SJ') {
    return 'nb';
  }
  return 'en';
}

/**
 * Best-effort GPS → catalog country. Cached for the app session.
 * Returns null when permission is denied, location fails, or the country
 * is outside NO/SE/DK/DE (search catalogs).
 */
export async function detectGpsProductCountry(): Promise<ProductCountry | null> {
  if (cachedGpsCountry !== undefined) {
    return cachedGpsCountry;
  }
  if (inflight) {
    return inflight;
  }

  inflight = (async () => {
    try {
      const hint = await readGpsSubmissionLocation();
      cachedGpsCountry = mapIsoToProductCountry(hint.isoCountryCode);
      return cachedGpsCountry;
    } catch {
      cachedGpsCountry = null;
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Selected (or all) catalog countries with GPS country first when known. */
export async function getPreferredProductCountries(
  selected?: readonly ProductCountry[]
): Promise<ProductCountry[]> {
  const gps = await detectGpsProductCountry();
  const base = selected && selected.length > 0 ? selected : PRODUCT_COUNTRIES;
  return orderProductCountries(base, gps);
}

export type GpsSubmissionLocation = {
  /** Catalog country (no/se/…) or ISO-2; null when unknown. */
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  isoCountryCode: string | null;
};

/**
 * Best-effort GPS payload for product submissions.
 * Never throws — missing permission/coords → all nulls (submission still OK).
 */
export async function getGpsSubmissionLocation(): Promise<GpsSubmissionLocation> {
  try {
    return await readGpsSubmissionLocation();
  } catch {
    return { country: null, latitude: null, longitude: null, isoCountryCode: null };
  }
}

export async function readGpsSubmissionLocation(): Promise<GpsSubmissionLocation> {
  const empty: GpsSubmissionLocation = {
    country: null,
    latitude: null,
    longitude: null,
    isoCountryCode: null,
  };

  const current = await Location.getForegroundPermissionsAsync();
  let status = current.status;
  if (status !== Location.PermissionStatus.GRANTED) {
    const asked = await Location.requestForegroundPermissionsAsync();
    status = asked.status;
  }
  if (status !== Location.PermissionStatus.GRANTED) {
    return empty;
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;

  const places = await Location.reverseGeocodeAsync({ latitude, longitude });
  const iso =
    places.find((p) => p.isoCountryCode)?.isoCountryCode ??
    places[0]?.isoCountryCode ??
    null;

  return {
    country: mapIsoCountryCode(iso),
    latitude,
    longitude,
    isoCountryCode: iso?.trim().toUpperCase() ?? null,
  };
}
