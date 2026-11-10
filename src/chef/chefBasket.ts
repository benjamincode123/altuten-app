import { useSyncExternalStore } from 'react';

import type { ProductCatalog } from '../db/types';

/** One product scanned while chef mode is on. */
export type ChefItem = {
  key: string;
  barcode: string;
  catalog: ProductCatalog;
  id: number;
  name: string;
  /** When it was added (ms), so only fresh chips animate in. */
  addedAt: number;
};

/** Recipes need at least this many scanned products. */
export const CHEF_MIN_ITEMS = 2;
/** API limit for products per request. */
export const CHEF_MAX_ITEMS = 200;

/**
 * In-memory basket shared by the scanner (adds) and the recipe screen (reads).
 * It lives for the app session only — chef mode is a quick "what can I cook"
 * flow, not a saved list.
 */
let items: ChefItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return items;
}

export function chefItemKey(catalog: ProductCatalog, id: number): string {
  return `${catalog}:${id}`;
}

/** Adds a product; returns false when it was already in the basket or full. */
export function addChefItem(item: Omit<ChefItem, 'key' | 'addedAt'>): boolean {
  const key = chefItemKey(item.catalog, item.id);
  if (items.some((i) => i.key === key) || items.length >= CHEF_MAX_ITEMS) return false;
  // Newest first so the latest scan is visible without scrolling.
  items = [{ ...item, key, addedAt: Date.now() }, ...items];
  emit();
  return true;
}

export function removeChefItem(key: string): void {
  const next = items.filter((i) => i.key !== key);
  if (next.length === items.length) return;
  items = next;
  emit();
}

export function clearChefItems(): void {
  if (items.length === 0) return;
  items = [];
  emit();
}

export function getChefItems(): ChefItem[] {
  return items;
}

export function useChefItems(): ChefItem[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
