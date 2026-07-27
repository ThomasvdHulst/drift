import { AuthGate } from "@/components/AuthGate";
import { AccountButton } from "@/components/AccountButton";
import { TourProvider } from "@/components/tour/TourProvider";

// The gated half of the app. Every real page lives in this route group so that
// the login gate wraps them and NOTHING ELSE.
//
// Why the group exists at all: `app/not-found.tsx` is rendered for any unmatched
// URL, and it is a sibling of this group, not a child. When AuthGate sat in the
// ROOT layout it wrapped the 404 too, so a signed-out visitor who mistyped a URL
// got the landing page with "Page not found" in the tab title: the right title
// over the wrong page. Moving the gate down one level leaves the 404 (and the
// error boundaries) outside it, where they belong. A route group's name is in
// parentheses, so it changes no URLs at all.
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthGate>
      {/* The guided tour (Phase 20) is mounted inside the gate, so it never
          renders on the signed-out Landing, and it survives client-side route
          changes so one tour can flow across pages. */}
      <TourProvider>
        {children}
        <AccountButton />
      </TourProvider>
    </AuthGate>
  );
}
