import type { ReactNode } from "react";
import { PublicPage, Section, P, Bullets, Lead, A } from "@/components/PublicPage";
import { adsConfig, adsenseScriptEnabled } from "@/lib/ads";
import { CC_BY_SA_4, CC0_1 } from "@/lib/licenses";
import { LicenseLink } from "@/components/LicenseLink";
import { parseOAuthProviders, type OAuthProvider } from "@/lib/auth";
import { contactAddress } from "@/lib/site";
import { imprint } from "@/lib/imprint";

export const metadata = {
  title: "What Drift stores",
  description:
    "What Drift keeps about you, why it is allowed to, who else sees it, how long it is kept, and what you can do about it.",
  alternates: { canonical: "/privacy" },
};

// The privacy notice (compliance audit M-7). The previous version was written to
// be readable and succeeded at that, which the audit called a virtue and asked
// to keep; it was missing most of what GDPR Articles 13 and 12 actually require.
// This is the same voice with the required content in it.
//
// TWO THINGS TO GET RIGHT AND EASY TO GET WRONG.
//
//  1. THE BASIS IS CONTRACT, NOT CONSENT. Almost everything here runs on
//     Article 6(1)(b): performance of the contract at /terms. Writing "we
//     process your data with your consent" across a notice is both inaccurate
//     and strategically bad, because consent is withdrawable and contract is
//     not, so it would make every operation in the app individually revocable.
//     Only advertising is consent, and only once it exists.
//
//  2. DESCRIBE ONLY WHAT EXISTS. The audit's B-3 finding was a sentence on this
//     page promising a consent prompt that had never been built. Every control
//     named below is one a reader can actually use today. Where something is
//     conditional (Turnstile, OAuth, ads), the condition is read from the same
//     flag the feature is, so the page cannot describe a check that is not
//     running.
//
// Last updated 31 July 2026.
const UPDATED = "31 July 2026";

/** The legal entity behind each sign-in button, for the recipients list.
 *  `OAUTH_META` in lib/auth.ts holds the BUTTON labels ("Continue with Google"),
 *  which is not what a list of recipients wants to say. */
const PROVIDER_ENTITY: Record<OAuthProvider, string> = {
  google: "Google Ireland Limited",
  apple: "Apple Distribution International Ltd.",
};

// True as soon as the AdSense script can load. Off by default (audit M0 made one
// switch govern the loader, the meta tag and this copy), so the honest "no ads,
// no cookies" branch is the norm.
const USES_ADSENSE = adsenseScriptEnabled(adsConfig());

export default function PrivacyPage() {
  // Only name Google (or Apple) as a recipient if the button is actually there.
  const providers = parseOAuthProviders(process.env.NEXT_PUBLIC_OAUTH_PROVIDERS);
  const turnstile = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const address = contactAddress();
  const who = imprint();

  return (
    <PublicPage
      title="What Drift stores"
      intro={
        <>
          <span className="block text-xs uppercase tracking-wide">
            Last updated {UPDATED}
          </span>
          <span className="mt-2 block">
            Drift is a small, calm project shared with friends. This is the whole
            story of what it keeps about you, why it is allowed to, and what you
            can do about it.
          </span>
        </>
      }
    >
      {/* Article 12(1) asks for information that is concise, transparent,
          intelligible and easily accessible. A layered notice, a short human
          summary over the full detail, does that better than either a wall of
          text or a page too short to be complete. */}
      <Section title="The short version">
        <Bullets>
          <li>
            Drift keeps your email address, the trails you save, your likes and
            dislikes and the interests they build, your settings, and, if you
            choose one, a handle plus your friends and anything shared between
            you.
          </li>
          <li>
            It keeps them <Lead>because that is the service you asked for, </Lead>
            not because you consented to anything. That is a deliberate choice:
            it means there is nothing here you have to keep agreeing to.
          </li>
          <li>
            There is no advertising, no analytics, no tracking, and no profiling
            for anyone else&apos;s benefit. Nothing is sold. Nothing is shared
            except with the companies that run the servers.
          </li>
          <li>
            You can <Lead>download everything </Lead>Drift holds about you as one
            file, at any time, from <A href="/account">your account page</A>, and{" "}
            <Lead>delete all of it </Lead>from the same place.
          </li>
          <li>
            If something is wrong, <A href="/contact">write to us</A>. If we do
            not put it right, you can complain to the Dutch data protection
            authority.
          </li>
        </Bullets>
        <P>The rest of this page is the detail behind those five lines.</P>
      </Section>

      {/* Article 13(1)(a): the identity AND the contact details of the
          controller. A name and a reachable address, not a description. The
          details come from lib/imprint.ts so this page and /legal cannot end up
          naming different people. */}
      <Section title="Who is responsible">
        <P>
          The controller of the personal data described here is{" "}
          <Lead>{who.legalName}, </Lead>trading as {who.tradeName}, at{" "}
          {who.address.join(", ")}, registered with the Dutch Chamber of Commerce
          under number {who.kvk}. Being the controller means deciding what is
          collected and why, and being the one answerable for it. Drift is run by
          one person; there is no company and no team.
        </P>
        <P>
          You can reach them through <A href="/contact">the contact form</A> or
          at <Mail address={address} />, which is also the published point of
          contact under the Digital Services Act.{" "}
          <A href="/legal">The legal notice</A> has the full details.
        </P>
        <P>
          <Lead>No data protection officer is appointed. </Lead>Drift does not
          meet any of the conditions in Article 37 GDPR that would require one:
          it is not a public authority, monitoring people is not its core
          activity, and it does not process special categories of data.
        </P>
      </Section>

      {/* Articles 13(1)(c), 13(1)(d) and 13(2)(a): the purpose, the legal basis
          for each purpose, the legitimate interest where one is relied on, and
          how long each thing is kept. Rendered as stacked blocks rather than a
          three column table, because a table of prose is unreadable on a phone
          and this page has to work on one. */}
      <Section title="What Drift keeps, why it may, and for how long">
        <P>
          Every row below names the ground in the GDPR that allows it. Almost all
          of them are the same one: Article 6(1)(b), performing the contract you
          entered into by accepting <A href="/terms">the terms</A> and creating
          an account. Two are Article 6(1)(f), a legitimate interest, and those
          say what the interest is.
        </P>

        <Keep
          title="Your account"
          data="Your email address, your password (kept by Supabase as a hash, never in a readable form), and the times you signed in."
          why="So that you can sign in, and so that your trails are yours and nobody else's."
          basis="Article 6(1)(b), performance of the contract."
          kept="Until you delete your account."
        />
        <Keep
          title="Your trails and the cards in them"
          data="The trails you save, the cards each one holds, and any name you give a trail."
          why="This is what Drift is for."
          basis="Article 6(1)(b)."
          kept="Until you delete the trail, or your account."
        />
        <Keep
          title="Your reactions and interests"
          data="The cards you liked or passed on, and the topic weightings worked out from them."
          why="So that drifting leans towards what you enjoy. It orders your own cards for you and does nothing else, and it is never shared."
          basis="Article 6(1)(b)."
          kept="Until you delete your account. You can clear the interests at any time from the interests screen."
        />
        <Keep
          title="Your settings"
          data="Small preferences, such as dark mode and which realm you were last reading."
          why="So the app looks the way you left it."
          basis="Article 6(1)(b)."
          kept="Until you delete your account."
        />
        <Keep
          title="Your handle, friends and shares"
          data="A handle and display name if you set one, who you are friends with, and any trail or card sent between you, including the note attached to it."
          why="So friends can find you and send you something to read. Only set up if you choose a handle."
          basis="Article 6(1)(b)."
          kept="A share stays until either side deletes it, or either account is deleted."
        />
        <Keep
          title="The emails Drift sends you"
          data="Your email address, used to send you a confirmation link, a password reset if you ask for one, a welcome note, and a goodbye when you delete your account."
          why="These are the emails the service itself needs. There is no mailing list and no marketing email."
          basis="Article 6(1)(b)."
          kept="Resend holds delivery logs under its own retention. The address itself goes when your account does."
        />
        <Keep
          title="Messages you send through the contact form"
          data="Your email address, your message, the topic you picked, and your name if you gave one."
          why="To answer you."
          basis="Article 6(1)(b) where the message is about your use of Drift. Otherwise Article 6(1)(f), our legitimate interest in replying to people who write to us."
          kept="Twelve months in the operator's mailbox, then deleted."
        />
        <Keep
          title="Keeping spam off the contact form"
          data={`Your IP address and the timing of your submission.${
            turnstile
              ? " Cloudflare Turnstile also receives your IP address and information about your browser."
              : ""
          }`}
          why="A public form with no checks becomes a spam relay within days, and every message sent through it costs money to deliver."
          basis="Article 6(1)(f). The legitimate interest is keeping the form usable for the people it is for and not paying to deliver junk. You can object to this under Article 21, though in practice it would mean not using the form."
          kept={`The count of recent submissions from your address lives in the memory of a short-lived server process, is never written to disk, and goes when that process does.${
            turnstile ? " Cloudflare's own retention for Turnstile is Cloudflare's." : ""
          }`}
        />
        {USES_ADSENSE ? (
          <Keep
            title="Advertising"
            data="Whatever Google's advertising services collect, which is set out in Google's own policies."
            why="To help keep Drift free."
            basis="Article 6(1)(a), your consent, and nothing else. Nothing from an advertiser loads until you have made a choice, and you can change or withdraw it at any time."
            kept="Google's retention, not ours."
          />
        ) : (
          <Keep
            title="Advertising"
            data="None."
            why="Drift shows no advertising and loads nothing from an advertising network."
            basis="Not applicable. If advertising is ever introduced it will run on your consent under Article 6(1)(a) and on nothing else, this page will be updated first, and you will be asked before anything from an advertiser loads."
            kept="Not applicable."
          />
        )}
      </Section>

      {/* Article 13(1)(e): the recipients or categories of recipients. Naming
          them is more useful than a category, and at this size there are five. */}
      <Section title="Who else sees it">
        <P>
          Drift runs on other people&apos;s computers, so a handful of companies
          handle some of this data in the course of running the service. They
          process it on our instructions and for no purpose of their own.
        </P>
        <Bullets>
          <li>
            <Lead>Vercel Inc. </Lead>Hosting and the content network that serves
            the app.
          </li>
          <li>
            <Lead>Supabase Inc. </Lead>The database that holds your account,
            trails, reactions, interests, settings, handle, friends and shares,
            and the authentication that signs you in.
          </li>
          <li>
            <Lead>Resend </Lead>(Plus Five Five, Inc.). Sends the emails listed
            above.
          </li>
          <li>
            <Lead>Cloudflare, Inc. </Lead>
            {turnstile
              ? "The bot check on the contact form, which receives your IP address, and the routing of email sent to the address above."
              : "Routes email sent to the address above to the operator's mailbox."}
          </li>
          {providers.length > 0 && (
            <li>
              <Lead>
                {providers.map((p) => PROVIDER_ENTITY[p]).join(" and ")}.{" "}
              </Lead>
              Only if you choose to sign in that way. In that case the provider
              tells us your email address and confirms it is yours, and knows
              that you signed in to Drift. Signing in with an email and password
              instead avoids this entirely.
            </li>
          )}
        </Bullets>
        <P>
          That is the complete list. Nothing is sold, nothing goes to an
          advertising network, and there is no analytics provider of any kind.
        </P>
      </Section>

      {/* Article 13(1)(f): third country transfers, the mechanism relied on, and
          how to get a copy of it. Written without asserting a certification we
          have not checked per provider (that check is on the owner's list), so
          it states the mechanism that applies in each case rather than claiming
          a particular one applies to a particular company. */}
      <Section title="Where in the world it goes">
        <P>
          The companies above are American, and although they run European
          infrastructure, some data can reach the United States. Where it does,
          the transfer rests on one of two things: the European Commission&apos;s
          adequacy decision of 10 July 2023 for the EU and US Data Privacy
          Framework, where the recipient is certified under that framework, or
          otherwise the European Commission&apos;s Standard Contractual Clauses,
          which form part of each provider&apos;s own terms.
        </P>
        <P>
          You can ask which of the two applies to a particular provider, and for
          a copy of it, by <A href="/contact">writing to us</A>.
        </P>
      </Section>

      <Section title="Cookies and what sits in your browser">
        {USES_ADSENSE ? (
          <P>
            Drift uses Google AdSense to help keep it free. Nothing from Google
            loads until you have made a choice, and if you decline, nothing from
            Google loads at all. You can change or withdraw that choice at any
            time from the &ldquo;Cookie settings&rdquo; link in the footer.
            Everything else is essential only: a secure sign-in token so you stay
            logged in, your saved trails and settings, and small preferences like
            dark mode. Drift itself runs no tracking and no analytics.
          </P>
        ) : (
          <>
            <P>
              <Lead>Drift sets no browser cookies at all. </Lead>No tracking
              cookies, no advertising, no third-party analytics. There is nothing
              here that follows you around the web, and therefore nothing to opt
              out of.
            </P>
            <P>
              To work at all it does keep a few things in your browser&apos;s own
              storage: a sign-in token so you stay logged in, your trails and
              settings so the app works offline, and small preferences like dark
              mode. All of those are things you asked for by using Drift, which
              is what Article 11.7a of the Telecommunicatiewet calls strictly
              necessary, so none of them needs your consent.
            </P>
            <P>
              Drift shows no advertising and loads nothing from an advertising
              network. If that changes, this page will be updated first, and you
              will be asked before anything from an advertiser loads.
            </P>
          </>
        )}
      </Section>

      {/* Articles 13(2)(b), (c) and (d). Each right is paired with the thing a
          reader can actually do about it today. */}
      <Section title="What you can do about all this">
        <Bullets>
          <li>
            <Lead>See it and take it with you. </Lead>
            <A href="/account">Download your data</A> gives you one file with
            everything Drift holds about you, in a format any program can read.
            That covers both your right of access (Article 15) and your right to
            portability (Article 20), and you never have to ask.
          </li>
          <li>
            <Lead>Correct it. </Lead>Your handle, display name and settings you
            can change yourself. For anything else, write and it will be fixed
            (Article 16).
          </li>
          <li>
            <Lead>Delete it. </Lead>
            <A href="/account">Delete account</A> removes your account and
            everything attached to it, permanently and without having to ask
            anyone (Article 17).
          </li>
          <li>
            <Lead>Object, or ask us to pause. </Lead>You can object to anything
            done on the basis of a legitimate interest, which here means only the
            spam checks on the contact form (Article 21), and you can ask us to
            restrict a use while a disagreement is sorted out (Article 18).
          </li>
          <li>
            <Lead>Withdraw consent. </Lead>Nothing on Drift currently runs on
            consent, so there is nothing to withdraw. If advertising is
            introduced it will run on consent alone, and withdrawing it will be
            as easy as giving it.
          </li>
          <li>
            <Lead>Complain. </Lead>If you think Drift is handling your data
            wrongly, tell us first, but you do not have to. You can go straight to
            the{" "}
            <A href="https://www.autoriteitpersoonsgegevens.nl">
              Autoriteit Persoonsgegevens
            </A>
            , the Dutch supervisory authority, or to the authority in the EU
            country where you live or work.
          </li>
        </Bullets>
        <P>
          Whatever you ask for, you get an answer within one month, which is what
          Article 12(3) allows.
        </P>
      </Section>

      {/* Article 13(2)(e): whether providing the data is a statutory or
          contractual requirement, and what happens if you do not. */}
      <Section title="Do you have to give any of this?">
        <P>
          No law requires you to give Drift anything. Your email address is a
          contractual requirement: it is how you sign in, so without one there is
          no account and no way to use the hosted app. There is no other
          consequence, because there is nothing else Drift asks for. A name, a
          handle and a display name are all optional, and Drift works fully
          without them.
        </P>
      </Section>

      {/* Article 13(2)(f): the existence of automated decision-making within
          Article 22. Stating that there is none is itself the disclosure. */}
      <Section title="Decisions made about you">
        <P>
          There are none. Nothing about your account is decided automatically,
          and there is no profiling of the kind Article 22 GDPR is about. The
          interests model orders your own cards for you and has no other effect:
          it cannot restrict your account, it is never shown to anyone else, and
          it is not used to target anything at you. Every decision that affects
          your account, including anything following a report, is made by a
          person. <A href="/terms">The terms</A> set that out.
        </P>
      </Section>

      <Section title="Children">
        <P>
          Drift is not intended for people under 16 and is not directed at
          children. We do not knowingly collect data from anyone under 16. If you
          believe a child has created an account, <A href="/contact">tell us</A>{" "}
          and it will be deleted.
        </P>
      </Section>

      <Section title="Where the content comes from">
        <P>
          The cards themselves are made from openly licensed human knowledge:
          Wikipedia articles, under <LicenseLink license={CC_BY_SA_4} />, and
          public-domain artworks from the Art Institute of Chicago, under{" "}
          <LicenseLink license={CC0_1} />. Every card links to the page it came
          from, whose history credits the people who wrote it, and every image
          carries its own creator and licence. Drift only reshapes that content
          into cards and threads. It never invents facts.{" "}
          <A href="/sources">Sources</A> has the full account.
        </P>
      </Section>

      <Section title="Changes to this page">
        <P>
          Changes are published here with a new date at the top. If a change is
          significant, it will be sent to the email address on your account
          before it takes effect.
        </P>
      </Section>

      <p className="border-t border-line pt-6 text-sm text-ink-soft">
        Questions about any of this are always welcome. You can{" "}
        <A href="/contact">get in touch</A> any time.
      </p>
    </PublicPage>
  );
}

/**
 * One processing activity: what, why, on what basis, and for how long. The four
 * lines are exactly what Articles 13(1)(c), 13(1)(d) and 13(2)(a) ask for, and
 * keeping them in one component means a new activity cannot be added with one of
 * them missing.
 */
function Keep({
  title,
  data,
  why,
  basis,
  kept,
}: {
  title: string;
  data: ReactNode;
  why: ReactNode;
  basis: ReactNode;
  kept: ReactNode;
}) {
  return (
    <div className="mt-4 rounded-xl border border-line bg-paper-raised p-4 first:mt-3">
      <p className="font-serif text-lg text-ink">{title}</p>
      <dl className="mt-2 space-y-1.5 text-sm leading-relaxed text-ink-soft">
        <Field label="What">{data}</Field>
        <Field label="Why">{why}</Field>
        <Field label="Basis">{basis}</Field>
        <Field label="Kept">{kept}</Field>
      </dl>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="inline text-ink">{label}. </dt>
      <dd className="inline">{children}</dd>
    </div>
  );
}

/** The contact address, as a mailto. Written out rather than hidden behind a
 *  word, because someone acting on it may need to copy it into a letter. */
function Mail({ address }: { address: string }) {
  return (
    <a
      href={`mailto:${address}`}
      className="text-accent-strong hover:underline"
    >
      {address}
    </a>
  );
}
