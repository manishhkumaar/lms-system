import { useEffect, useState } from "react";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function initials(name?: string): string {
  return (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** True after the first client render. Portals into document.body wait for it (no document on the server). */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/* Stack of open overlays (Dialog, SidePanel) so Escape closes only the topmost one. */
const overlays: symbol[] = [];

export function pushOverlay(): symbol {
  const id = Symbol("overlay");
  overlays.push(id);
  return id;
}

export function popOverlay(id: symbol) {
  const i = overlays.indexOf(id);
  if (i >= 0) overlays.splice(i, 1);
}

export function isTopOverlay(id: symbol): boolean {
  return overlays[overlays.length - 1] === id;
}

export type Role ="super-admin" | "operations" | "course-designer" | "admissions" | "student";
export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const ROLE_LABEL: Record<Role, string> = {
  "super-admin": "Super Admin",
  operations: "Operations Manager",
  "course-designer": "Course Designer",
  admissions: "Admissions Executive",
  student: "Student",
};
