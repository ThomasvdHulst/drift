// ---------------------------------------------------------------------------
// The Terms of Service, as data.
//
// WHY A REGISTRY AND NOT A PAGE. DSA Article 14(1) requires the terms to be
// "publicly available in an easily accessible and machine-readable format". The
// cheapest honest way to satisfy that is to keep the text in one place and emit
// it twice: `/terms` renders it for people, `/terms.md` serves the same words as
// Markdown for anything reading it as a document. Writing the page twice by hand
// would satisfy the Article for exactly as long as it took the two copies to
// disagree, which is the failure mode the whole compliance exercise is about.
//
// The text is plain strings with two pieces of inline markup, `**strong**` and
// `[label](href)`, parsed by `parseInline` below. That keeps the source readable
// as prose and the Markdown output free, at the cost of no arbitrary JSX inside
// a clause. For a document like this that is the right trade.
//
// SCOPE, decided by the audit and worth not relitigating: Drift is a hosting
// service under DSA Article 3(g)(iii), but NOT an online platform, because
// sharing reaches only mutual friends and that restriction is enforced by a
// database policy rather than by the interface (see supabase/migrations,
// `are_friends()` in the shares insert policy). So Articles 20 to 28 do not
// apply: no internal complaint-handling system, no out-of-court dispute body, no
// trusted flaggers. Do not add clauses promising any of those. Article 15(2)
// exempts a micro enterprise from transparency reporting. What is live is
// Articles 11, 12, 14, 16, 17 and 18.
// ---------------------------------------------------------------------------

/** The date these terms took effect. Shown on the page and in the Markdown. */
export const TERMS_EFFECTIVE = "31 July 2026";

export type TermsBlock = { p: string } | { bullets: string[] };

export interface TermsSection {
  /** Stable anchor, so a decision notice can link to the clause it relied on. */
  id: string;
  heading: string;
  blocks: TermsBlock[];
}

export const TERMS_INTRO =
  "The rules for using Drift, and what you can expect in return. Written to be read, not to be survived.";

export const TERMS: TermsSection[] = [
  {
    id: "who",
    heading: "Who you are agreeing with",
    blocks: [
      {
        p: "Drift is built and run by one person in the Netherlands. There is no company, no team, and nobody else to escalate to. Everything below is an agreement between you and that person.",
      },
      {
        p: "The way to reach the operator is [the contact form](/contact), which also carries the official points of contact for authorities and for users of the service.",
      },
    ],
  },
  {
    id: "eligibility",
    heading: "Who may use Drift",
    blocks: [
      {
        p: "**You must be at least 16 years old.** That is the age at which a person can consent to the processing of their own data under Dutch law, and Drift is not built for children.",
      },
      {
        p: "An account is for one person. You are responsible for what happens under yours, including keeping your password to yourself.",
      },
    ],
  },
  {
    id: "what-drift-is",
    heading: "What Drift is",
    blocks: [
      {
        p: "Drift is a reading app. It shows you cards built from openly licensed sources, and lets you steer where you go next by pulling the threads on each card. It saves the trail you made, and it can show you that trail as a map.",
      },
      {
        p: "It is free. There is no subscription, no paid tier, and nothing you can buy. If that ever changes, it changes here first.",
      },
    ],
  },
  {
    id: "content",
    heading: "The content, and what you may do with it",
    blocks: [
      {
        p: "Almost everything you read on a card was written or made by someone else. Article text comes from Wikipedia under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Artworks come from The Art Institute of Chicago under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Each image on a Wikipedia card is a separate work with its own creator and its own licence, named on the card itself.",
      },
      {
        p: "**Drift claims no rights in any of it, and adds no conditions to it.** That material stays available to you under its own licence, exactly as if you had gone to the source. Nothing in these terms restricts what you may do with it: not copying it, not redistributing it, not building on it. Where a licence asks something of you, such as crediting the author and passing the same licence on, that comes from the licence and not from us. [Sources](/sources) explains where each piece comes from.",
      },
      {
        p: "What is ours is the rest: Drift's software, its name and logo, its writing, and the way it is put together. Those are not covered by the licences above, and these terms do not give you rights in them.",
      },
    ],
  },
  {
    id: "rules",
    heading: "What you may not do",
    blocks: [
      {
        p: "Drift lets you choose a handle and a display name, and lets you send a trail or a card to someone who has accepted you as a friend. Those are the only ways your words reach another person, and they are the ones these rules are about.",
      },
      {
        bullets: [
          "**Nothing illegal.** Do not store or send anything that is against the law where you are or where the operator is.",
          "**No harassment.** Do not use a share, a handle or a display name to threaten, intimidate or distress another person.",
          "**No impersonation.** Do not take a handle or display name that presents you as someone you are not, whether a person, an organisation or a brand.",
          "**No sending to strangers.** Do not try to route content to someone who has not accepted you as a friend. The database enforces this, so it should not be possible; do not go looking for a way around it either.",
          "**Do not attack the service or its sources.** No scraping the API in bulk, no attempts to overload it, no working around rate limits. Drift reads from Wikipedia and from a museum, and abuse here lands on them.",
          "**No harvesting.** Do not use Drift to collect other people's personal data, including handles and display names.",
        ],
      },
    ],
  },
  {
    id: "moderation",
    heading: "How moderation actually works",
    blocks: [
      {
        p: "DSA Article 14(1) asks for this to be set out plainly, including any algorithmic decision-making and any human review. The honest description is short.",
      },
      {
        bullets: [
          "**Nothing is scanned.** Drift does not monitor what you save, and it does not scan what you send to a friend. There is no filter and no automated detection of any kind.",
          "**A model orders cards. It does not moderate.** An optional local language model can label threads and rank what comes next. It never removes anything, never restricts an account, and never writes card text. It has no part in any decision covered by these terms.",
          "**Every decision is made by a person.** When a report comes in, the operator reads it and decides. Nothing about your account is decided automatically, which also means there is no automated decision-making of the kind Article 22 GDPR is about.",
          "**We act on notice.** Because nothing is scanned, a report is the only way something comes to our attention.",
        ],
      },
    ],
  },
  {
    id: "reporting",
    heading: "Reporting illegal content",
    blocks: [
      {
        p: "Anyone can report content on Drift they believe is illegal, whether or not they have an account. Go to [the contact form](/contact) and choose **Report illegal content**. This is the mechanism DSA Article 16 requires, and it is the fastest way to reach the operator about something serious.",
      },
      {
        p: "A report is most useful when it says three things: where the content is, why you believe it is against the law, and that what you have written is accurate to the best of your knowledge. The form asks for exactly those.",
      },
      {
        p: "**You do not have to give your name.** We ask for an email address so that we can confirm we received your report and tell you what we decided, and we cannot do either without one. It is not required. A report about an offence under Articles 3 to 7 of Directive 2011/93/EU, which covers child sexual abuse material, can always be made anonymously.",
      },
      {
        p: "If you leave an address, you get an automatic confirmation that the report arrived, and later a message saying what was decided and how to challenge it.",
      },
    ],
  },
  {
    id: "consequences",
    heading: "What happens if a rule is broken",
    blocks: [
      {
        p: "Depending on what happened, the operator may remove a share, remove or reset a handle or display name, suspend an account, or close one. The response is meant to match the problem: a handle that reads as impersonation gets reset, it does not cost you your trails.",
      },
      {
        p: "Whatever is done, you get a message saying what was restricted, why, whether the reason was these terms or a law and which part, and whether a person or an automated tool decided. It is always a person. That is what DSA Article 17 calls a statement of reasons.",
      },
      {
        p: "**If you think a decision was wrong, say so.** Reply to that message or write through [the contact form](/contact), and the operator will look again. Being one person, that is genuinely a second look at the same facts by the same reader, and it is worth being clear about that rather than dressing it up as an appeals process. Drift is not an online platform under the DSA, because sharing only ever reaches mutual friends, so the formal internal complaint and out-of-court dispute systems in Articles 20 and 21 do not apply to it.",
      },
      {
        p: "What you always have, whatever we decide, is a court. You can also raise a matter with the [Autoriteit Consument en Markt](https://www.acm.nl), which supervises the DSA in the Netherlands, or with the [Autoriteit Persoonsgegevens](https://www.autoriteitpersoonsgegevens.nl) for anything about your personal data.",
      },
    ],
  },
  {
    id: "safety",
    heading: "If someone is in danger",
    blocks: [
      {
        p: "If the operator becomes aware of information that raises a suspicion that a criminal offence involving a threat to someone's life or safety has happened, is happening or is likely to happen, they will tell the police or judicial authorities of the country concerned, or Europol, and pass on what they know. This is DSA Article 18, and it applies whatever else these terms say about privacy.",
      },
    ],
  },
  {
    id: "ending",
    heading: "Ending it, from either side",
    blocks: [
      {
        p: "You can leave whenever you like. **Delete account** on [your account page](/account) removes your account and everything attached to it: trails, reactions, interests, settings, handle, friends and shares. It cannot be undone, so take a copy first if you want one.",
      },
      {
        p: "**Download your data** on the same page gives you a single JSON file with everything Drift holds about you. You never have to ask for it.",
      },
      {
        p: "The operator can suspend or close an account that breaks these terms, and can stop running Drift altogether. If Drift is going to shut down, that will be said here and by email to the address on your account, with enough time to export what you want to keep.",
      },
    ],
  },
  {
    id: "no-warranty",
    heading: "What is not promised",
    blocks: [
      {
        p: "Drift is free and is provided as it is. There is no promise that it will be available, that it will keep working, that it is free of errors, or that anything you save will survive. It is a personal project run by one person on a hobby budget, and the export exists so that you never have to rely on it for anything you would miss.",
      },
      {
        p: "The content is not ours and is not checked by us. Wikipedia can be wrong, and a museum record can be incomplete. Drift reshapes what those sources say into cards and does not verify any of it. Do not treat a card as advice, medical, legal, financial or otherwise.",
      },
      {
        p: "Liability is limited as far as the law allows. **Nothing here limits liability for death or personal injury caused by negligence, for intent or gross negligence, or anything else that cannot lawfully be excluded**, and if you are a consumer, nothing here takes away rights your own country's law gives you.",
      },
    ],
  },
  {
    id: "changes",
    heading: "Changes to these terms",
    blocks: [
      {
        p: "Changes are published on this page with a new date at the top. If a change is significant, it will be sent to the email address on your account before it takes effect, which is what DSA Article 14(2) asks for. Carrying on using Drift after that means the new version applies.",
      },
    ],
  },
  {
    id: "law",
    heading: "Which law applies",
    blocks: [
      {
        p: "Dutch law governs these terms, and the courts of the Netherlands have jurisdiction.",
      },
      {
        p: "If you are a consumer resident in the EU, that does not take away the protection of the mandatory consumer rules of the country you live in, and you can still bring a claim in your own country's courts.",
      },
    ],
  },
];
