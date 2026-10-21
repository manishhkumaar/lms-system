/*
 * Components the app needed that the design system didn't ship, drawn from the same tokens and rules.
 * See src/design-system/README.md for usage notes.
 */
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx, initials, isTopOverlay, popOverlay, pushOverlay, useMounted, type Tone } from "../utils";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";

/* ---------- Card ---------- */
export interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  /** Remove body padding (for tables and lists that run edge to edge). */
  flush?: boolean;
  className?: string;
}

export function Card({ title, description, actions, children, flush, className }: CardProps) {
  return (
    <section className={cx("bl-card", className)}>
      {title || actions ? (
        <div className="bl-card-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            {title ? <h3 className="bl-card-title">{title}</h3> : null}
            {description ? <p className="bl-card-desc">{description}</p> : null}
          </div>
          {actions ? <div className="bl-row">{actions}</div> : null}
        </div>
      ) : null}
      <div className={flush ? undefined : "bl-card-body"}>{children}</div>
    </section>
  );
}

/* ---------- Section header (h2 inside a page) ---------- */
export function SectionHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="bl-section-head">
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 className="t-h2" style={{ margin: 0 }}>
          {title}
        </h2>
        {description ? <p className="bl-card-desc">{description}</p> : null}
      </div>
      {actions ? <div className="bl-row">{actions}</div> : null}
    </div>
  );
}

/* ---------- Banner ---------- */
const TONE_ICON: Record<Tone, IconName> = { neutral: "alert", info: "alert", success: "check", warning: "alert", danger: "alert" };

export function Banner({ tone = "info", title, children, action, icon }: { tone?: Tone; title?: ReactNode; children?: ReactNode; action?: ReactNode; icon?: IconName }) {
  return (
    <div className={cx("bl-banner", `bl-banner-${tone}`)} role={tone === "danger" || tone === "warning" ? "alert" : "status"}>
      <Icon name={icon || TONE_ICON[tone]} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {title ? <div className="bl-banner-title">{title}</div> : null}
        {children ? <div>{children}</div> : null}
      </div>
      {action ? <div className="bl-banner-action">{action}</div> : null}
    </div>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={cx("bl-avatar", size !== "md" && `bl-avatar-${size}`)} title={name} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

/* ---------- MetaList: label/value pairs on detail pages ---------- */
export function MetaList({ items, columns = 2 }: { items: Array<{ label: ReactNode; value: ReactNode; mono?: boolean }>; columns?: 1 | 2 | 3 | 4 }) {
  return (
    <dl className="bl-meta" style={{ ["--cols" as string]: columns }}>
      {items.map((it, i) => (
        <div key={i} className="bl-meta-item">
          <dt>{it.label}</dt>
          <dd className={it.mono ? "bl-mono" : undefined}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------- SegmentedControl: Table / Kanban view switch ---------- */
export function SegmentedControl<V extends string>({ options, value, onChange, label }: { options: Array<{ value: V; label: string; icon?: IconName }>; value: V; onChange: (v: V) => void; label: string }) {
  return (
    <div className="bl-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className="bl-seg-item" onClick={() => onChange(o.value)}>
          {o.icon ? <Icon name={o.icon} /> : null}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- SidePanel: lead notes, quick details ---------- */
export function SidePanel({ open, title, description, onClose, children, footer, width = 440 }: { open: boolean; title: ReactNode; description?: ReactNode; onClose: () => void; children?: ReactNode; footer?: ReactNode; width?: number }) {
  const titleId = useId();
  const mounted = useMounted();
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const overlay = pushOverlay();
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isTopOverlay(overlay)) onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      popOverlay(overlay);
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open]);
  if (!open || !mounted) return null;
  return createPortal(
    <div
      className="bl-scrim bl-panel-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside ref={ref} tabIndex={-1} className="bl-panel" role="dialog" aria-modal="true" aria-labelledby={titleId} style={{ maxWidth: width }}>
        <div className="bl-dialog-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="bl-dialog-title" id={titleId}>
              {title}
            </h2>
            {description ? <div className="bl-dialog-desc">{description}</div> : null}
          </div>
          <Button variant="ghost" icon="x" aria-label="Close" onClick={onClose} />
        </div>
        <div className="bl-panel-body">{children}</div>
        {footer ? <div className="bl-dialog-foot">{footer}</div> : null}
      </aside>
    </div>,
    document.body,
  );
}

/* ---------- Toasts ---------- */
export interface ToastInput {
  title: string;
  description?: string;
  tone?: Tone;
}
interface ToastItem extends ToastInput {
  id: number;
}

const ToastCtx = createContext<(t: ToastInput) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const mounted = useMounted();
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (t: ToastInput) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-3), { ...t, id }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {mounted && createPortal(
        <div className="bl-toasts" aria-live="polite">
          {items.map((t) => (
            <div key={t.id} className={cx("bl-toast", t.tone && `bl-toast-${t.tone}`)} role="status">
              <Icon name={t.tone === "danger" || t.tone === "warning" ? "alert" : "check"} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="bl-toast-title">{t.title}</div>
                {t.description ? <div className="bl-toast-desc">{t.description}</div> : null}
              </div>
              <button type="button" className="bl-toast-x" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
                <Icon name="x" />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

/* ---------- BottomNav: student portal tab bar under 768px ---------- */
export function BottomNav({ items, active, onNavigate }: { items: Array<{ key: string; label: string; icon: IconName }>; active?: string; onNavigate: (key: string) => void }) {
  return (
    <nav className="bl-bottomnav" aria-label="Main">
      {items.map((it) => (
        <button key={it.key} type="button" className="bl-bottomnav-item" aria-current={active === it.key ? "page" : undefined} onClick={() => onNavigate(it.key)}>
          <Icon name={it.icon} size="lg" />
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  );
}

/* ---------- CopyField: a read-only mono value with a copy button (links, IDs) ---------- */
export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="bl-copy">
      <code className="bl-mono" title={value}>
        {value}
      </code>
      <Button
        variant="ghost"
        icon={copied ? "check" : "copy"}
        aria-label={label ? `Copy ${label}` : "Copy"}
        onClick={() => {
          navigator.clipboard?.writeText(value).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            },
            () => {},
          );
        }}
      />
    </div>
  );
}
