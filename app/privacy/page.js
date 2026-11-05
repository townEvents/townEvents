import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Rutherford Bulletin",
  description: "How Rutherford Bulletin handles email addresses.",
};

const heading = { fontFamily: "'Special Elite', monospace", fontSize: 18, margin: "28px 0 8px" };
const body = { fontSize: 15.5, lineHeight: 1.6, margin: "0 0 12px" };

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#EDE4CC", color: "#2B2420", fontFamily: "'Source Serif 4', Georgia, serif" }}>
      <header style={{ borderBottom: "3px double #2B2420", padding: "28px 20px 18px", background: "#E8DFC4" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h1 style={{ fontFamily: "'Special Elite', monospace", fontSize: "clamp(26px, 5vw, 38px)", margin: 0, lineHeight: 1.05 }}>
            Privacy Policy
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "#5A5040" }}>Rutherford Bulletin</p>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "8px 20px 60px" }}>
        <h2 style={heading}>What we collect</h2>
        <p style={body}>
          We only collect email addresses. We do not collect names or any other identifying information. The only way we collect an email
          address is through the signup form on this website.
        </p>
        <p style={body}>
          If you suggest an event using the "Submit an event" form, we save only what you type into it: the event name, date, location,
          description and a link to the public post, plus an email address if you choose to give one. The email is optional. If you give
          it, we use it only to follow up with you about that submission. It is never shown on the site and is not added to our mailing
          list. We don't ask for your name or any other contact information. Submissions are reviewed before anything is posted.
        </p>

        <h2 style={heading}>Why we collect it</h2>
        <p style={body}>
          We collect email addresses to send a weekly email about what's going on in town. These emails may contain marketing messages.
          Every email includes an unsubscribe link, and you can use it at any time to stop receiving them.
        </p>

        <h2 style={heading}>Who sees it</h2>
        <p style={body}>
          We don't share this list with others. Your email address is stored with our email delivery service, which sends the weekly
          email on our behalf.
        </p>

        <h2 style={heading}>Site visits</h2>
        <p style={body}>
          We use privacy-friendly analytics to count visits to the site. It doesn't use cookies and doesn't track individual visitors
          across other sites.        </p>

        <p style={{ ...body, marginTop: 32 }}>
          <Link href="/" style={{ color: "#9A3324" }}>
            ← Back to the bulletin
          </Link>
        </p>
      </main>
    </div>
  );
}
