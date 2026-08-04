"use client";

import dynamic from "next/dynamic";
import "./globals.css";

// Loaded client-only: this page is date/time-driven (today's events, month
// view, etc.), so skipping server rendering avoids server/browser clock or
// timezone mismatches that can cause React hydration errors.
const BulletinBoard = dynamic(() => import("./BulletinBoard"), { ssr: false });

export default function Page() {
  return <BulletinBoard />;
}
