import "server-only";
import { NextResponse } from "next/server";
import type { ApiResponse } from "@/data/types";

/** An error with an HTTP status and a message written for people. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface PgError {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}

/** Postgres / PostgREST errors → messages people can act on. SQL functions raise human-readable messages. */
export function fromPg(err: PgError, context?: { unique?: string; notFound?: string }): HttpError {
  switch (err.code) {
    case "P0001": // raise exception in our SQL functions
      return new HttpError(400, err.message);
    case "42501": // insufficient privilege / row-level security
      return new HttpError(403, err.message && !/row-level security|permission denied/i.test(err.message) ? err.message : "You don't have permission to do that.");
    case "23505":
      return new HttpError(409, context?.unique || "That already exists.");
    case "23503":
      return new HttpError(409, "It's still linked to other records, so it can't be changed that way.");
    case "23514":
    case "22P02":
    case "22007":
    case "22008":
      return new HttpError(400, "Some of the details aren't valid. Check them and try again.");
    case "PGRST116":
      return new HttpError(404, context?.notFound || "That record no longer exists.");
    default:
      console.error("Database error", err);
      return new HttpError(500, "Something went wrong on the server. Try again.");
  }
}

/** Unwraps a Supabase result, throwing a mapped error. */
export function must<T>(res: { data: T | null; error: PgError | null }, context?: { unique?: string; notFound?: string }): T {
  if (res.error) throw fromPg(res.error, context);
  if (res.data === null || res.data === undefined) throw new HttpError(404, context?.notFound || "That record no longer exists.");
  return res.data;
}

/** Throws a mapped error if the write failed. */
export function check(res: { error: PgError | null }, context?: { unique?: string; notFound?: string }) {
  if (res.error) throw fromPg(res.error, context);
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const text = await req.text();
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    throw new HttpError(400, "The request wasn't valid JSON.");
  }
}

type Params = Record<string, string>;

/**
 * Wraps a route handler: awaits params, turns thrown HttpErrors into { error } responses and returns
 * { result, patch } as JSON.
 */
export function handle<P extends Params = Params>(fn: (req: Request, params: P) => Promise<ApiResponse | void>) {
  return async (req: Request, ctx: { params: Promise<P> }) => {
    try {
      const params = (await ctx?.params) ?? ({} as P);
      const out = await fn(req, params);
      return NextResponse.json(out ?? {}, { headers: { "cache-control": "no-store" } });
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      console.error("Unhandled API error", err);
      return NextResponse.json({ error: "Something went wrong on the server. Try again." }, { status: 500 });
    }
  };
}

/* ---------- input validation: messages say how to fix it ---------- */

export function text(v: unknown, label: string, opts: { required?: boolean; max?: number } = {}): string | undefined {
  if (v === undefined || v === null || v === "") {
    if (opts.required) throw new HttpError(400, `Enter ${label}.`);
    return undefined;
  }
  if (typeof v !== "string") throw new HttpError(400, `Enter ${label} as text.`);
  const s = v.trim();
  if (opts.required && !s) throw new HttpError(400, `Enter ${label}.`);
  if (opts.max && s.length > opts.max) throw new HttpError(400, `Keep ${label} under ${opts.max} characters.`);
  return s;
}

export function requiredText(v: unknown, label: string, max = 500): string {
  return text(v, label, { required: true, max }) as string;
}

export function int(v: unknown, label: string, opts: { min?: number; max?: number; required?: boolean } = {}): number | undefined {
  if (v === undefined || v === null || v === "") {
    if (opts.required) throw new HttpError(400, `Enter ${label}.`);
    return undefined;
  }
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new HttpError(400, `Enter ${label} as a whole number.`);
  if (opts.min !== undefined && n < opts.min) throw new HttpError(400, `${label[0].toUpperCase() + label.slice(1)} must be at least ${opts.min}.`);
  if (opts.max !== undefined && n > opts.max) throw new HttpError(400, `${label[0].toUpperCase() + label.slice(1)} must be at most ${opts.max}.`);
  return n;
}

export function oneOf<T extends string>(v: unknown, allowed: readonly T[], label: string, required = true): T | undefined {
  if (v === undefined || v === null || v === "") {
    if (required) throw new HttpError(400, `Choose ${label}.`);
    return undefined;
  }
  if (!allowed.includes(v as T)) throw new HttpError(400, `Choose a valid ${label}.`);
  return v as T;
}

export function email(v: unknown, required = true): string | undefined {
  const s = text(v, "an email address", { required, max: 200 });
  if (s && !/^\S+@\S+\.\S+$/.test(s)) throw new HttpError(400, "Enter a valid email address.");
  return s?.toLowerCase();
}

export function phone(v: unknown, required = true): string | undefined {
  const s = text(v, "a mobile number", { required, max: 20 });
  if (s && s.replace(/\D/g, "").length !== 10) throw new HttpError(400, "Enter a 10-digit mobile number.");
  return s;
}

export function dateStr(v: unknown, label: string, required = true): string | undefined {
  const s = text(v, label, { required });
  if (s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new HttpError(400, `Enter ${label} as a date.`);
  return s;
}

export function timeStr(v: unknown, label: string): string {
  const s = requiredText(v, label, 5);
  if (!/^\d{2}:\d{2}$/.test(s)) throw new HttpError(400, `Enter ${label} as a time.`);
  return s;
}

export function bool(v: unknown): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  return v === true || v === "true";
}

/** Copies only defined keys, so PATCH bodies don't null out fields they didn't mention. */
export function defined<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
