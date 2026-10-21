"use client";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { setDb, useDb, useDbMaybe } from "@/data/store";
import type { User } from "@/data/types";
import { createClient } from "@/utils/supabase/client";

type LoginResult = { ok: true; user: User } | { ok: false; error: string };

interface AuthValue {
  /** The signed-in person, once their data has loaded (inside the portals). */
  user: User | undefined;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

function signInMessage(message: string) {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match. Check both and try again.";
  if (/email not confirmed/i.test(message)) return "Confirm your email first: open the link we sent you, then sign in.";
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Wait a minute and try again.";
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const db = useDbMaybe();
  const user = useMemo(() => db?.users.find((u) => u.id === db.meId), [db]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { ok: false, error: signInMessage(error.message) };
    // The profile decides the role; no profile or a suspended one means no access.
    const res = await fetch("/api/me", { cache: "no-store" });
    const body = (await res.json().catch(() => ({}))) as { result?: User; error?: string };
    if (!res.ok || !body.result) {
      await supabase.auth.signOut();
      return { ok: false, error: body.error || "Couldn't sign you in. Try again." };
    }
    return { ok: true, user: body.result };
  }, []);

  const logout = useCallback(async () => {
    await createClient().auth.signOut();
    setDb(null);
    window.location.assign("/login");
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}

/** The signed-in person. Only inside the portals (under <DataGate>). */
export function useUser(): User {
  const db = useDb();
  const me = db.users.find((u) => u.id === db.meId);
  if (!me) throw new Error("Signed-in profile missing from data.");
  return me;
}
