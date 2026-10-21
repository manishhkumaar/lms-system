import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx, isTopOverlay, popOverlay, pushOverlay, useMounted } from "../utils";
import { Button } from "./Button";

export interface DialogProps {
  /** The action ("Transfer student"); the primary button repeats it. */
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons, secondary first, primary last. */
  footer?: ReactNode;
  onClose?: () => void;
  open?: boolean;
  width?: number;
  /** Renders in place (for previews and docs). */
  inline?: boolean;
  /** Wraps body and footer in a form; Enter submits. */
  onSubmit?: () => void;
}

/** A modal for short, focused tasks. Becomes a bottom sheet on mobile. */
export function Dialog({ title, description, children, footer, onClose, open, width, inline, onSubmit }: DialogProps) {
  const titleId = useId();
  const mounted = useMounted();
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const visible = open !== false;

  useEffect(() => {
    if (!visible || inline) return;
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const overlay = pushOverlay();
    const focusable = node?.querySelector<HTMLElement>(".bl-dialog-body input, .bl-dialog-body select, .bl-dialog-body textarea, .bl-dialog-body button, .bl-dialog-foot button");
    (focusable || node)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (!isTopOverlay(overlay)) return;
      if (e.key === "Escape") onCloseRef.current?.();
      if (e.key === "Tab" && node) {
        const els = Array.from(node.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")).filter((el) => !el.hasAttribute("disabled"));
        if (!els.length) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      popOverlay(overlay);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [visible, inline]);

  if (!visible) return null;

  const inner = (
    <>
      <div className="bl-dialog-body">{children}</div>
      {footer ? <div className="bl-dialog-foot">{footer}</div> : null}
    </>
  );

  const node = (
    <div
      className={cx("bl-scrim", inline && "inline")}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div ref={ref} tabIndex={-1} className="bl-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} style={width ? { maxWidth: width } : undefined}>
        <div className="bl-dialog-head">
          <div style={{ flex: 1 }}>
            <h2 className="bl-dialog-title" id={titleId}>
              {title}
            </h2>
            {description ? <p className="bl-dialog-desc">{description}</p> : null}
          </div>
          <Button variant="ghost" icon="x" aria-label="Close" onClick={onClose} />
        </div>
        {onSubmit ? (
          <form
            className="bl-dialog-form"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            {inner}
          </form>
        ) : (
          inner
        )}
      </div>
    </div>
  );

  if (inline) return node;
  return mounted ? createPortal(node, document.body) : null;
}
