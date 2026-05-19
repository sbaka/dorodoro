import type { Metadata, Viewport } from "next";
import { Bubblegum_Sans, DM_Sans } from "next/font/google";
import "./globals.css";

import { PwaProvider } from "@/app/pwa-provider";
import { Providers } from "@/app/providers";
import { cn } from "@/lib/utils";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm" });

const bubblegumSans = Bubblegum_Sans({
  variable: "--font-brand",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "DoroDoro",
    template: "%s | DoroDoro",
  },
  applicationName: "DoroDoro",
  description:
    "A calmer Pomodoro workspace for focused study sessions, breaks, dashboards, and planning.",
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DoroDoro",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcut: [
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#d92828",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(dmSans.variable, bubblegumSans.variable)}
    >
      <body>
        <PwaProvider />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
