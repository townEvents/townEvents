"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { todayStrEastern, daysBetween } from "../../lib/dates";
import { cleanScanCode } from "../../lib/scanCodes";

const CATS = {
  Music: "#9A3324",
  Market: "#C68E17",
  "Kids & Family": "#4A6C8C",
  "Meeting / Civic": "#3F5443",
  "Sports & Rec": "#B5651D",
  "Arts & Culture": "#6B4E71",
  Other: "#6B5D4F",
};

const PREVIEW_COUNT = 3;

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function formatShortDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function Welcome() {
  const today = todayStrEastern();

  const [events, setEvents] = useState([]);
  const [email, setEmail] = useState("");
  const [subStatus, setSubStatus] = useState(""); // "", "success", "duplicate", "error", "invalid"
  const [signedUpEmail, setSignedUpEmail] = useState("");

  const turnstileContainerRef = useRef(null);
  const turnstileWidgetIdRef = useRef(null);
  const turnstileTokenRef = useRef("");

  // Ad links look like /welcome?sc=business9001. Same handling as the home
  // page: count the visit once, keep the code in memory so a signup on this
  // page is credited to it, then tidy it off the address bar.
  const scCodeRef = useRef(null);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (!params.has("sc")) return;
      const code = cleanScanCode(params.get("sc"));
      params.delete("sc");
      const rest = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash);
      if (!code) return;
      scCodeRef.current = code;
      fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
        keepalive: true,
      }).catch(() => {});
    } catch (err) {
      // Counting is best-effort and must never get in the way of the page.
    }
  }, []);

  // Invisible Cloudflare Turnstile check, same as the home page signup.
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return;

    function renderWidget() {
      if (!window.turnstile || !turnstileContainerRef.current || turnstileWidgetIdRef.current) return;
      turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
        action: "newsletter_signup",
        appearance: "interaction-only",
        callback: (token) => {
          turnstileTokenRef.current = token;
        },
      });
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.onload = renderWidget;
      document.body.appendChild(script);
    }
  }, []);

  // The next few approved events in the coming week. If this fails the section
  // simply doesn't show - the signup is the point of this page.
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, date, time, town, location, category")
        .eq("status", "approved")
        .gte("date", today)
        .order("date", { ascending: true });
      if (error || !data) return;
      const upcoming = data
        .filter((e) => daysBetween(today, e.date) <= 7)
        .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
        .slice(0, PREVIEW_COUNT);
      setEvents(upcoming);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubscribe(ev) {
    ev.preventDefault();
    if (!isValidEmail(email)) {
      setSubStatus("invalid");
      return;
    }
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), turnstileToken: turnstileTokenRef.current, sc: scCodeRef.current }),
      });
      const data = await res.json();

      // Each Turnstile token is single-use, so get a fresh one ready.
      if (window.turnstile && turnstileWidgetIdRef.current) {
        window.turnstile.reset(turnstileWidgetIdRef.current);
        turnstileTokenRef.current = "";
      }

      if (!res.ok) {
        setSubStatus(data.error === "invalid" ? "invalid" : "error");
        return;
      }
      if (data.duplicate) {
        setSubStatus("duplicate");
        return;
      }
      setSignedUpEmail(email.trim().toLowerCase());
      setSubStatus("success");
      setEmail("");
    } catch (err) {
      setSubStatus("error");
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#EDE4CC", color: "#2B2420", fontFamily: "'Source Serif 4', Georgia, serif" }}>
      <style>{`
        .be-label { font-family: 'Barlow Condensed', sans-serif; text-transform: uppercase; letter-spacing: 0.08em; }
        .be-btn { cursor: pointer; border: none; font-family: 'Barlow Condensed', sans-serif; text-transform: uppercase; letter-spacing: 0.08em; }
        .be-btn:focus-visible, input:focus-visible, a:focus-visible { outline: 2px solid #9A3324; outline-offset: 2px; }
        .wl-form { display: flex; gap: 10px; flex-wrap: wrap; }
        .wl-form input { flex: 1 1 240px; }
        @media (max-width: 520px) { .wl-form button { width: 100%; } }
      `}</style>

      <header style={{ borderBottom: "3px double #2B2420", padding: "22px 20px 24px", background: "#E8DFC4" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <div className="be-label" style={{ fontSize: 12.5, color: "#9A3324", fontWeight: 600 }}>
            Rutherford · East Rutherford · Carlstadt · Lyndhurst · North Arlington · Wallington
          </div>
          <h1 style={{ fontFamily: "'Special Elite', monospace", fontSize: "clamp(30px, 6vw, 40px)", margin: "6px 0 12px", lineHeight: 1.05, fontWeight: 400 }}>
            Rutherford Bulletin
          </h1>
          <p style={{ fontSize: "clamp(19px, 3.4vw, 22px)", fontWeight: 700, lineHeight: 1.25, margin: "0 0 8px" }}>
            The free community calendar for Rutherford and the towns around it.
          </p>
          <p style={{ fontSize: 16, color: "#5A5040", lineHeight: 1.5, margin: 0, maxWidth: 640 }}>
            Markets, concerts, fundraisers, meetings, kids' activities and more, all gathered in one place so you don't find out after it's over.
          </p>
        </div>
      </header>

      <main style={{ maxWidth: 920, margin: "0 auto", padding: "26px 20px 40px" }}>
        <section
          style={{
            background: "#E8DFC4",
            border: "2px solid #2B2420",
            borderRadius: 4,
            padding: "24px",
            boxShadow: "5px 5px 0 #2B2420",
          }}
        >
          <h2 style={{ fontFamily: "'Special Elite', monospace", fontWeight: 400, fontSize: 26, margin: "0 0 6px" }}>Get the Monday roundup</h2>
          <p style={{ margin: "0 0 14px", color: "#5A5040", fontSize: 15, lineHeight: 1.45 }}>
            One short email every Monday morning with everything happening around town that week.
          </p>
          <ul style={{ margin: "0 0 16px", padding: 0, listStyle: "none", fontSize: 15 }}>
            {["Free, always", "One email a week, nothing else", "Unsubscribe in one click"].map((t) => (
              <li key={t} style={{ padding: "2px 0 2px 24px", position: "relative" }}>
                <span aria-hidden="true" style={{ position: "absolute", left: 0, color: "#3F5443", fontWeight: 700 }}>
                  ✓
                </span>
                {t}
              </li>
            ))}
          </ul>
          <form onSubmit={handleSubscribe} className="wl-form">
            <div ref={turnstileContainerRef}></div>
            <input
              type="email"
              aria-label="Your email address"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSubStatus("");
              }}
              style={{ padding: "14px", border: "2px solid #2B2420", borderRadius: 3, background: "#FBF7EB", fontFamily: "'Source Serif 4', serif", fontSize: 16 }}
            />
            <button type="submit" className="be-btn" style={{ background: "#3F5443", color: "#F4EEDB", padding: "14px 26px", borderRadius: 3, fontSize: 19, fontWeight: 700 }}>
              Sign me up
            </button>
          </form>
          {subStatus === "success" && (
            <div style={{ marginTop: 12, fontSize: 14, color: "#3F5443" }} role="status">
              <p style={{ margin: 0, fontWeight: 600 }}>You're on the list — welcome!</p>
              <p style={{ margin: "6px 0 0", color: "#2B2420" }}>
                You signed up with the following email address: <strong style={{ overflowWrap: "anywhere" }}>{signedUpEmail}</strong>
              </p>
              <p style={{ margin: "4px 0 0", color: "#5A5040" }}>Doesn't look right? Just sign up again with the correct address.</p>
            </div>
          )}
          {subStatus === "duplicate" && <p style={{ margin: "12px 0 0", fontSize: 14, color: "#5A5040" }}>That email's already signed up.</p>}
          {subStatus === "invalid" && <p style={{ margin: "12px 0 0", fontSize: 14, color: "#9A3324" }}>That doesn't look like a valid email.</p>}
          {subStatus === "error" && <p style={{ margin: "12px 0 0", fontSize: 14, color: "#9A3324" }}>Something went wrong — try again in a moment.</p>}
          <p style={{ fontSize: 12, color: "#8A7E68", margin: "12px 0 0" }}>
            Email signups will be used to send weekly event summaries, which may include sponsored content.
          </p>
        </section>

        <div className="be-label" style={{ display: "flex", alignItems: "center", gap: 14, margin: "30px 0 6px", fontSize: 15, color: "#6B5D4F" }}>
          <span style={{ flex: 1, borderTop: "1.5px solid #B8A576" }} />
          or just have a look
          <span style={{ flex: 1, borderTop: "1.5px solid #B8A576" }} />
        </div>

        {events.length > 0 && (
          <>
            <h2 className="be-label" style={{ fontSize: 15, color: "#9A3324", borderBottom: "1.5px solid #B8A576", paddingBottom: 6, margin: "8px 0 14px", fontWeight: 700 }}>
              Coming up this week
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {events.map((e) => {
                const color = CATS[e.category] || CATS.Other;
                return (
                  <div key={e.id} style={{ background: "#FBF7EB", border: "1.5px solid #2B2420", borderRadius: 3, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                      <span className="be-label" style={{ fontSize: 12, color, fontWeight: 700 }}>
                        {e.category}
                      </span>
                    </div>
                    <h3 style={{ margin: "4px 0 4px", fontSize: 18, lineHeight: 1.2 }}>{e.title}</h3>
                    <div style={{ fontSize: 13.5, color: "#5A5040", lineHeight: 1.4 }}>
                      {formatShortDate(e.date)}
                      {e.time ? ` · ${e.time}` : ""}
                      <br />
                      {e.location || e.town}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <Link
          href="/"
          className="be-label"
          style={{
            display: "inline-block",
            margin: "26px 0 0",
            border: "2px solid #2B2420",
            borderRadius: 3,
            padding: "12px 22px",
            fontSize: 17,
            fontWeight: 700,
            color: "#2B2420",
            textDecoration: "none",
          }}
        >
          See the full calendar →
        </Link>

        <p style={{ margin: "40px 0 0", fontSize: 14, color: "#5A5040" }}>
          <strong>Hosting something?</strong>{" "}
          <Link href="/submit" style={{ color: "#5A5040" }}>
            Add your event to the calendar
          </Link>
          , it's free.
        </p>
      </main>

      <footer style={{ borderTop: "1.5px solid #B8A576", padding: "18px 20px 28px", background: "#E8DFC4" }}>
        <div style={{ maxWidth: 920, margin: "0 auto", fontSize: 12, color: "#6B5D4F", lineHeight: 1.5, textAlign: "center" }}>
          <p style={{ margin: "0 0 6px" }}>
            Event information on this site is gathered from public sources and may not always be accurate or up to date. Please confirm details with the organizer before you go.
          </p>
          <p style={{ margin: 0 }}>
            <Link href="/submit" style={{ color: "#6B5D4F" }}>
              Submit an event
            </Link>
            {" · "}
            <Link href="/contact" style={{ color: "#6B5D4F" }}>
              Contact
            </Link>
            {" · "}
            <Link href="/privacy" style={{ color: "#6B5D4F" }}>
              Privacy Policy
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
