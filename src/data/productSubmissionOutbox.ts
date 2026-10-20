import { Directory, File, Paths } from 'expo-file-system';

import { getAuthToken } from '../auth/session';
import type { NewProduct, Product } from '../db/types';
import { isAppError, type AppErrorCode } from '../errors/appError';
import { cachePendingProduct } from './pendingProductCache';
import { getProductRepository } from './repository';

/**
 * Durable queue for product submissions so the add screen can return to the
 * user immediately instead of waiting for the upload.
 *
 * Deliberately on the file system rather than SecureStore: submissions carry a
 * base64 photo, which is far past the size SecureStore reliably stores (the
 * pending-product cache drops data-URIs for the same reason).
 *
 * One file per submission, named by queue time, so enqueuing writes only the
 * new entry and the flush order is FIFO.
 */

const DIR_NAME = 'altuten-product-outbox-v1';

/** Give up eventually so a submission the server keeps rejecting can't loop. */
const MAX_ATTEMPTS = 8;

/**
 * Failures that retrying cannot fix — the submission is rejected on its own
 * merits, so it is dropped rather than retried forever.
 */
const PERMANENT_FAILURES: ReadonlySet<AppErrorCode> = new Set([
  'barcode_taken',
  'product_has_barcode',
  'validation',
  'image_invalid',
  'forbidden',
  'not_found',
  'conflict',
]);

interface OutboxEntry {
  id: string;
  queuedAt: number;
  attempts: number;
  product: NewProduct;
}

function outboxDirectory(): Directory {
  const dir = new Directory(Paths.document, DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
}

function isOutboxEntry(value: unknown): value is OutboxEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as OutboxEntry;
  if (typeof entry.id !== 'string' || typeof entry.attempts !== 'number') return false;
  const product = entry.product;
  if (!product || typeof product !== 'object') return false;
  return typeof product.barcode === 'string' && typeof product.name === 'string';
}

function entryFiles(dir: Directory): File[] {
  return dir
    .list()
    .filter((item): item is File => item instanceof File && item.name.endsWith('.json'))
    // Names start with the queue timestamp, so this is oldest-first.
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Queue a submission for upload. Resolves once it is safely on disk, so the
 * caller can navigate away knowing the submission will survive an app restart.
 */
export async function enqueueProductSubmission(product: NewProduct): Promise<void> {
  const entry: OutboxEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: Date.now(),
    attempts: 0,
    product,
  };
  const file = new File(outboxDirectory(), `${entry.id}.json`);
  file.create({ overwrite: true });
  file.write(JSON.stringify(entry));
}

/** How many submissions are still waiting to upload. */
export function countQueuedProductSubmissions(): number {
  try {
    return entryFiles(outboxDirectory()).length;
  } catch {
    return 0;
  }
}

/**
 * Replace the optimistic cache entry with what the server stored, so the next
 * scan shows the real row (id, catalog, hosted image) instead of the local one.
 */
async function reconcilePendingCache(
  product: NewProduct,
  saved: Product
): Promise<void> {
  await cachePendingProduct({
    ...saved,
    barcode: product.barcode,
    name: product.name,
    produsent: product.produsent ?? null,
    ingredients: product.ingredients ?? null,
    glutenRating: product.glutenRating,
    allergens: product.allergens ?? null,
    imageUrl: saved.imageUrl ?? product.imageBase64 ?? null,
    pending: true,
  });
}

let flushing: Promise<void> | null = null;

/**
 * Upload everything queued. Safe to call often — concurrent calls share the
 * one run, and it stops at the first transient failure so a flaky network does
 * not burn through the retry budget of every queued submission at once.
 */
export function flushProductSubmissions(): Promise<void> {
  if (flushing) return flushing;
  flushing = runFlush().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function runFlush(): Promise<void> {
  // Uploading needs a session; the queue simply waits for the next sign-in.
  if (!getAuthToken()) return;

  let files: File[];
  try {
    files = entryFiles(outboxDirectory());
  } catch {
    return;
  }

  for (const file of files) {
    let entry: OutboxEntry;
    try {
      const parsed = JSON.parse(file.textSync()) as unknown;
      if (!isOutboxEntry(parsed)) {
        file.delete();
        continue;
      }
      entry = parsed;
    } catch {
      // Unreadable entry: dropping it is better than blocking the queue.
      try {
        file.delete();
      } catch {
        // Nothing left to try.
      }
      continue;
    }

    try {
      const saved = await getProductRepository().addProduct(entry.product);
      file.delete();
      await reconcilePendingCache(entry.product, saved);
    } catch (err) {
      const code: AppErrorCode = isAppError(err) ? err.code : 'generic';
      if (code === 'unauthorized') {
        // Session is gone. Keep the entry and stop; signing in flushes again.
        return;
      }

      const attempts = entry.attempts + 1;
      if (PERMANENT_FAILURES.has(code) || attempts >= MAX_ATTEMPTS) {
        try {
          file.delete();
        } catch {
          // Nothing left to try.
        }
        continue;
      }

      try {
        file.write(JSON.stringify({ ...entry, attempts } satisfies OutboxEntry));
      } catch {
        // Keeping the old attempt count only costs an extra retry.
      }
      // Transient: stop here and let the next trigger pick up where we left off.
      return;
    }
  }
}
