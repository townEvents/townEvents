const CATS = {
  Music: "#9A3324",
  Market: "#C68E17",
  "Kids & Family": "#4A6C8C",
  "Meeting / Civic": "#3F5443",
  "Sports & Rec": "#B5651D",
  "Arts & Culture": "#6B4E71",
  Other: "#6B5D4F",
};

function formatDay(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

// grouped: array of [dateStr, events[]] pairs, already sorted chronologically
export default function WeeklyDigest({ grouped, siteUrl }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style={{ margin: 0, padding: 0, background: "#D8CBA0", fontFamily: "Georgia, 'Times New Roman', serif" }}>
        {/* Hidden preheader text - shows as the preview snippet in inbox list views */}
        <div style={{ display: "none", overflow: "hidden", lineHeight: "1px", opacity: 0, maxHeight: 0, maxWidth: 0 }}>
          This week's events around Rutherford and nearby towns.
        </div>

        <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style={{ background: "#D8CBA0", padding: "24px 12px" }}>
          <tbody>
            <tr>
              <td align="center">
                <table role="presentation" width="600" cellPadding="0" cellSpacing="0" style={{ maxWidth: 600, width: "100%", background: "#FBF7EB", border: "1px solid #D8CBA0" }}>
                  <tbody>
                    {/* Header */}
                    <tr>
                      <td style={{ background: "#E8DFC4", borderBottom: "3px double #2B2420", padding: "26px 28px 18px", textAlign: "center" }}>
                        <p style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9A3324", margin: "0 0 6px" }}>
                          Rutherford &middot; East Rutherford &middot; Carlstadt &middot; Lyndhurst &middot; North Arlington &middot; Wallington
                        </p>
                        <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 28, margin: 0 }}>Rutherford Bulletin</h1>
                        <p style={{ fontSize: 13, color: "#5A5040", margin: "6px 0 0", fontStyle: "italic" }}>What's happening around town — this week</p>
                      </td>
                    </tr>

                    {/* Body */}
                    <tr>
                      <td style={{ padding: "24px 24px 8px" }}>
                        {grouped.length === 0 ? (
                          <p style={{ fontSize: 14, color: "#5A5040" }}>No events on the board for this week yet.</p>
                        ) : (
                          grouped.map(([date, events]) => (
                            <div key={date}>
                              <p
                                style={{
                                  fontFamily: "Arial, Helvetica, sans-serif",
                                  fontSize: 13,
                                  letterSpacing: "0.08em",
                                  textTransform: "uppercase",
                                  color: "#9A3324",
                                  borderBottom: "1.5px solid #B8A576",
                                  paddingBottom: 6,
                                  margin: "0 0 12px",
                                }}
                              >
                                {formatDay(date)}
                              </p>
                              {events.map((e) => {
                                const cancelled = e.status === "cancelled";
                                const color = CATS[e.category] || CATS.Other;
                                return (
                                  <table
                                    key={e.id}
                                    role="presentation"
                                    width="100%"
                                    cellPadding="0"
                                    cellSpacing="0"
                                    style={{
                                      border: cancelled ? "1px solid #C9B0A8" : "1px solid #D8CBA0",
                                      borderRadius: 3,
                                      marginBottom: 12,
                                      background: cancelled ? "#F3E9E2" : "#FFFDF6",
                                    }}
                                  >
                                    <tbody>
                                      <tr>
                                        <td style={{ padding: "13px 15px" }}>
                                          <p style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 11, fontWeight: "bold", color, margin: "0 0 4px" }}>
                                            {e.category ? e.category.toUpperCase() : "OTHER"}
                                            {cancelled ? " · CANCELLED" : ""}
                                          </p>
                                          <p
                                            style={{
                                              fontSize: 16,
                                              fontWeight: "bold",
                                              margin: "0 0 3px",
                                              textDecoration: cancelled ? "line-through" : "none",
                                              color: cancelled ? "#7A6F63" : "#2B2420",
                                            }}
                                          >
                                            {e.title}
                                          </p>
                                          <p style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 11.5, color: "#5A5040", margin: "0 0 6px" }}>
                                            {e.time ? `${e.time} · ` : ""}
                                            {e.town}
                                            {e.location ? ` · ${e.location}` : ""}
                                          </p>
                                          {e.description && (
                                            <p style={{ fontSize: 13.5, lineHeight: 1.4, margin: 0, color: "#3A332B" }}>{e.description}</p>
                                          )}
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                );
                              })}
                            </div>
                          ))
                        )}

                        <p style={{ fontSize: 13, textAlign: "center", margin: "18px 0 0" }}>
                          <a href={siteUrl} style={{ color: "#9A3324" }}>
                            See everything on the site &rarr;
                          </a>
                        </p>
                      </td>
                    </tr>

                    {/* Footer */}
                    <tr>
                      <td
                        style={{
                          background: "#E8DFC4",
                          padding: "20px 24px",
                          textAlign: "center",
                          fontFamily: "Arial, Helvetica, sans-serif",
                          fontSize: 11,
                          color: "#8A7E68",
                          lineHeight: 1.7,
                        }}
                      >
                        You're getting this because you signed up at rutherfordbulletin.com.
                        <br />
                        {/* Resend replaces this merge tag with a working, per-subscriber unsubscribe link */}
                        <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style={{ color: "#9A3324" }}>
                          Unsubscribe
                        </a>
                        <br />
                        <br />
                        Rutherford Bulletin &middot; Rutherford, NJ
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
