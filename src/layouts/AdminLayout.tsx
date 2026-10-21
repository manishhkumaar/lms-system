"use client";
import { createContext, Suspense, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "@/lib/router";
import { activeNavKey, navPath } from "@/core/access";
import { useUser } from "@/auth/AuthContext";
import { useDb } from "@/data/store";
import { followUpDue } from "@/data/selectors";
import { Sidebar } from "@/design-system";
import { useIsMobile, useMediaQuery } from "@/lib/useMediaQuery";
import { useNow } from "@/lib/useNow";

interface Shell {
  isMobile: boolean;
  openDrawer: () => void;
}

const ShellCtx = createContext<Shell>({ isMobile: false, openDrawer: () => {} });
export const useAdminShell = () => useContext(ShellCtx);

const COLLAPSE_KEY = "batch-lms:sidebar-collapsed";

/** Admin / Operations portal: desktop-first, Sidebar + Topbar. */
export function AdminLayout({ children }: { children: ReactNode }) {
  const user = useUser();
  const db = useDb();
  const now = useNow(60000);
  const nav = useNavigate();
  const loc = useLocation();
  const isMobile = useIsMobile();
  const narrow = useMediaQuery("(max-width: 1279px)");
  const [userCollapsed, setUserCollapsed] = useState<boolean | null>(() => {
    try {
      const v = localStorage.getItem(COLLAPSE_KEY);
      return v === null ? null : v === "1";
    } catch {
      return null;
    }
  });
  const [drawer, setDrawer] = useState(false);
  // Collapsed below 1280px unless the user chose otherwise.
  const collapsed = userCollapsed ?? narrow;

  useEffect(() => setDrawer(false), [loc.pathname]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  const badges = useMemo(() => {
    const due = db.leads.filter((l) => followUpDue(l, now) && (user.role !== "admissions" || l.ownerId === user.id)).length;
    return due ? { leads: due } : undefined;
  }, [db.leads, now, user]);

  const active = activeNavKey(user.role, loc.pathname);
  const onNavigate = (key: string) => nav(navPath(user.role, key));
  const shell = useMemo(() => ({ isMobile, openDrawer: () => setDrawer(true) }), [isMobile]);

  return (
    <ShellCtx.Provider value={shell}>
      <div className="app-admin">
        {!isMobile ? (
          <div className="app-admin-side">
            <Sidebar
              role={user.role}
              active={active}
              collapsed={collapsed}
              badges={badges}
              brand={db.settings.orgName}
              onNavigate={onNavigate}
              onToggle={() => {
                const next = !collapsed;
                setUserCollapsed(next);
                try {
                  localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
                } catch {
                  /* ignore */
                }
              }}
            />
          </div>
        ) : null}
        <div className="app-admin-main">
          {/* Keeps the sidebar in place while a screen's code loads. */}
          <Suspense fallback={<div className="app-loading" aria-busy="true" />}>
            {children}
          </Suspense>
        </div>
        {isMobile && drawer ? (
          <div className="app-drawer" onMouseDown={(e) => e.target === e.currentTarget && setDrawer(false)}>
            <Sidebar role={user.role} active={active} badges={badges} brand={db.settings.orgName} onNavigate={onNavigate} />
          </div>
        ) : null}
      </div>
    </ShellCtx.Provider>
  );
}
