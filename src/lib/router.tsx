"use client";
/*
 * The few routing APIs the screens use (Link, useNavigate, useParams, useSearchParams, useLocation,
 * Navigate), implemented on Next.js App Router navigation. Screens import from here, not from next/*,
 * so they read the same as before the move to Next.js.
 */
import NextLink from "next/link";
import { useParams as useNextParams, usePathname, useRouter, useSearchParams as useNextSearchParams } from "next/navigation";
import { forwardRef, useCallback, useEffect, useMemo, type AnchorHTMLAttributes, type ReactNode } from "react";

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: string;
  replace?: boolean;
  children?: ReactNode;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ to, replace, ...rest }, ref) {
  return <NextLink ref={ref} href={to} replace={replace} {...rest} />;
});

export interface NavigateOptions {
  replace?: boolean;
}

/** navigate("/admin/leads"), navigate(path, { replace: true }), navigate(-1). */
export function useNavigate() {
  const router = useRouter();
  return useCallback(
    (to: string | number, opts?: NavigateOptions) => {
      if (typeof to === "number") {
        if (to < 0) router.back();
        else router.forward();
        return;
      }
      if (opts?.replace) router.replace(to, { scroll: false });
      else router.push(to);
    },
    [router],
  );
}

/** Route params of the current page, e.g. { batchId } on /admin/batches/[batchId]. */
export function useParams<T extends Record<string, string> = Record<string, string>>(): Partial<T> {
  return (useNextParams() || {}) as Partial<T>;
}

type ParamsInit = URLSearchParams | Record<string, string> | string;

function toParams(init: ParamsInit): URLSearchParams {
  return init instanceof URLSearchParams ? init : new URLSearchParams(init);
}

/** [params, setParams] like React Router: setParams(next | prev => next, { replace }). */
export function useSearchParams(): [URLSearchParams, (next: ParamsInit | ((prev: URLSearchParams) => ParamsInit), opts?: NavigateOptions) => void] {
  const current = useNextSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const params = useMemo(() => new URLSearchParams(current?.toString() || ""), [current]);
  const set = useCallback(
    (next: ParamsInit | ((prev: URLSearchParams) => ParamsInit), opts?: NavigateOptions) => {
      const value = toParams(typeof next === "function" ? next(new URLSearchParams(params.toString())) : next);
      const qs = value.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (opts?.replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [params, pathname, router],
  );
  return [params, set];
}

export function useLocation() {
  const pathname = usePathname() || "/";
  const search = useNextSearchParams()?.toString() || "";
  return { pathname, search: search ? `?${search}` : "" };
}

/** Redirects on render. */
export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (replace) router.replace(to);
    else router.push(to);
  }, [router, to, replace]);
  return null;
}
