import type { ReactNode } from "react";

// `/drift` is the one route in Drift whose IDENTITY lives entirely in the query
// string: `?realm=gallery`, `?focus=field&bucket=mathematics` and
// `?focus=current&section=politics-and-elections` are different sessions at the
// same path. Next's client-side Router Cache keys its entries by PATH SEGMENT,
// not by full URL, so all of those share one entry — and once a `popstate` (the
// phone's back gesture, a swipe-back) has restored a `/drift` entry, the next
// `router.push("/drift?<other params>")` is answered with the URL already in
// that entry. The reader taps Physics and the address bar itself says
// mathematics. Verified: a nonce in the query string does NOT dodge it (proof
// the key is the segment), while `router.refresh()` beforehand does (proof it is
// the cache).
//
// It only ever bit the installed app because it needs a long-lived page: on a
// phone the back gesture is how you navigate, and a home-screen PWA keeps one
// document alive for days, so the poisoned entry survives. In a browser tab you
// reload often enough to clear it, which is exactly the "restarting the app
// fixes it" the report described.
//
// Marking the segment dynamic keeps it out of that cache entirely, so every
// start resolves the URL it was actually given. The cost is one small RSC
// request per drift start: `/drift`'s server output is a client-component shell
// with no data in it, and it is login-gated and `Disallow`ed in robots.txt, so
// there is nothing to gain from prerendering it anyway.
export const dynamic = "force-dynamic";

export default function DriftLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
