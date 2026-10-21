import { useState } from "react";

export interface TabItem {
  value: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}

/** Switches between views of one record. Seven tabs or fewer. */
export function Tabs({ items, value, defaultValue, onChange }: TabsProps) {
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue || items[0]?.value);
  const cur = controlled ? value : inner;
  return (
    <div className="bl-tabs" role="tablist">
      {items.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          className="bl-tab"
          aria-selected={cur === t.value ? "true" : "false"}
          onClick={() => {
            if (!controlled) setInner(t.value);
            onChange?.(t.value);
          }}
        >
          {t.label}
          {t.count != null ? <span className="bl-tab-count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
