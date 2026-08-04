"use client";

import { useState, useEffect } from "react";

const CATS = {
  Music: "#9A3324",
  Market: "#C68E17",
  "Kids & Family": "#4A6C8C",
  "Meeting / Civic": "#3F5443",
  "Sports & Rec": "#B5651D",
  "Arts & Culture": "#6B4E71",
  Other: "#6B5D4F",
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const inputStyle = {
  width: "100%",
  padding: "9px 10px",
  border: "1.5px solid #C9B98A",
  borderRadius: 3,
  background: "#FFFDF6",
  fontFamily: "'Source Serif 4', serif",
  fontSize: 14.5,
};

function Field({ label, children }) {
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
      </label>
      {children}
    </div>
  );
}

export default function QuickAdd() {
  const [passcode, setPasscode] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    date: todayStr(),
    time: "",
    town: "",
    location: "",
    category: "Other",
  });
  const [status, setStatus] = useState(""); // "", "sending", "success", "error"
  const [errorMsg, setErrorMsg] = useState("");

  // Remember the passcode in this browser only, so it's not re-typed every
  // time — this is just a convenience, not a security boundary. The real
  // check happens on the server, on every submit.
  useEffect(() => {
    const saved = window.localStorage.getItem("rb-quick-add-passcode");
    if (saved) setPasscode(saved);
  }, []);

  async function handleSubmit(ev) {
    ev.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/quick-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode, ...form }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error || "Something went wrong.");
        return;
      }

      window.localStorage.setItem("rb-quick-add-passcode", passcode);
      setStatus("success");
      setForm({ title: "", description: "", date: todayStr(), time: "", town: "", location: "", category: "Other" });
    } catch (err) {
      setStatus("error");
      setErrorMsg("Couldn't reach the server. Check your connection and try again.");
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#EDE4CC", color: "#2B2420", fontFamily: "'Source Serif 4', Georgia, serif", padding: "40px 16px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Special+Elite&family=Source+Serif+4:wght@400;600;700&family=Barlow+Condensed:wght@500;600;700&display=swap');
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ maxWidth: 440, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Special Elite', monospace", fontSize: 26, margin: "0 0 4px" }}>Quick Add</h1>
        <p style={{ fontSize: 13.5, color: "#5A5040", marginTop: 0, marginBottom: 24 }}>
          For dropping in events you heard about but that don't have a public listing anywhere. Goes live immediately.
        </p>

        {status === "success" ? (
          <div style={{ background: "#FBF7EB", border: "1.5px solid #3F5443", borderRadius: 4, padding: 20, textAlign: "center" }}>
            <p style={{ fontSize: 15, margin: "0 0 12px" }}>Added — it's live on the board now.</p>
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
              Add Another
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: "#FBF7EB", border: "1.5px solid #2B2420", borderRadius: 4, padding: 22, boxShadow: "3px 3px 0 rgba(43,36,32,0.2)" }}>
            <Field label="Passcode">
              <input
                type="password"
                required
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                style={inputStyle}
              />
            </Field>

            <Field label="Title *">
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} />
            </Field>

            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Field label="Date *">
                  <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle} />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Time">
                  <input placeholder="7:00 PM" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} style={inputStyle} />
                </Field>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Field label="Town *">
                  <input required value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value })} style={inputStyle} />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Location">
                  <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} style={inputStyle} />
                </Field>
              </div>
            </div>

            <Field label="Category">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle}>
                {Object.keys(CATS).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Details">
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </Field>

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
              {status === "sending" ? "Adding…" : "Add to Board"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
