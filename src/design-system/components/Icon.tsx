import { cx } from "../utils";

/* 24-unit stroke set, 1.75 stroke, round caps. Drawn in currentColor. */
const P = {
  home: ["M3 10.5 12 3l9 7.5", "M5 9.5V21h14V9.5", "M9.5 21v-6h5v6"],
  users: ["M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20", "M10 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z", "M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35", "M15.5 4.65a3.5 3.5 0 0 1 0 6.7"],
  inbox: ["M3 13h5l1.5 3h5L16 13h5", "M5.5 5h13L21 13v6H3v-6z"],
  book: ["M4 19.5V5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2v0a2 2 0 0 0 2 2h14"],
  layers: ["M12 3 2.5 8 12 13l9.5-5z", "M2.5 12.5 12 17.5l9.5-5", "M2.5 16.5 12 21.5l9.5-5"],
  calendar: ["M4 6h16v15H4z", "M4 10.5h16", "M8.5 3v4", "M15.5 3v4"],
  video: ["M3 6.5h12v11H3z", "M15 10.5l6-3.5v10l-6-3.5"],
  check: ["M4 12.5l5 5L20 6.5"],
  checklist: ["M4 5h16v15H4z", "M8 12l2.5 2.5L16 9"],
  chart: ["M4 20V4", "M4 20h16", "M8 16v-5", "M12.5 16V8", "M17 16v-3"],
  shield: ["M12 3l8 3v6c0 4.5-3.4 8.1-8 9-4.6-.9-8-4.5-8-9V6z"],
  settings: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M12 2.5v3", "M12 18.5v3", "M2.5 12h3", "M18.5 12h3", "M5.3 5.3l2.1 2.1", "M16.6 16.6l2.1 2.1", "M5.3 18.7l2.1-2.1", "M16.6 7.4l2.1-2.1"],
  search: ["M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15z", "M16 16l5 5"],
  plus: ["M12 5v14", "M5 12h14"],
  filter: ["M3.5 5h17l-6.5 8v6l-4-2v-4z"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7.5V12l3 2"],
  link: ["M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1", "M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"],
  play: ["M7 4.5v15l12-7.5z"],
  x: ["M6 6l12 12", "M18 6 6 18"],
  chevronLeft: ["M15 5l-7 7 7 7"],
  chevronRight: ["M9 5l7 7-7 7"],
  chevronDown: ["M5 9l7 7 7-7"],
  user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4.5 21a7.5 7.5 0 0 1 15 0"],
  file: ["M6 3h8l5 5v13H6z", "M14 3v5h5", "M9 13h7", "M9 17h5"],
  bell: ["M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z", "M10 20.5a2 2 0 0 0 4 0"],
  menu: ["M4 6.5h16", "M4 12h16", "M4 17.5h16"],
  upload: ["M12 15V4", "M7.5 8.5 12 4l4.5 4.5", "M4 15v5h16v-5"],
  alert: ["M12 3.5 2.5 20h19z", "M12 10v4.5", "M12 17.5v.01"],
  more: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
  phone: ["M5 3.5h4l2 5-2.5 1.5a11 11 0 0 0 5.5 5.5l1.5-2.5 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5.5a2 2 0 0 1 2-2z"],
  graduation: ["M2.5 9 12 4.5 21.5 9 12 13.5z", "M6.5 11v5c1.5 1.5 3.5 2.5 5.5 2.5s4-1 5.5-2.5v-5", "M21.5 9v5.5"],
  transfer: ["M4 8h14", "M14.5 4.5 18 8l-3.5 3.5", "M20 16H6", "M9.5 12.5 6 16l3.5 3.5"],
  /* Added in the same style for the app. */
  mail: ["M3.5 5.5h17v13h-17z", "M3.5 6.5 12 13l8.5-6.5"],
  logout: ["M14 4h5v16h-5", "M10 16.5 14.5 12 10 7.5", "M14.5 12H4"],
  edit: ["M4 20h4L19 9l-4-4L4 16z", "M13.5 6.5l4 4"],
  trash: ["M4.5 7h15", "M9.5 7V4.5h5V7", "M6.5 7l1 13h9l1-13"],
  copy: ["M8.5 8.5h11v11h-11z", "M15.5 8.5v-4h-11v11h4"],
  external: ["M13.5 4.5h6v6", "M19.5 4.5 11 13", "M18 14v5.5H4.5V6H10"],
  sun: ["M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M12 2.5v2", "M12 19.5v2", "M2.5 12h2", "M19.5 12h2", "M5.3 5.3l1.4 1.4", "M17.3 17.3l1.4 1.4", "M5.3 18.7l1.4-1.4", "M17.3 6.7l1.4-1.4"],
  moon: ["M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"],
  lock: ["M5.5 11h13v9.5h-13z", "M8.5 11V8a3.5 3.5 0 0 1 7 0v3"],
  note: ["M5 4h14v16H5z", "M8.5 9h7", "M8.5 12.5h7", "M8.5 16h4"],
  grid: ["M4 4h7v7H4z", "M13 4h7v7h-7z", "M4 13h7v7H4z", "M13 13h7v7h-7z"],
  list: ["M9 6.5h11", "M9 12h11", "M9 17.5h11", "M4.5 6.5h.01", "M4.5 12h.01", "M4.5 17.5h.01"],
  download: ["M12 4v11", "M7.5 10.5 12 15l4.5-4.5", "M4 15v5h16v-5"],
} satisfies Record<string, string[]>;

export type IconName = keyof typeof P;
export const iconNames = Object.keys(P) as IconName[];

export interface IconProps {
  name: IconName | (string & {});
  size?: "lg";
  label?: string;
  className?: string;
}

export function Icon({ name, size, label, className }: IconProps) {
  const paths = (P as Record<string, string[]>)[name] || P.more;
  return (
    <svg
      className={cx("bl-icon", size === "lg" && "bl-icon-lg", className)}
      viewBox="0 0 24 24"
      aria-hidden={label ? undefined : "true"}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
