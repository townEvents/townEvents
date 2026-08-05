"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";

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

function hashRotation(id) {
  let h = 0;
  const s = String(id);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000;
  return (h % 60) / 10 - 3; // -3..3 deg
}

function formatHeaderDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function inRange(dateStr, range) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (range === "today") return dt.getTime() === now.getTime();
  if (range === "week") {
    const end = new Date(now);
    end.setDate(end.getDate() + 7);
    return dt >= now && dt <= end;
  }
  if (range === "month") return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
  return dt >= now;
}

function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  return cells;
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function Bulletin() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTowns, setActiveTowns] = useState(new Set());
  const [range, setRange] = useState("week");
  const [view, setView] = useState("list");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(null);

  const [email, setEmail] = useState("");
  const [subStatus, setSubStatus] = useState(""); // "", "success", "duplicate", "error", "invalid"

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .in("status", ["approved", "cancelled"])
        .order("date", { ascending: true });
      if (error) {
        setLoadError(true);
      } else {
        setEvents(data || []);
      }
      setLoading(false);
    })();
  }, []);

  const towns = useMemo(() => [...new Set(events.map((e) => e.town))].sort(), [events]);

  const filtered = useMemo(() => {
    return events
      .filter((e) => {
        if (activeTowns.size > 0 && !activeTowns.has(e.town)) return false;
        if (view === "list") {
          if (range === "all") {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const [y, m, d] = e.date.split("-").map(Number);
            if (new Date(y, m - 1, d) < now) return false;
          } else if (!inRange(e.date, range)) return false;
        }
        if (search.trim()) {
          const q = search.toLowerCase();
          const hay = `${e.title} ${e.description || ""} ${e.location || ""} ${e.town}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  }, [events, activeTowns, range, search, view]);

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((e) => {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date).push(e);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const monthCells = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);
  const monthCounts = useMemo(() => {
    const map = {};
    events.forEach((e) => {
      if (activeTowns.size > 0 && !activeTowns.has(e.town)) return;
      map[e.date] = (map[e.date] || 0) + 1;
    });
    return map;
  }, [events, activeTowns]);

  function toggleTown(t) {
    setActiveTowns((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

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
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSubStatus(data.error === "invalid" ? "invalid" : "error");
        return;
      }
      if (data.duplicate) {
        setSubStatus("duplicate");
        return;
      }
      setSubStatus("success");
      setEmail("");
    } catch (err) {
      setSubStatus("error");
    }
  }

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div style={{ minHeight: "100vh", background: "#EDE4CC", color: "#2B2420", fontFamily: "'Source Serif 4', Georgia, serif" }}>
      <style>{`
        .be-label { font-family: 'Barlow Condensed', sans-serif; text-transform: uppercase; letter-spacing: 0.08em; }
        .be-btn { cursor: pointer; border: none; font-family: 'Barlow Condensed', sans-serif; text-transform: uppercase; letter-spacing: 0.06em; }
        .be-btn:focus-visible, .be-chip:focus-visible, input:focus-visible { outline: 2px solid #9A3324; outline-offset: 2px; }
        @media (prefers-reduced-motion: no-preference) {
          .be-card { transition: transform 0.15s ease; }
          .be-card:hover { transform: translateY(-2px) rotate(0deg) !important; }
        }
      `}</style>

      <header style={{ borderBottom: "3px double #2B2420", padding: "28px 20px 18px", background: "#E8DFC4" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div className="be-label" style={{ fontSize: 12, color: "#9A3324", marginBottom: 4 }}>
            Rutherford · East Rutherford · Carlstadt · Lyndhurst · North Arlington · Wallington
          </div>
          <h1 style={{ fontFamily: "'Special Elite', monospace", fontSize: "clamp(28px, 5vw, 44px)", margin: 0, lineHeight: 1.05 }}>
            Rutherford Bulletin
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 15, color: "#5A5040" }}>
            What's happening around town.
          </p>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px 60px" }}>
        {loadError && (
          <div style={{ background: "#F3D9D9", border: "1px solid #9A3324", padding: "10px 14px", borderRadius: 3, marginBottom: 16, fontSize: 14 }}>
            Couldn't load events right now. Check back in a bit.
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search notices…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: "1 1 200px", padding: "10px 12px", border: "1.5px solid #2B2420", borderRadius: 3, background: "#FBF7EB", fontFamily: "'Source Serif 4', serif", fontSize: 15 }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className="be-btn"
              onClick={() => setView("list")}
              style={{ padding: "9px 14px", fontSize: 13, borderRadius: 3, background: view === "list" ? "#2B2420" : "transparent", color: view === "list" ? "#F4EEDB" : "#2B2420", border: "1.5px solid #2B2420" }}
            >
              List
            </button>
            <button
              className="be-btn"
              onClick={() => setView("month")}
              style={{ padding: "9px 14px", fontSize: 13, borderRadius: 3, background: view === "month" ? "#2B2420" : "transparent", color: view === "month" ? "#F4EEDB" : "#2B2420", border: "1.5px solid #2B2420" }}
            >
              Month
            </button>
          </div>
        </div>

        {view === "list" && (
          <div className="be-label" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {["today", "week", "month", "all"].map((r) => (
              <button
                key={r}
                className="be-btn"
                onClick={() => setRange(r)}
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  borderRadius: 20,
                  background: range === r ? "#3F5443" : "#FBF7EB",
                  color: range === r ? "#F4EEDB" : "#2B2420",
                  border: "1.5px solid #3F5443",
                }}
              >
                {r === "today" ? "Today" : r === "week" ? "This Week" : r === "month" ? "This Month" : "All Upcoming"}
              </button>
            ))}
          </div>
        )}

        {towns.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
            {towns.map((t) => (
              <button
                key={t}
                className="be-chip be-label"
                onClick={() => toggleTown(t)}
                style={{
                  padding: "6px 12px",
                  fontSize: 12.5,
                  borderRadius: 3,
                  cursor: "pointer",
                  border: "1.5px solid #C68E17",
                  background: activeTowns.has(t) ? "#C68E17" : "transparent",
                  color: activeTowns.has(t) ? "#2B2420" : "#8A6A12",
                  fontWeight: 600,
                }}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {loading && <p style={{ color: "#6B5D4F" }}>Loading the board…</p>}

        {!loading &&
          view === "list" &&
          (grouped.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px 20px", border: "2px dashed #B8A576", borderRadius: 4 }}>
              <p style={{ fontSize: 17, marginBottom: 4 }}>Nothing posted for this stretch yet.</p>
              <p style={{ fontSize: 14, color: "#6B5D4F", margin: 0 }}>Check back soon, or try a different date range.</p>
            </div>
          ) : (
            grouped.map(([date, evts]) => (
              <section key={date} style={{ marginBottom: 30 }}>
                <h2
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 15,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#9A3324",
                    borderBottom: "1.5px solid #B8A576",
                    paddingBottom: 6,
                    marginBottom: 14,
                  }}
                >
                  {formatHeaderDate(date)}
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18 }}>
                  {evts.map((e) => (
                    <EventCard key={e.id} e={e} />
                  ))}
                </div>
              </section>
            ))
          ))}

        {!loading && view === "month" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <button
                className="be-btn"
                onClick={() =>
                  setCursor((c) => {
                    const m = c.month - 1;
                    return m < 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: m };
                  })
                }
                style={{ background: "transparent", border: "1.5px solid #2B2420", borderRadius: 3, padding: "6px 12px", fontSize: 16 }}
              >
                ‹
              </button>
              <h2 style={{ fontFamily: "'Special Elite', monospace", fontSize: 20, margin: 0 }}>{monthLabel}</h2>
              <button
                className="be-btn"
                onClick={() =>
                  setCursor((c) => {
                    const m = c.month + 1;
                    return m > 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: m };
                  })
                }
                style={{ background: "transparent", border: "1.5px solid #2B2420", borderRadius: 3, padding: "6px 12px", fontSize: 16 }}
              >
                ›
              </button>
            </div>
            <div
              style={{
                background: "#DED1A8",
                backgroundImage: "radial-gradient(#C9B98A 1px, transparent 1px)",
                backgroundSize: "14px 14px",
                border: "1.5px solid #2B2420",
                borderRadius: 4,
                padding: 8,
                maxWidth: 320,
                margin: "0 auto",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 3 }}>
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div key={i} className="be-label" style={{ textAlign: "center", fontSize: 10, color: "#5A5040" }}>
                    {d}
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
                {monthCells.map((date, i) => {
                  const count = date ? monthCounts[date] || 0 : 0;
                  const isToday = date === todayStr();
                  return (
                    <button
                      key={i}
                      disabled={!date}
                      onClick={() => date && setSelectedDay(date === selectedDay ? null : date)}
                      style={{
                        aspectRatio: "1",
                        background: date ? "#FBF7EB" : "transparent",
                        border: date === selectedDay ? "2px solid #9A3324" : isToday ? "2px solid #3F5443" : "1px solid #C9B98A",
                        borderRadius: 2,
                        cursor: date ? "pointer" : "default",
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 1,
                      }}
                    >
                      {date && <span style={{ fontSize: 10.5, fontFamily: "'Barlow Condensed', sans-serif" }}>{Number(date.split("-")[2])}</span>}
                      {count > 0 && <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#9A3324", marginTop: 1 }} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedDay && (
              <div style={{ marginTop: 20 }}>
                <h3
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 15,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#9A3324",
                    marginBottom: 12,
                  }}
                >
                  {formatHeaderDate(selectedDay)}
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18 }}>
                  {events
                    .filter((e) => e.date === selectedDay && (activeTowns.size === 0 || activeTowns.has(e.town)))
                    .map((e) => (
                      <EventCard key={e.id} e={e} />
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        <section
          style={{
            marginTop: 48,
            background: "#E8DFC4",
            border: "1.5px solid #2B2420",
            borderRadius: 4,
            padding: "22px 24px",
            display: "flex",
            flexWrap: "wrap",
            gap: 20,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ maxWidth: 420 }}>
            <h3 style={{ fontFamily: "'Special Elite', monospace", fontSize: 18, margin: "0 0 4px" }}>Get it in your inbox</h3>
            <p style={{ fontSize: 13.5, color: "#5A5040", margin: 0, lineHeight: 1.4 }}>
              A weekly roundup of what's coming up, every Monday morning.
            </p>
          </div>
          <form onSubmit={handleSubscribe} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSubStatus("");
              }}
              style={{ padding: "10px 12px", border: "1.5px solid #2B2420", borderRadius: 3, background: "#FBF7EB", fontFamily: "'Source Serif 4', serif", fontSize: 14, minWidth: 220 }}
            />
            <button type="submit" className="be-btn" style={{ background: "#3F5443", color: "#F4EEDB", padding: "10px 18px", borderRadius: 3, fontSize: 13.5, fontWeight: 600 }}>
              Subscribe
            </button>
          </form>
          {subStatus === "success" && <p style={{ width: "100%", margin: 0, fontSize: 13, color: "#3F5443" }}>You're on the list — welcome!</p>}
          {subStatus === "duplicate" && <p style={{ width: "100%", margin: 0, fontSize: 13, color: "#5A5040" }}>That email's already signed up.</p>}
          {subStatus === "invalid" && <p style={{ width: "100%", margin: 0, fontSize: 13, color: "#9A3324" }}>That doesn't look like a valid email.</p>}
          {subStatus === "error" && <p style={{ width: "100%", margin: 0, fontSize: 13, color: "#9A3324" }}>Something went wrong — try again in a moment.</p>}
        </section>
        <p style={{ fontSize: 11.5, color: "#8A7E68", marginTop: 8 }}>
          Email signups will be used to send weekly event summaries, which may include sponsored content.
        </p>
      </main>
    </div>
  );
}

function wasEdited(e) {
  if (!e.updated_at || !e.created_at) return false;
  // A little slack so the initial insert itself doesn't count as an edit.
  return new Date(e.updated_at).getTime() - new Date(e.created_at).getTime() > 60000;
}

function formatShortDate(dateLike) {
  const d = new Date(dateLike);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function EventCard({ e }) {
  const rot = hashRotation(e.id);
  const color = CATS[e.category] || CATS.Other;
  const cancelled = e.status === "cancelled";
  const edited = wasEdited(e);
  return (
    <div
      className="be-card"
      style={{
        background: "#FBF7EB",
        border: "1px solid #D8CBA0",
        borderRadius: 2,
        padding: "18px 16px 14px",
        position: "relative",
        boxShadow: "3px 4px 6px rgba(43,36,32,0.15)",
        transform: `rotate(${rot}deg)`,
        opacity: cancelled ? 0.72 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: -8,
          left: "50%",
          transform: "translateX(-50%)",
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: cancelled ? "radial-gradient(circle at 35% 30%, #9a9a9a, #5a5a5a)" : "radial-gradient(circle at 35% 30%, #E8896F, #9A3324)",
          boxShadow: "0 2px 3px rgba(0,0,0,0.4)",
        }}
      />

      {cancelled && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: -6,
            background: "#9A3324",
            color: "#F4EEDB",
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.08em",
            padding: "3px 10px",
            transform: "rotate(6deg)",
            boxShadow: "1px 2px 3px rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          ✕ CANCELLED
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span className="be-label" style={{ fontSize: 11, color, fontWeight: 700 }}>
          {e.category}
        </span>
      </div>
      <h3 style={{ fontSize: 17, margin: "0 0 4px", lineHeight: 1.25, textDecoration: cancelled ? "line-through" : "none", textDecorationColor: "#9A3324" }}>
        {e.title}
      </h3>
      <p className="be-label" style={{ fontSize: 12.5, color: "#5A5040", margin: "0 0 8px", letterSpacing: "0.03em" }}>
        {e.time ? `${e.time} · ` : ""}
        {e.town}
        {e.location ? ` · ${e.location}` : ""}
      </p>
      {e.description && (
        <p style={{ fontSize: 14, margin: 0, color: "#3A332B", lineHeight: 1.4 }}>{e.description}</p>
      )}
      {edited && !cancelled && (
        <p
          className="be-label"
          style={{ fontSize: 10.5, color: "#8A7E68", margin: "8px 0 0", letterSpacing: "0.03em" }}
        >
          ✎ updated {formatShortDate(e.updated_at)}
        </p>
      )}
    </div>
  );
}
