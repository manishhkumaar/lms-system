import "server-only";
import { cookies } from "next/headers";
import type { Role } from "@/data/types";
import { createClient } from "@/utils/supabase/server";
import { HttpError } from "./http";
import type { ProfileRow } from "./rows";

export type ServerClient = ReturnType<typeof createClient>;

export interface ApiContext {
  /** Acts as the signed-in person: every query passes through row-level security. */
  supabase: ServerClient;
  profile: ProfileRow;
  role: Role;
}

/** The signed-in person's Supabase client and profile, or null when signed out / not set up. */
export async function getSession(): Promise<{ supabase: ServerClient; profile: ProfileRow | null; userId: string | null }> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, profile: null, userId: null };
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<ProfileRow>();
  return { supabase, profile: data, userId: user.id };
}

/** For API routes: a signed-in, active person, optionally with one of these roles. */
export async function apiContext(...roles: Role[]): Promise<ApiContext> {
  const { supabase, profile, userId } = await getSession();
  if (!userId) throw new HttpError(401, "Sign in to continue.");
  if (!profile) throw new HttpError(403, "Your account isn't set up yet. Ask your administrator to invite you.");
  if (profile.status !== "active") throw new HttpError(403, "This account is suspended. Contact your administrator.");
  if (roles.length && !roles.includes(profile.role)) throw new HttpError(403, "You don't have permission to do that.");
  return { supabase, profile, role: profile.role };
}

export const STAFF: Role[] = ["super-admin", "operations", "course-designer", "admissions"];
export const PEOPLE: Role[] = ["super-admin", "operations", "admissions"];
export const DELIVERY: Role[] = ["super-admin", "operations"];
export const CURRICULUM: Role[] = ["super-admin", "course-designer"];
