"use client";
import { useCallback } from "react";
import { ActionError } from "@/data/actions";
import { useToast } from "@/design-system";

/**
 * Runs an action (usually an API call) and reports the outcome as a toast. Resolves with the
 * action's result, or undefined when it failed (ActionError messages are written for people and
 * shown as-is).
 *   const run = useRun();
 *   await run(() => publishLink(id, url), "Link published", "Students can join once the lecture starts.");
 */
export function useRun() {
  const toast = useToast();
  return useCallback(
    async <T,>(fn: () => T | Promise<T>, success?: string, description?: string): Promise<T | undefined> => {
      try {
        const out = await fn();
        if (success) toast({ title: success, description, tone: "success" });
        return out;
      } catch (err) {
        toast({ title: errorMessage(err), tone: "danger" });
        return undefined;
      }
    },
    [toast],
  );
}

/** Message from a thrown action error, for inline form banners. */
export function errorMessage(err: unknown): string {
  return err instanceof ActionError ? err.message : "Something went wrong. Try again.";
}
