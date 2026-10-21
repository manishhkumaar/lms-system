import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "../utils";
import { Icon, type IconName } from "./Icon";

export type MenuItem =
  | { label: string; icon?: IconName; onClick?: () => void; danger?: boolean; checked?: boolean; disabled?: boolean; hint?: string }
  | "separator";

interface TriggerProps {
  onClick: () => void;
  "aria-expanded": boolean;
  "aria-haspopup": "menu";
}

export interface MenuProps {
  trigger: (props: TriggerProps) => ReactNode;
  items: MenuItem[];
  align?: "start" | "end";
  header?: ReactNode;
}

/** A small dropdown menu (shadow-md, z-dropdown). Closes on outside click and Escape. */
export function Menu({ trigger, items, align = "start", header }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    const first = ref.current?.querySelector<HTMLButtonElement>(".bl-menu-item:not(:disabled)");
    first?.focus();
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="bl-menu-wrap" ref={ref}>
      {trigger({ onClick: () => setOpen((o) => !o), "aria-expanded": open, "aria-haspopup": "menu" })}
      {open ? (
        <div className={cx("bl-menu", align === "end" && "end")} role="menu">
          {header ? <div className="bl-menu-header">{header}</div> : null}
          {items.map((it, i) =>
            it === "separator" ? (
              <div key={i} className="bl-menu-sep" role="separator" />
            ) : (
              <button
                key={i}
                type="button"
                role={it.checked !== undefined ? "menuitemradio" : "menuitem"}
                aria-checked={it.checked}
                className={cx("bl-menu-item", it.danger && "danger")}
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false);
                  it.onClick?.();
                }}
              >
                {it.checked !== undefined ? <Icon name="check" className={cx("bl-menu-check", !it.checked && "off")} /> : it.icon ? <Icon name={it.icon} /> : null}
                <span>{it.label}</span>
                {it.hint ? <span className="bl-menu-hint">{it.hint}</span> : null}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
