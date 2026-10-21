"use client";
import type { ReactNode } from "react";
import { useDbMaybe } from "@/data/store";
import { useDocumentTitle } from "@/lib/useNow";

/** Centred card on surface, radius-lg, space-8 from the top. */
export function AuthLayout({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useDocumentTitle(title);
  const db = useDbMaybe();
  return (
    <div className="app-auth">
      <div className="app-auth-brand">
        <span className="bl-sidebar-mark" aria-hidden="true">
          B
        </span>
        <span>{db?.settings.orgName || "Batch LMS"}</span>
      </div>
      <main className="app-auth-card">
        <h1 className="t-h2" style={{ margin: 0 }}>
          {title}
        </h1>
        {description ? <p className="app-auth-desc">{description}</p> : null}
        {children}
      </main>
      {footer ? <div className="app-auth-foot">{footer}</div> : null}
    </div>
  );
}
