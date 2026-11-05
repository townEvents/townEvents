"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

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

const emptyForm = { name: "", email: "", phone: "", message: "", company: "" };

export default function Contact() {
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
        action: "contact",
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

  function set(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contact", {
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
        <h1 style={{ fontFamily: "'Special Elite', monospace", fontSize: 26, margin: "0 0 4px" }}>Contact</h1>
        <p style={{ fontSize: 14, color: "#5A5040", marginTop: 0, marginBottom: 24, lineHeight: 1.5 }}>
          Have a question, a correction or an idea? Send a message and we'll reply to the email address you give. Want to suggest an event?{" "}
          <Link href="/submit" style={{ color: "#9A3324" }}>
            Use the event form instead
          </Link>
          .
        </p>

        {status === "success" ? (
          <div style={{ background: "#FBF7EB", border: "1.5px solid #3F5443", borderRadius: 4, padding: 20, textAlign: "center" }}>
            <p style={{ fontSize: 15, margin: 0 }}>Thanks! Your message was sent.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: "#FBF7EB", border: "1.5px solid #2B2420", borderRadius: 4, padding: 22, boxShadow: "3px 3px 0 rgba(43,36,32,0.2)" }}>
            <div ref={turnstileContainerRef}></div>

            <Field label="Your name (optional)">
              <input maxLength={100} autoComplete="name" value={form.name} onChange={set("name")} style={inputStyle} />
            </Field>

            <Field label="Your email *" hint="So we can reply. Your details are only used to reply to you and are never added to the mailing list.">
              <input required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={set("email")} style={inputStyle} />
            </Field>

            <Field label="Your phone number (optional)">
              <input type="tel" maxLength={30} autoComplete="tel" value={form.phone} onChange={set("phone")} style={inputStyle} />
            </Field>

            <Field label="Message *">
              <textarea required rows={6} maxLength={2000} value={form.message} onChange={set("message")} style={{ ...inputStyle, resize: "vertical" }} />
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
              {status === "sending" ? "Sending…" : "Send Message"}
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
