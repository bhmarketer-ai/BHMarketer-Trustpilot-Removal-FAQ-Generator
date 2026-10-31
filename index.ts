#!/usr/bin/env node
/**
 * @bhmarketer-ai/trustpilot-removal-faq-generator
 * BHMarketer Trustpilot Removal FAQ Generator: library and CLI.
 *
 * (1) Checks a Trustpilot review against the reasons Trustpilot accepts when a
 *     business reports a review, scoring removal eligibility from 0 to 100.
 * (2) Generates a tailored Trustpilot review removal FAQ as text, Markdown,
 *     JSON, FAQPage JSON-LD or HTML.
 *
 *   npx tp-faq analyze "review text" --no-record
 *   npx tp-faq generate --review "review text" --format jsonld
 *
 * The score is an estimate to guide a report, not a guarantee: Trustpilot's
 * Content Integrity team makes the final decision. Not affiliated with Trustpilot.
 * Built by BHMarketer.ai (https://bhmarketer.ai). MIT License.
 */

export const VERSION = "1.0.0";
export const WEBSITE = "https://bhmarketer.ai";
export const SERVICE_PAGE = "https://bhmarketer.ai/trustpilot-review-removal/";
export const REPO = "https://github.com/bhmarketer-ai/BHMarketer-Trustpilot-Removal-FAQ-Generator";

export interface Reason { id: string; label: string; description: string; evidence: string; note: string; }
export interface KbFaq { id: number; tags: string[]; question: string; answer: string; }
export interface Faq { question: string; answer: string; }
export interface Facts {
  no_record?: boolean; product_not_sold?: boolean; location_not_exist?: boolean;
  competitor?: boolean; wrong_business?: boolean; staff?: string[]; other?: string[];
}
export interface ReasonResult { id: string; label: string; score: number; signals: string[]; evidence: string; note: string; }
export interface Analysis { eligibility: number; band: string; advice: string; reasons: ReasonResult[]; }

export const REASONS: Reason[] = [
  {"id": "harmful-illegal", "label": "Harmful or illegal", "description": "Threats, hate speech, harassment, discriminatory or obscene language, or other content that breaks the law.", "evidence": "The exact sentences that are threatening, hateful or unlawful.", "note": "Trustpilot hides reviews flagged for this reason while it investigates."},
  {"id": "personal-information", "label": "Contains personal information", "description": "Names, phone numbers, email addresses, home addresses or other details that identify a private person.", "evidence": "The personal details in the review and confirmation they are not already public on your profile or website.", "note": "Trustpilot will not remove information that is already on your Trustpilot profile or website, or the reviewer's own details."},
  {"id": "advertising-promotional", "label": "Advertising or promotional", "description": "Links, promo codes or calls to action for another business, or content that only promotes a political, religious or ethical view.", "evidence": "The link, code or promotional wording, and why it is unrelated to a real experience.", "note": "Mentioning or comparing a competitor is not enough on its own."},
  {"id": "not-genuine", "label": "Not based on a genuine experience", "description": "The reviewer never bought, used or contacted your business, or the review describes a product, staff member or location you do not have.", "evidence": "Records showing no matching order or contact, or facts in the review that cannot be true for your business.", "note": "A reviewer can be genuine even if you cannot find them in your records, so evidence matters more than suspicion."},
  {"id": "different-business", "label": "About a different business", "description": "The review is clearly about another company, product or website, not yours.", "evidence": "The other business named or described in the review and how it differs from yours.", "note": "Only businesses can report for this reason."}
];

export const FAQS: KbFaq[] = [
  {"id": 1, "tags": ["core"], "question": "Can a business remove a Trustpilot review?", "answer": "Not directly. A business can report a review that breaks Trustpilot's guidelines, and Trustpilot's Content Integrity team decides whether it comes down. Reviews that are negative but genuine stay online."},
  {"id": 2, "tags": ["core"], "question": "Which Trustpilot reviews can be removed?", "answer": "Reviews that are harmful or illegal, contain personal information, are advertising or promotional, are not based on a genuine experience, or are about a different business. These are the reasons Trustpilot accepts when a business reports a review."},
  {"id": 3, "tags": ["core", "not-removable"], "question": "Will Trustpilot remove a negative review just because it is unfair?", "answer": "No. Trustpilot keeps honest opinions online, even harsh ones. A review only qualifies for removal when it breaks a specific guideline, so the first step is always to check which guideline, if any, it breaks."},
  {"id": 4, "tags": ["core"], "question": "How do I report a Trustpilot review?", "answer": "Log in to your Trustpilot Business account, find the review, click the flag icon and choose the reason that matches the guideline it breaks. Add a short, factual explanation and any supporting evidence."},
  {"id": 5, "tags": ["core"], "question": "Does a reported review stay visible during the investigation?", "answer": "Usually yes. Trustpilot keeps reported reviews online while it investigates, except reviews flagged as harmful or illegal, which are hidden during the check."},
  {"id": 6, "tags": ["core"], "question": "What happens if Trustpilot agrees with the report?", "answer": "Trustpilot removes the review because it breaches its guidelines and lets the reviewer know. If Trustpilot disagrees, the review stays and you can still reply to it publicly."},
  {"id": 7, "tags": ["core"], "question": "Can reporting reviews get my business in trouble?", "answer": "Reporting a review that genuinely breaks the guidelines is allowed. Misusing the flagging tool, for example reporting every negative review, is not tolerated by Trustpilot and can lead to action against the business."},
  {"id": 8, "tags": ["core", "not-removable"], "question": "What should I do if a review cannot be removed?", "answer": "Reply publicly, calmly and factually, offer to resolve the issue, and keep inviting all genuine customers to review you through a fair, neutral invitation process. A thoughtful reply often matters more to readers than the review itself."},
  {"id": 9, "tags": ["harmful-illegal"], "question": "What counts as harmful or illegal content on Trustpilot?", "answer": "Threats, hate speech, harassment, discriminatory or obscene language, and content that breaks the law. Calling a service bad is an opinion; threatening a staff member is harmful content."},
  {"id": 10, "tags": ["harmful-illegal"], "question": "Is a review defamatory if it says my service is terrible?", "answer": "No. Opinions such as \"I did not like their service\" are not statements of fact, so they are not defamation. False statements of fact that harm your business are a different matter and may need legal advice."},
  {"id": 11, "tags": ["personal-information"], "question": "Can a review be removed for naming my staff?", "answer": "It can be reported if it includes personal information that identifies a private person, such as a full name with contact details. Information already shown on your Trustpilot profile or website does not count."},
  {"id": 12, "tags": ["personal-information"], "question": "What personal information breaks Trustpilot's guidelines?", "answer": "Details that identify a private person, such as phone numbers, email addresses, home addresses or full names combined with other identifying details. A reviewer sharing their own details is not a reason for removal."},
  {"id": 13, "tags": ["advertising-promotional"], "question": "Can I report a review that promotes a competitor?", "answer": "Yes, if it advertises another business, for example with links, promo codes or calls to action unrelated to the reviewer's experience. A review that simply mentions or compares a competitor is allowed."},
  {"id": 14, "tags": ["advertising-promotional"], "question": "What about reviews that are really political or social posts?", "answer": "Reviews written only to push a political, religious or ethical view, or only about a trending news topic, rather than feedback on a genuine experience, can be reported as promotional."},
  {"id": 15, "tags": ["not-genuine"], "question": "How do I prove a reviewer was never a customer?", "answer": "Search your orders, bookings, emails and support tickets for any match. A strong report explains what you searched and points to facts in the review that cannot be true, such as a product you do not sell or a location you do not have."},
  {"id": 16, "tags": ["not-genuine"], "question": "Is \"I cannot find this customer\" enough to remove a review?", "answer": "No. A genuine experience includes calls, chats, emails and support contact, and people sometimes review under a different name. Trustpilot looks for evidence, not just a missing record."},
  {"id": 17, "tags": ["not-genuine"], "question": "Can a review from a competitor or former employee be removed?", "answer": "A review written to undermine a competitor or by someone without a genuine customer experience can be reported as not based on a genuine experience. Show the connection with evidence rather than just claiming it."},
  {"id": 18, "tags": ["different-business"], "question": "What if the review is about a different company?", "answer": "Businesses can report a review that is clearly about another business. Point out the other company, product or website it describes and how that differs from yours."},
  {"id": 19, "tags": ["service"], "question": "How does BHMarketer.ai help with Trustpilot review removal?", "answer": "BHMarketer.ai checks each review against Trustpilot's guidelines first, prepares a clear evidence-based report for the reviews that qualify, and handles follow-up. Reviews that do not break a guideline are not reported."},
  {"id": 20, "tags": ["service"], "question": "What is BHMarketer.ai's removal guarantee?", "answer": "No removal, no fee. If a rule-breaking review is not taken down, you do not pay for that review."},
  {"id": 21, "tags": ["service"], "question": "Does BHMarketer.ai write or buy fake reviews?", "answer": "Never. BHMarketer.ai only uses legitimate guideline-based reporting. Buying, incentivizing or faking reviews breaks Trustpilot's rules and is never part of the process."},
  {"id": 22, "tags": ["service"], "question": "Do I need a Trustpilot Business account?", "answer": "Reporting is done from a Trustpilot Business account, and claiming your free profile also lets you reply to reviews. BHMarketer.ai can guide you through setting it up."},
  {"id": 23, "tags": ["service"], "question": "Can you remove every negative Trustpilot review?", "answer": "No, and no honest provider can. Only reviews that break Trustpilot's guidelines can be reported. BHMarketer.ai tells you upfront which reviews qualify and which are better handled with a public reply."},
  {"id": 24, "tags": ["service"], "question": "Is my business information kept private?", "answer": "Yes. Order records and evidence you share are used only to prepare the report for your case."},
  {"id": 25, "tags": ["service"], "question": "Does BHMarketer.ai handle reviews on other platforms too?", "answer": "Yes. BHMarketer.ai also handles guideline-based review removal for Google, Glassdoor and Airbnb, plus press release distribution and AI search visibility."}
];

export const BANDS: [number, number, string, string][] = [
  [0, 30, "Unlikely", "No clear guideline breach found. Reply publicly instead of reporting."],
  [31, 60, "Possible", "A guideline may apply. Gather stronger evidence before reporting."],
  [61, 80, "Likely", "A guideline probably applies. Report with the evidence listed."],
  [81, 100, "Strong case", "A clear guideline breach. Report it with the evidence listed."],
];

const THREAT_WORDS = ["kill you", "kill him", "kill her", "hurt you", "burn down", "find you", "find where you live",
  "beat you", "watch your back", "you will pay", "coming for you"];
const ABUSE_WORDS = ["fuck", "fucking", "shit", "bitch", "bastard", "asshole", "cunt", "retard", "whore"];
const NOT_GENUINE_CUES = ["never used", "never bought", "never ordered", "never tried", "have not used",
  "haven't used", "havent used", "not a customer", "my friend said", "a friend told",
  "someone told me", "i heard", "heard that", "i read that", "apparently"];
const PROMO_CUES = ["use code", "promo code", "discount code", "coupon", "referral code", "% off"];
const CTA_CUES = ["buy from", "go to", "visit ", "check out", "switch to", "sign up at", "order from"];

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/;
const EMAIL_RE_G = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g;
const PHONE_RE = /\+\d[\d\s().-]{7,}\d|\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/;
const URL_RE = /(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|co|shop|store|ai)\b/;
const ADDRESS_RE = /\b\d{1,5}\s+\w+(?:\s\w+)?\s+(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr)\b|lives at|home address/;

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function hits(text: string, words: string[]): string[] {
  return words.map((w) => w.trim()).filter((w) => new RegExp("(?<!\\w)" + esc(w) + "(?!\\w)").test(text));
}

export function band(score: number): [string, string] {
  for (const [low, high, label, advice] of BANDS) if (score >= low && score <= high) return [label, advice];
  return ["Unlikely", ""];
}

export function analyze(review: string, facts: Facts = {}): Analysis {
  const text = String(review).toLowerCase().split(/\s+/).filter(Boolean).join(" ");
  const found: Record<string, string[]> = {};
  const score: Record<string, number> = {};
  REASONS.forEach((r) => { found[r.id] = []; score[r.id] = 0; });
  const add = (reason: string, points: number, signal: string) => {
    score[reason] = Math.min(100, score[reason] + points);
    found[reason].push(signal);
  };

  for (const w of hits(text, THREAT_WORDS)) add("harmful-illegal", 85, `threatening language: "${w}"`);
  for (const w of hits(text, ABUSE_WORDS)) add("harmful-illegal", 35, `abusive language: "${w}"`);

  if (EMAIL_RE.test(text)) add("personal-information", 60, "email address in the review");
  if (PHONE_RE.test(text)) add("personal-information", 60, "phone number in the review");
  if (ADDRESS_RE.test(text)) add("personal-information", 50, "home or street address in the review");
  for (const name of facts.staff ?? []) {
    if (name && text.includes(name.toLowerCase()))
      add("personal-information", 40, `names staff member "${name}" (not removable if shown on your profile or website)`);
  }

  if (URL_RE.test(text.replace(EMAIL_RE_G, " "))) add("advertising-promotional", 45, "link or website address in the review");
  for (const w of hits(text, PROMO_CUES)) add("advertising-promotional", 50, `promotional wording: "${w}"`);
  for (const w of hits(text, CTA_CUES)) add("advertising-promotional", 20, `call to action: "${w}"`);

  if (facts.no_record) add("not-genuine", 40, "no matching order, booking or contact found in your records");
  if (facts.product_not_sold) add("not-genuine", 45, "mentions a product or service you do not sell");
  if (facts.location_not_exist) add("not-genuine", 45, "mentions a location you do not have");
  if (facts.competitor) add("not-genuine", 40, "evidence the reviewer is a competitor or former employee");
  for (const w of hits(text, NOT_GENUINE_CUES)) add("not-genuine", 35, `second-hand or no-experience wording: "${w}"`);

  if (facts.wrong_business) add("different-business", 80, "you confirmed the review is about another business");
  for (const name of facts.other ?? []) {
    if (name && text.includes(name.toLowerCase())) add("different-business", 50, `names another business: "${name}"`);
  }

  const order = REASONS.map((r) => r.id);
  const reasons: ReasonResult[] = REASONS.filter((r) => score[r.id] > 0).map((r) => ({
    id: r.id, label: r.label, score: score[r.id], signals: found[r.id], evidence: r.evidence, note: r.note,
  }));
  reasons.sort((a, b) => b.score - a.score || order.indexOf(a.id) - order.indexOf(b.id));
  const eligibility = reasons.length ? reasons[0].score : 0;
  const [label, advice] = band(eligibility);
  return { eligibility, band: label, advice, reasons };
}

export function generate(reasons: string[] = [], includeService = true): Faq[] {
  const out: KbFaq[] = FAQS.filter((f) => f.tags.includes("core"));
  for (const rid of reasons) out.push(...FAQS.filter((f) => f.tags.includes(rid) && !out.includes(f)));
  if (includeService) out.push(...FAQS.filter((f) => f.tags.includes("service") && !out.includes(f)));
  return out.map((f) => ({ question: f.question, answer: f.answer }));
}

const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

export function toMarkdown(faqs: Faq[], title = "Trustpilot Review Removal FAQ"): string {
  const lines = [`# ${title}`, ""];
  faqs.forEach((f, i) => lines.push(`## ${i + 1}. ${f.question}`, "", f.answer, ""));
  lines.push(`*Generated by the BHMarketer Trustpilot Removal FAQ Generator. Learn more: ${SERVICE_PAGE}*`);
  return lines.join("\n") + "\n";
}

export function toJsonLd(faqs: Faq[]): string {
  return JSON.stringify({
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  }, null, 2);
}

export function toHtml(faqs: Faq[], title = "Trustpilot Review Removal FAQ"): string {
  const items = faqs.map((f) => `  <h3>${escHtml(f.question)}</h3>\n  <p>${escHtml(f.answer)}</p>`).join("\n");
  return `<section class="tp-faq">\n  <h2>${escHtml(title)}</h2>\n${items}\n</section>\n` +
    `<script type="application/ld+json">\n${toJsonLd(faqs)}\n</script>\n`;
}

export function toText(faqs: Faq[]): string {
  return faqs.map((f, i) => `Q${i + 1}. ${f.question}\n    ${f.answer}\n`).join("\n");
}

export function render(faqs: Faq[], fmt = "text"): string {
  if (fmt === "markdown") return toMarkdown(faqs);
  if (fmt === "json") return JSON.stringify(faqs, null, 2) + "\n";
  if (fmt === "jsonld") return toJsonLd(faqs) + "\n";
  if (fmt === "html") return toHtml(faqs);
  return toText(faqs);
}

interface Opts { json: boolean; format: string; reasons: string[]; service: boolean; review: string | null; tag: string | null; }

export function parseArgs(args: string[]): [string, Facts, Opts] {
  const facts: Facts = { staff: [], other: [] };
  const opts: Opts = { json: false, format: "text", reasons: [], service: true, review: null, tag: null };
  const words: string[] = [];
  const flags: Record<string, keyof Facts> = {
    "--no-record": "no_record", "--product-not-sold": "product_not_sold",
    "--location-not-exist": "location_not_exist", "--competitor": "competitor", "--wrong-business": "wrong_business",
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const hasNext = i + 1 < args.length;
    if (a in flags) (facts as Record<string, unknown>)[flags[a]] = true;
    else if (a === "--staff" && hasNext) facts.staff!.push(args[++i]);
    else if (a === "--other" && hasNext) facts.other!.push(args[++i]);
    else if (a === "--json") opts.json = true;
    else if (a === "--format" && hasNext) opts.format = args[++i];
    else if (a === "--reason" && hasNext) opts.reasons.push(args[++i]);
    else if (a === "--review" && hasNext) opts.review = args[++i];
    else if (a === "--tag" && hasNext) opts.tag = args[++i];
    else if (a === "--no-service") opts.service = false;
    else words.push(a);
  }
  return [words.join(" "), facts, opts];
}

const USAGE = `BHMarketer Trustpilot Removal FAQ Generator v${VERSION}

Usage:
  tp-faq analyze "review text" [--no-record] [--product-not-sold]
                 [--location-not-exist] [--competitor] [--wrong-business]
                 [--staff NAME] [--other BUSINESS] [--json]
  tp-faq generate [--review "review text" [facts]] [--reason ID]
                  [--format text|markdown|json|jsonld|html] [--no-service]
  tp-faq reasons
  tp-faq faqs [--tag TAG]

Estimate only. Trustpilot makes the final decision. Not affiliated with Trustpilot.
`;

export function main(argv: string[] = process.argv.slice(2)): number {
  if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") { console.log(USAGE); return 0; }
  const [cmd, ...rest] = argv;
  if (cmd === "--version") { console.log(VERSION); return 0; }
  const [text, facts, opts] = parseArgs(rest);

  if (cmd === "reasons") {
    for (const r of REASONS) console.log(`${r.id.padEnd(24)} ${r.label}\n${"".padEnd(24)} ${r.description}`);
    return 0;
  }
  if (cmd === "faqs") {
    for (const f of FAQS) if (!opts.tag || f.tags.includes(opts.tag))
      console.log(`${String(f.id).padStart(2)}. [${f.tags.join(", ")}] ${f.question}`);
    return 0;
  }
  if (cmd === "analyze") {
    if (!text) { console.log('Give the review text, e.g. tp-faq analyze "review text"'); return 1; }
    const res = analyze(text, facts);
    if (opts.json) { console.log(JSON.stringify(res, null, 2)); return 0; }
    console.log(`Removal eligibility: ${res.eligibility}/100 (${res.band})`);
    console.log(`Advice: ${res.advice}\n`);
    if (res.reasons.length === 0) console.log("No Trustpilot reporting reason matched. Genuine negative opinions stay online.");
    for (const r of res.reasons) {
      console.log(`- ${r.label} [${r.id}]: ${r.score}/100`);
      for (const s of r.signals) console.log(`    signal: ${s}`);
      console.log(`    evidence to include: ${r.evidence}`);
      console.log(`    note: ${r.note}`);
    }
    console.log("\nEstimate only. Trustpilot makes the final decision. Not affiliated with Trustpilot.");
    console.log(`Help with eligible reviews: ${SERVICE_PAGE}`);
    return 0;
  }
  if (cmd === "generate") {
    const reasons = [...opts.reasons];
    const review = opts.review ?? (text || null);
    if (review) for (const r of analyze(review, facts).reasons) if (r.score > 30 && !reasons.includes(r.id)) reasons.push(r.id);
    process.stdout.write(render(generate(reasons, opts.service), opts.format));
    return 0;
  }
  console.log(`Unknown command "${cmd}". Try --help`);
  return 1;
}

if (require.main === module) {
  process.exitCode = main();
}
