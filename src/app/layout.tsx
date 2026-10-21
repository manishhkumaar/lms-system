import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense, type ReactNode } from "react";
import "@/design-system/tokens.css";
import "@/design-system/components.css";
import "@/design-system/extensions.css";
import "@/styles/app.css";
import { Providers } from "./providers";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Batch LMS",
  description: "Courses, batches, live classes and leads, in one calm workspace.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Applies the saved theme before first paint so there's no flash. Light is the default.
const themeScript = `(function(){var t="light";try{t=localStorage.getItem("batch-lms:theme")||"light"}catch(e){}if(t!=="system")document.documentElement.setAttribute("data-theme",t==="dark"?"dark":"light")})()`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>
          <Suspense>{children}</Suspense>
        </Providers>
      </body>
    </html>
  );
}
