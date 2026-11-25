import WelcomeLoader from "./WelcomeLoader";

// Landing page for the Facebook/Instagram ads. Same look as the main site, but
// the header explains what the Bulletin is and the email signup comes first.
export const metadata = {
  title: "Rutherford Bulletin - the free community calendar",
  description:
    "Markets, concerts, fundraisers, meetings and more around Rutherford, NJ, plus a free email every Monday with everything happening that week.",
};

export default function WelcomePage() {
  return <WelcomeLoader />;
}
