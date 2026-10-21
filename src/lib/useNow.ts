import { useEffect, useState } from "react";

/** Current time in ms, refreshed every `intervalMs`. Drives live / ended states on screen. */
export function useNow(intervalMs = 15000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Sets document.title as "<page> · Batch LMS". */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Batch LMS` : "Batch LMS";
  }, [title]);
}
