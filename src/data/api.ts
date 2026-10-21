"use client";
import { applyPatch } from "./store";
import type { ApiResponse } from "./types";

/** An error written for people; screens show its message as-is. */
export class ActionError extends Error {}

/**
 * Calls one of the app's API routes. Applies the returned patch to the store and resolves with the
 * result; rejects with an ActionError carrying the server's message.
 */
export async function api<T = void>(method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ActionError("Couldn't reach the server. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as ApiResponse<T>;
  if (!res.ok) {
    if (res.status === 401) throw new ActionError("Your session has ended. Sign in again.");
    throw new ActionError(data.error || "Something went wrong. Try again.");
  }
  if (data.patch) applyPatch(data.patch);
  return data.result as T;
}
