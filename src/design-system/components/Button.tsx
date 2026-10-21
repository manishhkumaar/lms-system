import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "../utils";
import { Icon, type IconName } from "./Icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: IconName;
  iconRight?: IconName;
  /** 44px height for the student portal. */
  touch?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", icon, iconRight, touch, block, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      {...rest}
      className={cx("bl-btn", `bl-btn-${variant}`, touch && "bl-btn-touch", block && "bl-btn-block", !children && "bl-btn-icon", className)}
    >
      {icon ? <Icon name={icon} /> : null}
      {children != null && children !== false ? <span className="bl-btn-label">{children}</span> : null}
      {iconRight ? <Icon name={iconRight} /> : null}
    </button>
  );
});
