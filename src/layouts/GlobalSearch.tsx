"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@/lib/router";
import { canAccess } from "@/core/access";
import { useUser } from "@/auth/AuthContext";
import { useDb } from "@/data/store";
import { getCourse } from "@/data/selectors";
import { Icon, type IconName } from "@/design-system";

interface Hit {
  key: string;
  icon: IconName;
  label: string;
  sub: string;
  to: string;
}

/** Topbar search across students, batches, leads and courses the user can open. */
export function GlobalSearch() {
  const db = useDb();
  const user = useUser();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const hits = useMemo<Hit[]>(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    const has = (...xs: Array<string | undefined>) => xs.some((x) => x?.toLowerCase().includes(s));
    const out: Hit[] = [];
    if (canAccess(user.role, "students"))
      db.students
        .filter((x) => has(x.name, x.email, x.phone))
        .slice(0, 5)
        .forEach((x) => out.push({ key: x.id, icon: "user", label: x.name, sub: `Student · ${x.email}`, to: `/admin/students/${x.id}` }));
    if (canAccess(user.role, "batches"))
      db.batches
        .filter((x) => has(x.code, x.name))
        .slice(0, 5)
        .forEach((x) => out.push({ key: x.id, icon: "layers", label: x.name, sub: `Batch · ${x.code}`, to: `/admin/batches/${x.id}` }));
    if (canAccess(user.role, "leads"))
      db.leads
        .filter((x) => has(x.name, x.email, x.phone))
        .slice(0, 5)
        .forEach((x) => out.push({ key: x.id, icon: "inbox", label: x.name, sub: `Lead · ${getCourse(db, x.courseId)?.title || ""}`, to: `/admin/leads?lead=${x.id}` }));
    if (canAccess(user.role, "courses"))
      db.courses
        .filter((x) => has(x.title, x.code))
        .slice(0, 5)
        .forEach((x) => out.push({ key: x.id, icon: "book", label: x.title, sub: `Course · ${x.code}`, to: `/admin/courses/${x.id}` }));
    return out.slice(0, 12);
  }, [q, db, user.role]);

  useEffect(() => setCursor(0), [q]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const go = (h: Hit) => {
    setOpen(false);
    setQ("");
    nav(h.to);
  };

  return (
    <div className="bl-search app-gsearch" ref={ref}>
      <Icon name="search" />
      <input
        className="bl-input"
        placeholder="Search students, batches, leads…"
        aria-label="Search"
        role="combobox"
        aria-expanded={open && q.trim().length >= 2}
        aria-controls="gsearch-list"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setCursor((c) => Math.min(c + 1, hits.length - 1));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setCursor((c) => Math.max(c - 1, 0));
          }
          if (e.key === "Enter" && hits[cursor]) go(hits[cursor]);
        }}
      />
      {open && q.trim().length >= 2 ? (
        <div className="bl-menu app-gsearch-menu" id="gsearch-list" role="listbox">
          {hits.length ? (
            hits.map((h, i) => (
              <button key={h.key} type="button" role="option" aria-selected={i === cursor} className="bl-menu-item app-gsearch-item" onMouseEnter={() => setCursor(i)} onClick={() => go(h)}>
                <Icon name={h.icon} />
                <span style={{ minWidth: 0 }}>
                  <span className="app-gsearch-label">{h.label}</span>
                  <span className="app-gsearch-sub">{h.sub}</span>
                </span>
              </button>
            ))
          ) : (
            <div className="bl-menu-header" style={{ border: 0 }}>
              No students, batches or leads match "{q.trim()}"
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
