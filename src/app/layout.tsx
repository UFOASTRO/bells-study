"use client";

import { useEffect } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Clean up extension-added attributes on mount
  useEffect(() => {
    const body = document.body;
    // Remove extension-added classes and attributes
    body.removeAttribute("cz-shortcut-listen");
    body.removeAttribute("data-new-gr-c-s-check-loaded");
    body.removeAttribute("data-gr-ext-installed");
    
    // Remove extension-added class
    body.className = body.className
      .replace("clickup-chrome-ext_installed", "")
      .trim();
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <footer className="w-full text-center py-6 text-gray-500 text-sm">
          &copy; 2025 <span className="font-semibold text-purple-400">Oluwanifemi</span>. All rights reserved.
        </footer>
      </body>
    </html>
  );
}
