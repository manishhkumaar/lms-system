import { useState, type ReactNode } from "react";

export interface ToggleProps {
  label: ReactNode;
  description?: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}

/** An on/off switch for a setting that applies immediately. */
export function Toggle({ label, description, checked, defaultChecked, disabled, onChange }: ToggleProps) {
  const controlled = checked !== undefined;
  const [inner, setInner] = useState(!!defaultChecked);
  const on = controlled ? checked : inner;
  return (
    <label className="bl-toggle">
      <input
        type="checkbox"
        role="switch"
        checked={on}
        disabled={disabled}
        onChange={(e) => {
          if (!controlled) setInner(e.target.checked);
          onChange?.(e.target.checked);
        }}
      />
      <span className="bl-toggle-track" aria-hidden="true" />
      <span>
        {label}
        {description ? (
          <span className="bl-toggle-state" style={{ display: "block" }}>
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
