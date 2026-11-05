import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Rutherford Bulletin",
  description: "How Rutherford Bulletin handles the information you give us.",
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
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "#5A5040" }}>Rutherford Bulletin · Last updated November 5, 2026</p>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "8px 20px 60px" }}>
        <p style={{ ...body, marginTop: 24 }}>
          This page explains what information we collect through this website, why we collect it, and who sees it. It's organized by
          feature, because each one collects something different.
        </p>

        <h2 style={heading}>Email newsletter signup</h2>
        <p style={body}>
          We only collect your email address. We do not collect names or any other identifying information. The only way we collect an
          email address for the newsletter is through the signup form on this website.
        </p>
        <p style={body}>
          We collect email addresses to send a weekly email about what's going on in town. These emails may contain marketing messages.
          Every email includes an unsubscribe link, and you can use it at any time to stop receiving them.
        </p>
        <p style={body}>
          We don't share this list with others. Addresses are stored with our email delivery service, which sends the weekly email on our
          behalf.
        </p>

        <h2 style={heading}>Suggesting an event</h2>
        <p style={body}>
          If you use the "Submit an event" form, we save what you type into it: the event name, date, location, description and a link to
          the public post. A copy of each submission is emailed to us, and submissions are reviewed by hand before anything is posted.
        </p>
        <p style={body}>
          You can also choose to give your name, email address and phone number. These are all optional. We use them only to contact you
          about your submission. They are never shown on the site and are never added to our mailing list.
        </p>

        <h2 style={heading}>Contacting us</h2>
        <p style={body}>
          If you use the "Contact" form, we save your message and the email address you give, so that we can reply. You can also choose
          to give your name and phone number, which are optional. We use these details only to respond to you. They are never added to
          our mailing list. Messages are delivered to our email inbox.
        </p>

        <h2 style={heading}>How long we keep it, and deleting it</h2>
        <p style={body}>
          We keep contact details from event submissions and from the contact form only as long as we need them to follow up. We don't
          delete them automatically, so they may be kept until we remove them by hand. Copies of contact messages and event submissions
          also sit in our email inbox, and our email delivery service keeps its own records.
        </p>
        <p style={body}>
          If you'd like your information removed, including your address on the newsletter list (unsubscribing stops the emails but
          doesn't erase the address), send a message through the Contact form and ask. We will delete what we hold, including copies in
          our inbox.
        </p>

        <h2 style={heading}>Who sees it</h2>
        <p style={body}>
          Information you send us is seen only by the person who runs this site. It is stored with the services we use to operate the
          site, such as our database host and email delivery service. We don't share it with others.
        </p>

        <h2 style={heading}>Site visits</h2>
        <p style={body}>
          We use privacy-friendly analytics to count visits to the site. It doesn't use cookies and doesn't track individual visitors
          across other sites.
        </p>

        <p style={{ ...body, marginTop: 32 }}>
          <Link href="/" style={{ color: "#9A3324" }}>
            ← Back to the bulletin
          </Link>
        </p>
      </main>
    </div>
  );
}
