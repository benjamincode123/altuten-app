import { Directory, File, Paths } from 'expo-file-system';

import type { ProductCatalog } from '../db/types';

/**
 * Photos a member submitted for an existing catalog product, kept on-device
 * until the live row gets an approved image. File-system, not SecureStore:
 * these are data-URIs and SecureStore cannot hold them.
 */

const DIR_NAME = 'altuten-pending-images-v1';
const memory = new Map<string, string>();

function cacheKey(catalog: ProductCatalog, id: number): string {
  return `${catalog}:${id}`;
}

function fileName(catalog: ProductCatalog, id: number): string {
  return `${catalog.replace(/[^a-z0-9_]/gi, '_')}_${id}.txt`;
}

function imagesDirectory(): Directory {
  const dir = new Directory(Paths.document, DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
}

export async function cachePendingProductImage(
  catalog: ProductCatalog,
  id: number,
  imageUri: string
): Promise<void> {
  const trimmed = imageUri.trim();
  if (!trimmed || id <= 0) return;
  memory.set(cacheKey(catalog, id), trimmed);
  try {
    const file = new File(imagesDirectory(), fileName(catalog, id));
    file.create({ overwrite: true });
    file.write(trimmed);
  } catch {
    // Memory still covers this session.
  }
}

export async function getPendingProductImage(
  catalog: ProductCatalog,
  id: number
): Promise<string | null> {
  if (id <= 0) return null;
  const key = cacheKey(catalog, id);
  const cached = memory.get(key);
  if (cached) return cached;
  try {
    const file = new File(imagesDirectory(), fileName(catalog, id));
    if (!file.exists) return null;
    const text = file.textSync().trim();
    if (!text) return null;
    memory.set(key, text);
    return text;
  } catch {
    return null;
  }
}

export async function clearPendingProductImage(
  catalog: ProductCatalog,
  id: number
): Promise<void> {
  memory.delete(cacheKey(catalog, id));
  try {
    const file = new File(imagesDirectory(), fileName(catalog, id));
    if (file.exists) file.delete();
  } catch {
    // Nothing left to try.
  }
}
