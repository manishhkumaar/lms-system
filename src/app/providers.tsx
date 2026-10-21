"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AuthProvider } from "@/auth/AuthContext";
import { ErrorBoundary } from "@/core/ErrorBoundary";
import { ToastProvider } from "@/design-system";

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <ToastProvider>
      <AuthProvider>
        <ErrorBoundary resetKey={pathname || ""}>{children}</ErrorBoundary>
      </AuthProvider>
    </ToastProvider>
  );
}
