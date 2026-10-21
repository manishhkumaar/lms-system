"use client";
/*
 * The client-side copy of what the signed-in person may see. It's loaded from GET /api/bootstrap
 * (Postgres row-level security decides what's in it) and kept current by the patches every API
 * write returns. Screens read with useDb(); they write only through ./actions.
 */
import { useSyncExternalStore } from "react";
import type { ApiResponse, CollectionKey, DB, Patch } from "./types";

let state: DB | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getDb(): DB {
  if (!state) throw new Error("Data isn't loaded yet.");
  return state;
}

export function hasDb(): boolean {
  return state !== null;
}

export function setDb(next: DB | null) {
  state = next;
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const snapshot = () => state;

/** The whole DB. Stable until the next write, so derive with useMemo. Only under <DataGate>. */
export function useDb(): DB {
  const db = useSyncExternalStore(subscribe, snapshot, () => null);
  if (!db) throw new Error("useDb() needs <DataGate> above it.");
  return db;
}

/** The DB if loaded (auth screens render without it). */
export function useDbMaybe(): DB | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

/** Fetches the role-scoped snapshot. Throws with the server's message on failure. */
export async function loadDb(): Promise<DB> {
  const res = await fetch("/api/bootstrap", { cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as ApiResponse<DB>;
  if (!res.ok || !body.result) throw Object.assign(new Error(body.error || "Couldn't load your data."), { status: res.status });
  setDb(body.result);
  return body.result;
}

function upsertById<T extends { id: string }>(xs: T[], rows: T[]): T[] {
  if (!rows.length) return xs;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const out = xs.map((x) => {
    const r = byId.get(x.id);
    if (r) {
      seen.add(x.id);
      return r;
    }
    return x;
  });
  for (const r of rows) if (!seen.has(r.id)) out.push(r);
  return out;
}

/** Applies a write's patch to the store. */
export function applyPatch(patch: Patch) {
  if (!state) return;
  let next: DB = state;
  for (const key of Object.keys(patch) as Array<keyof Patch>) {
    if (key === "settings") {
      if (patch.settings) next = { ...next, settings: patch.settings };
      continue;
    }
    const k = key as CollectionKey;
    const change = patch[k];
    if (!change) continue;
    let rows = next[k] as Array<{ id: string }>;
    if (change.remove?.length) {
      const gone = new Set(change.remove);
      rows = rows.filter((r) => !gone.has(r.id));
    }
    if (change.upsert?.length) rows = upsertById(rows, change.upsert as Array<{ id: string }>);
    next = { ...next, [k]: rows };
  }
  state = next;
  emit();
}
