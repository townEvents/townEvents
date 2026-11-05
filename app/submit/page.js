"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { todayStrEastern } from "../../lib/dates";

const inputStyle = {
  width: "100%",
  padding: "9px 10px",
  border: "1.5px solid #C9B98A",
  borderRadius: 3,
  background: "#FFFDF6",
  fontFamily: "'Source Serif 4', serif",
  fontSize: 14.5,
};

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        style={{
          display: "block",
          fontSize: 11.5,
          fontFamily: "'Barlow Condensed', sans-serif",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "#5A5040",
          marginBottom: 4,
        }}
      >
        {label}
        {children}
      </label>
      {hint && <p style={{ fontSize: 12, color: "#8A7E68", margin: "4px 0 0" }}>{hint}</p>}
    </div>
  );
}

const emptyForm = { title: "", date: "", location: "", description: "", url: "", company: "" };

export default function SubmitEvent() {
  const today = todayStrEastern();
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState(""); // "", "sending", "success", "error"
  const [errorMsg, setErrorMsg] = useState("");

  const turnstileContainerRef = useRef(null);
  const turnstileWidgetIdRef = useRef(null);
  const turnstileTokenRef = useRef("");

  // Same invisible Cloudflare Turnstile check the email signup uses.
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return;

    function renderWidget() {
      if (!window.turnstile || !turnstileContainerRef.current || turnstileWidgetIdRef.current) return;
      turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
        size: "invisible",
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

  function set(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/submit-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, turnstileToken: turnstileTokenRef.current }),
      });
      const data = await res.json();

      // Each Turnstile token can only be used once.
      if (window.turnstile && turnstileWidgetIdRef.current) {
        window.turnstile.reset(turnstileWidgetIdRef.current);
        turnstileTokenRef.current = "";
      }

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error || "Something went wrong.");
        return;
      }
      setStatus("success");
      setForm(emptyForm);
    } catch (err) {
      setStatus("error");
      setErrorMsg("Couldn't reach the server. Check your connection and try again.");
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#EDE4CC", color: "#2B2420", fontFamily: "'Source Serif 4', Georgia, serif", padding: "40px 16px" }}>
      <style>{`* { box-sizing: border-box; }`}</style>

      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Special Elite', monospace", fontSize: 26, margin: "0 0 4px" }}>Submit an Event</h1>
        <p style={{ fontSize: 14, color: "#5A5040", marginTop: 0, marginBottom: 24, lineHeight: 1.5 }}>
          Know about something happening around town that's not on the board? Send it in. Every submission is reviewed before anything is posted, and we
          don't ask for your name or contact info.
        </p>

        {status === "success" ? (
          <div style={{ background: "#FBF7EB", border: "1.5px solid #3F5443", borderRadius: 4, padding: 20, textAlign: "center" }}>
            <p style={{ fontSize: 15, margin: "0 0 12px" }}>Thanks! Your event was sent in for review.</p>
            <button
              onClick={() => setStatus("")}
              style={{
                background: "#3F5443",
                color: "#F4EEDB",
                border: "none",
                borderRadius: 3,
                padding: "9px 16px",
                fontFamily: "'Barlow Condensed', sans-serif",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Submit Another
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: "#FBF7EB", border: "1.5px solid #2B2420", borderRadius: 4, padding: 22, boxShadow: "3px 3px 0 rgba(43,36,32,0.2)" }}>
            <div ref={turnstileContainerRef}></div>

            <Field label="Event name *">
              <input required maxLength={120} value={form.title} onChange={set("title")} style={inputStyle} />
            </Field>

            <Field label="Date *">
              <input required type="date" min={today} value={form.date} onChange={set("date")} style={inputStyle} />
            </Field>

            <Field label="Location *">
              <input required maxLength={160} placeholder="Venue and town" value={form.location} onChange={set("location")} style={inputStyle} />
            </Field>

            <Field label="Description">
              <textarea rows={4} maxLength={1000} value={form.description} onChange={set("description")} style={{ ...inputStyle, resize: "vertical" }} />
            </Field>

            <Field label="Link to the public post *" hint="Where the event is announced, such as a Facebook post, a town page or a ticket page.">
              <input required type="text" inputMode="url" autoCapitalize="none" spellCheck={false} maxLength={500} placeholder="www.example.com or https://…" value={form.url} onChange={set("url")} style={inputStyle} />
            </Field>

            {/* Honeypot: hidden from people, but bots that fill every field will fill this. */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
              <label>
                Company
                <input tabIndex={-1} autoComplete="off" value={form.company} onChange={set("company")} />
              </label>
            </div>

            {status === "error" && <p style={{ color: "#9A3324", fontSize: 13 }}>{errorMsg}</p>}

            <button
              type="submit"
              disabled={status === "sending"}
              style={{
                width: "100%",
                background: "#9A3324",
                color: "#F4EEDB",
                border: "none",
                borderRadius: 3,
                padding: "12px",
                fontFamily: "'Barlow Condensed', sans-serif",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontSize: 14,
                fontWeight: 600,
                cursor: status === "sending" ? "default" : "pointer",
                opacity: status === "sending" ? 0.6 : 1,
                marginTop: 6,
              }}
            >
              {status === "sending" ? "Sending…" : "Submit for Review"}
            </button>
          </form>
        )}

        <p style={{ marginTop: 24, fontSize: 13 }}>
          <Link href="/" style={{ color: "#9A3324" }}>
            ← Back to the bulletin
          </Link>
        </p>
      </div>
    </div>
  );
}
