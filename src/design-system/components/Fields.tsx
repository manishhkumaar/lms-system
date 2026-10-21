import { useId, type CSSProperties, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "../utils";

interface ShellProps {
  id: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  style?: CSSProperties;
  className?: string;
  children: ReactNode;
}

function FieldShell({ id, label, hint, error, required, style, className, children }: ShellProps) {
  return (
    <div className={cx("bl-field", className)} style={style}>
      {label ? (
        <label className="bl-field-label" htmlFor={id}>
          {label}
          {required ? (
            <span className="bl-field-req" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <span className="bl-field-error" id={`${id}-msg`}>
          {error}
        </span>
      ) : hint ? (
        <span className="bl-field-hint" id={`${id}-msg`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Geist Mono for meeting links, IDs and codes. */
  mono?: boolean;
}

export function TextField({ label, hint, error, mono, style, id, className, type = "text", ...rest }: TextFieldProps) {
  const auto = useId();
  const fid = id || auto;
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} required={rest.required} style={style} className={className}>
      <input
        type={type}
        {...rest}
        id={fid}
        className={cx("bl-input", mono && "bl-input-mono")}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error || hint ? `${fid}-msg` : undefined}
      />
    </FieldShell>
  );
}

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

export function TextAreaField({ label, hint, error, style, id, className, rows = 4, ...rest }: TextAreaFieldProps) {
  const auto = useId();
  const fid = id || auto;
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} required={rest.required} style={style} className={className}>
      <textarea
        rows={rows}
        {...rest}
        id={fid}
        className="bl-input bl-textarea"
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error || hint ? `${fid}-msg` : undefined}
      />
    </FieldShell>
  );
}

export type SelectOption = string | { value: string; label: string; disabled?: boolean };

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  options: SelectOption[];
  /** Adds a first, empty option ("Choose a batch"). */
  placeholder?: string;
}

export function SelectField({ label, hint, error, style, id, className, options, placeholder, ...rest }: SelectFieldProps) {
  const auto = useId();
  const fid = id || auto;
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} required={rest.required} style={style} className={className}>
      <select
        {...rest}
        id={fid}
        className="bl-input"
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error || hint ? `${fid}-msg` : undefined}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => {
          const opt = typeof o === "string" ? { value: o, label: o } : o;
          return (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          );
        })}
      </select>
    </FieldShell>
  );
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  description?: ReactNode;
}

/** For choices inside a form that is saved later. Settings that apply immediately use Toggle. */
export function Checkbox({ label, description, className, ...rest }: CheckboxProps) {
  return (
    <label className={cx("bl-check", className)}>
      <input type="checkbox" {...rest} />
      <span>
        {label}
        {description ? <span className="bl-toggle-state" style={{ display: "block" }}>{description}</span> : null}
      </span>
    </label>
  );
}
