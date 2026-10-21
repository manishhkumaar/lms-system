"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { hasDb, loadDb } from "@/data/store";
import { Banner, Button } from "@/design-system";
import { useAuth } from "./AuthContext";

/** Refetch so changes other people make show up without a reload. */
const REFRESH_MS = 60_000;

/**
 * Loads the signed-in person's data before the portal renders, then keeps it fresh: every minute,
 * and whenever the tab comes back into focus.
 */
export function DataGate({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const [state, setState] = useState<"loading" | "ready" | "error">(() => (hasDb() ? "ready" : "loading"));
  const [error, setError] = useState("");

  const load = useCallback(async (silent: boolean) => {
    try {
      await loadDb();
      setState("ready");
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401) {
        window.location.assign(`/login?from=${encodeURIComponent(location.pathname + location.search)}`);
        return;
      }
      if (!silent) {
        setError(err instanceof Error ? err.message : "Couldn't load your data.");
        setState("error");
      }
    }
  }, []);

  useEffect(() => {
    void load(hasDb());
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, REFRESH_MS);
    const onFocus = () => void load(true);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  if (state === "loading") {
    return (
      <div className="app-boot" aria-busy="true" aria-live="polite">
        <span className="bl-sidebar-mark" aria-hidden="true">
          B
        </span>
        <span className="muted">Loading your workspace…</span>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="app-auth">
        <div className="app-auth-card">
          <h1 className="t-h2">Couldn't load your workspace</h1>
          <Banner tone="danger">{error}</Banner>
          <div className="row">
            <Button onClick={() => void load(false)}>Try again</Button>
            <Button variant="secondary" onClick={() => void logout()}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
