// ---------------------------------------------------------------------------
// The imprint: who legally runs Drift.
//
// WHY IT EXISTS. Article 3:15d(1) of the Burgerlijk Wetboek, implementing
// Article 5 of the e-Commerce Directive, requires a provider of an information
// society service to make certain details "gemakkelijk, rechtstreeks en
// permanent toegankelijk" — easily, directly and permanently accessible:
//
//   (a) identity and address of establishment
//   (b) details enabling rapid, direct and effective communication, including
//       an electronic mail address
//   (c) the trade register and registration number, insofar as registered
//   (f) the VAT identification number, insofar as a VAT-liable activity is
//       carried on
//
// Dutch enforcement practice is strict about "easily and directly accessible":
// burying the identity in general terms and conditions is not enough, and a
// trade name alone is not enough because trade names need not be registered.
// Hence a page of its own, linked from every public footer, naming the natural
// person as well as the trade name (compliance audit M-6).
//
// The details are here rather than in the page so that /privacy can name the
// same controller without the two being able to disagree. GDPR Article 13(1)(a)
// wants the controller's identity and contact details, which is the same fact.
//
// ⚠️ VAT. Sub (f) is conditional: it applies "voor zover" a VAT-liable activity
// is carried on. Drift takes no payment, shows no advertising and earns nothing,
// so it is not currently such an activity and no VAT number is published. That
// changes the day advertising runs, which is a VAT-relevant economic activity.
// Rather than publish a placeholder, the field is absent and the owner's list
// carries the task. See docs/owner-actions.md.
// ---------------------------------------------------------------------------

import { contactAddress } from "./site";

export interface ImprintDetails {
  /** The legal person. For a sole trader that is the natural person, not the
   *  trade name, which is why both appear. */
  legalName: string;
  /** The registered trade name this service operates under. */
  tradeName: string;
  /** The other trade name on the same registration, named so that a reader who
   *  looks Drift up in the Handelsregister and finds a different name on the
   *  entry is not left wondering whether they have the right person. */
  alsoTradingAs: string;
  /** The establishment address, as registered with the KvK. */
  address: string[];
  /** Netherlands Chamber of Commerce number. */
  kvk: string;
  /** Published contact address. */
  email: string;
  /** VAT identification number, once a VAT-liable activity is carried on. */
  vat?: string;
}

export function imprint(): ImprintDetails {
  return {
    legalName: "Thomas van der Hulst",
    tradeName: "Usedrift",
    alsoTradingAs: "RiskOptimix",
    address: ["Uilenstede 138", "1183 AN Amstelveen", "Netherlands"],
    kvk: "90992318",
    email: contactAddress(),
  };
}
