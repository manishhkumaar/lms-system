import type { ReactNode } from "react";
import { cx } from "../utils";
import { Icon } from "./Icon";
import { Menu } from "./Menu";

export interface FilterDef {
  label: string;
  /** A pill with a value is shown as applied ("Batch: FSW-07"). */
  value?: string;
  onClick?: () => void;
  /** When given, the pill opens a menu of these choices plus "Any". */
  options?: Array<string | { value: string; label: string }>;
  /** Called with the chosen option's value, or undefined for "Any". */
  onSelect?: (value: string | undefined) => void;
}

export interface FilterBarProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearch?: (q: string) => void;
  filters?: FilterDef[];
  /** Actions such as Export or a Table/Kanban view switch. */
  end?: ReactNode;
}

function Pill({ f, ...rest }: { f: FilterDef; onClick?: () => void; "aria-expanded"?: boolean; "aria-haspopup"?: "menu" }) {
  return (
    <button type="button" className={cx("bl-filter-pill", f.value && "on")} {...rest}>
      <Icon name={f.value ? "check" : "plus"} />
      {f.label}
      {f.value ? `: ${f.value}` : null}
    </button>
  );
}

/** The search box and filter pills at the top of a DataTable or Kanban board. */
export function FilterBar({ searchPlaceholder, searchValue, onSearch, filters = [], end }: FilterBarProps) {
  return (
    <div className="bl-filters">
      <div className="bl-search">
        <Icon name="search" />
        <input
          className="bl-input"
          placeholder={searchPlaceholder || "Search"}
          aria-label={searchPlaceholder || "Search"}
          value={searchValue}
          onChange={onSearch ? (e) => onSearch(e.target.value) : undefined}
        />
      </div>
      {filters.map((f) =>
        f.options ? (
          <Menu
            key={f.label}
            trigger={(p) => <Pill f={f} {...p} />}
            items={[
              { label: "Any", checked: !f.value, onClick: () => f.onSelect?.(undefined) },
              "separator",
              ...f.options.map((o) => {
                const opt = typeof o === "string" ? { value: o, label: o } : o;
                return { label: opt.label, checked: f.value === opt.label || f.value === opt.value, onClick: () => f.onSelect?.(opt.value) };
              }),
            ]}
          />
        ) : (
          <Pill key={f.label} f={f} onClick={f.onClick} />
        ),
      )}
      {end ? <div className="bl-filters-end">{end}</div> : null}
    </div>
  );
}
