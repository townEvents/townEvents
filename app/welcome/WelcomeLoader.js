"use client";

import dynamic from "next/dynamic";
import "../globals.css";

// Client-only for the same reason as the home page: "this week" depends on the
// clock, so skipping server rendering avoids hydration mismatches.
const Welcome = dynamic(() => import("./Welcome"), { ssr: false });

export default function WelcomeLoader() {
  return <Welcome />;
}
