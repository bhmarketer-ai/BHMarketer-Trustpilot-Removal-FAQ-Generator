#!/usr/bin/env node
/**
 * @bhmarketer-ai/trustpilot-removal-faq-generator
 * BHMarketer Trustpilot Removal FAQ Generator: library and CLI.
 *
 * (1) Checks a Trustpilot review against the reasons Trustpilot accepts when a
 *     business reports a review, scoring removal eligibility from 0 to 100.
 * (2) Answers questions about the BHMarketer.ai Trustpilot Review Removal
 *     Service from a 50-question FAQ database.
 * (3) Builds a tailored FAQ, or the full page FAQ section (one H2, an H3 per
 *     question), as text, Markdown, JSON, FAQPage JSON-LD or HTML.
 *
 *   npx tp-faq ask how much does it cost
 *   npx tp-faq analyze "review text" --no-record
 *   npx tp-faq html > faq-section.html
 *
 * Data files: trustpilot_faq/faq.json, config.json, rules.json.
 * The score is an estimate to guide a report, not a guarantee: Trustpilot's
 * Content Integrity team makes the final decision. Not affiliated with Trustpilot.
 * Built by BHMarketer.ai (https://bhmarketer.ai). MIT License.
 */
import { readFileSync } from "fs";
import { join } from "path";

export const VERSION = "2.0.0";

export interface FaqEntry { id: string; category: string; question: string; answer: string; keywords: string[]; searches: string[]; }
export interface Reason { id: string; label: string; description: string; evidence: string; note: string; }
export interface Facts {
  no_record?: boolean; product_not_sold?: boolean; location_not_exist?: boolean;
  competitor?: boolean; wrong_business?: boolean; staff?: string[]; other?: string[];
}
export interface ReasonResult { id: string; label: string; score: number; signals: string[]; evidence: string; note: string; }
export interface Analysis { eligibility: number; band: string; advice: string; reasons: ReasonResult[]; }
export interface Config {
  brand: string; website: string; repository: string; service: string; service_page: string;
  seo: { title: string; meta_description: string; h1: string; url_path: string; primary_keyword: string; keywords: string[] };
  faq_heading: string; stopwords: string[];
}
export interface Rules {
  reasons: Reason[];
  bands: { min: number; max: number; label: string; advice: string }[];
  cues: { threat: string[]; abuse: string[]; not_genuine: string[]; promo: string[]; cta: string[] };
  patterns: { email: string; phone: string; url: string; address: string };
  faq_core: string[]; faq_by_reason: Record<string, string[]>; faq_service: string[];
}

const DATA_DIR = join(__dirname, "..", "trustpilot_faq");
const load = <T>(name: string): T => JSON.parse(readFileSync(join(DATA_DIR, name), "utf8"));

export const CONFIG: Config = load("config.json");
export const FAQ: FaqEntry[] = load("faq.json");
export const RULES: Rules = load("rules.json");
export const WEBSITE = CONFIG.website;
export const SERVICE_PAGE = CONFIG.service_page;
export const REPO = CONFIG.repository;
export const REASONS = RULES.reasons;

const EMAIL_RE = new RegExp(RULES.patterns.email);
const EMAIL_RE_G = new RegExp(RULES.patterns.email, "g");
const PHONE_RE = new RegExp(RULES.patterns.phone);
const URL_RE = new RegExp(RULES.patterns.url);
const ADDRESS_RE = new RegExp(RULES.patterns.address);
const STOPWORDS = new Set(CONFIG.stopwords);
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ================================================================ eligibility scoring

function hits(text: string, words: string[]): string[] {
  return words.map((w) => w.trim()).filter((w) => new RegExp(`(?<!\\w)${reEsc(w)}(?!\\w)`).test(text));
}

export function band(score: number): [string, string] {
  for (const b of RULES.bands) if (score >= b.min && score <= b.max) return [b.label, b.advice];
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
  const c = RULES.cues;

  for (const w of hits(text, c.threat)) add("harmful-illegal", 85, `threatening language: "${w}"`);
  for (const w of hits(text, c.abuse)) add("harmful-illegal", 35, `abusive language: "${w}"`);

  if (EMAIL_RE.test(text)) add("personal-information", 60, "email address in the review");
  if (PHONE_RE.test(text)) add("personal-information", 60, "phone number in the review");
  if (ADDRESS_RE.test(text)) add("personal-information", 50, "home or street address in the review");
  for (const name of facts.staff ?? []) {
    if (name && text.includes(name.toLowerCase()))
      add("personal-information", 40, `names staff member "${name}" (not removable if shown on your profile or website)`);
  }

  if (URL_RE.test(text.replace(EMAIL_RE_G, " "))) add("advertising-promotional", 45, "link or website address in the review");
  for (const w of hits(text, c.promo)) add("advertising-promotional", 50, `promotional wording: "${w}"`);
  for (const w of hits(text, c.cta)) add("advertising-promotional", 20, `call to action: "${w}"`);

  if (facts.no_record) add("not-genuine", 40, "no matching order, booking or contact found in your records");
  if (facts.product_not_sold) add("not-genuine", 45, "mentions a product or service you do not sell");
  if (facts.location_not_exist) add("not-genuine", 45, "mentions a location you do not have");
  if (facts.competitor) add("not-genuine", 40, "evidence the reviewer is a competitor or former employee");
  for (const w of hits(text, c.not_genuine)) add("not-genuine", 35, `second-hand or no-experience wording: "${w}"`);

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

// ================================================================ FAQ search

export function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\-/.% ]+/g, " ").replace(/\s+/g, " ").replace(/^[ .]+|[ .]+$/g, "");
}

export function tokens(query: string): string[] {
  const out: string[] = [];
  for (let w of normalize(query).split(" ")) {
    w = w.replace(/^\.+|\.+$/g, "");
    if (!w || STOPWORDS.has(w)) continue;
    if (w.length > 4 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
    out.push(w);
  }
  return out;
}

const has = (tok: string, text: string) => new RegExp(`(?<![a-z0-9])${reEsc(tok)}(s|es)?(?![a-z0-9])`).test(text);

export function score(entry: FaqEntry, query: string): number {
  const nq = normalize(query);
  let s = 0;
  const searches = entry.searches.map((x) => x.toLowerCase());
  if (searches.includes(nq)) s += 20;
  else if (nq.length >= 6 && searches.some((x) => x.includes(nq) || nq.includes(x))) s += 8;
  const keywords = entry.keywords.map((k) => k.toLowerCase());
  const question = entry.question.toLowerCase(), answer = entry.answer.toLowerCase();
  for (const tok of tokens(query)) {
    if (keywords.some((k) => has(tok, k))) s += 3;
    if (has(tok, question)) s += 2;
    else if (has(tok, answer)) s += 1;
  }
  return s;
}

export function ask(query: string, limit = 3): FaqEntry[] {
  return FAQ.map((e) => [score(e, query), e] as const)
    .filter(([sc]) => sc > 0)
    .sort((a, b) => b[0] - a[0])
    .slice(0, limit)
    .map(([, e]) => e);
}

export function get(id: string | number): FaqEntry | undefined {
  let key = String(id).toUpperCase();
  if (/^\d+$/.test(key)) key = `FAQ-${String(Number(key)).padStart(2, "0")}`;
  return FAQ.find((e) => e.id === key);
}

export const categories = (): string[] => [...new Set(FAQ.map((e) => e.category))];
export const byCategory = (name: string): FaqEntry[] =>
  FAQ.filter((e) => e.category.toLowerCase().includes(name.toLowerCase()));

// ================================================================ FAQ building and output

export function generate(reasons: string[] = [], includeService = true): FaqEntry[] {
  const ids = [...RULES.faq_core];
  for (const rid of reasons) for (const i of RULES.faq_by_reason[rid] ?? []) if (!ids.includes(i)) ids.push(i);
  if (includeService) for (const i of RULES.faq_service) if (!ids.includes(i)) ids.push(i);
  return ids.map((i) => get(i) as FaqEntry);
}

export function toJsonLdData(faqs: FaqEntry[]) {
  return {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
}

export const toJsonLd = (faqs: FaqEntry[]) => JSON.stringify(toJsonLdData(faqs), null, 2);

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

export function toHtml(faqs: FaqEntry[], title?: string): string {
  const lines = ['<section class="faq" id="faq">', `  <h2>${escapeHtml(title ?? CONFIG.faq_heading)}</h2>`];
  for (const f of faqs) {
    lines.push(`  <h3>${escapeHtml(f.question)}</h3>`);
    lines.push(`  <p>${escapeHtml(f.answer)}</p>`);
  }
  lines.push("</section>", '<script type="application/ld+json">', toJsonLd(faqs).replace(/<\//g, "<\\/"), "</script>");
  return lines.join("\n") + "\n";
}

export function toMarkdown(faqs: FaqEntry[], title?: string): string {
  const lines = [`# ${title ?? CONFIG.faq_heading}`, ""];
  faqs.forEach((f, i) => lines.push(`## ${i + 1}. ${f.question}`, "", f.answer, ""));
  lines.push(`*Generated by the BHMarketer Trustpilot Removal FAQ Generator. Learn more: ${SERVICE_PAGE}*`);
  return lines.join("\n") + "\n";
}

export const toText = (faqs: FaqEntry[]) =>
  faqs.map((f, i) => `Q${i + 1}. ${f.question}\n    ${f.answer}\n`).join("\n");

export function render(faqs: FaqEntry[], fmt = "text", title?: string): string {
  if (fmt === "markdown") return toMarkdown(faqs, title);
  if (fmt === "json") return JSON.stringify(faqs.map((f) => ({ question: f.question, answer: f.answer })), null, 2) + "\n";
  if (fmt === "jsonld") return toJsonLd(faqs) + "\n";
  if (fmt === "html") return toHtml(faqs, title);
  return toText(faqs);
}

export const pageHtml = () => toHtml(FAQ);
export const seo = () => ({ ...CONFIG.seo, service_page: SERVICE_PAGE });

// ================================================================ CLI

const USAGE = `tp-faq: BHMarketer Trustpilot Removal FAQ Generator

  tp-faq ask QUESTION [--limit N] [--json]
  tp-faq analyze "review text" [--no-record] [--product-not-sold] [--location-not-exist]
                 [--competitor] [--wrong-business] [--staff NAME] [--other BUSINESS] [--json]
  tp-faq generate [--review "review text" [facts]] [--reason ID]
                  [--format text|markdown|json|jsonld|html] [--no-service]
  tp-faq show N [--json]
  tp-faq list [CATEGORY] [--json]
  tp-faq categories
  tp-faq reasons
  tp-faq html          full 50-question page FAQ section with JSON-LD
  tp-faq jsonld        FAQPage structured data for all 50 questions
  tp-faq seo           page SEO settings

Estimate only: Trustpilot makes the final decision. Not affiliated with Trustpilot.`;

export function parseArgs(args: string[]) {
  const facts: Facts = { staff: [], other: [] };
  const opts = { json: false, format: "text", reasons: [] as string[], service: true, review: null as string | null, limit: 3 };
  const words: string[] = [];
  const flags: Record<string, keyof Facts> = {
    "--no-record": "no_record", "--product-not-sold": "product_not_sold",
    "--location-not-exist": "location_not_exist", "--competitor": "competitor", "--wrong-business": "wrong_business",
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const next = i + 1 < args.length;
    if (a in flags) (facts as Record<string, unknown>)[flags[a]] = true;
    else if (a === "--staff" && next) facts.staff!.push(args[++i]);
    else if (a === "--other" && next) facts.other!.push(args[++i]);
    else if (a === "--json") opts.json = true;
    else if (a === "--format" && next) opts.format = args[++i];
    else if (a === "--reason" && next) opts.reasons.push(args[++i]);
    else if (a === "--review" && next) opts.review = args[++i];
    else if (a === "--limit" && next) opts.limit = Number(args[++i]);
    else if (a === "--no-service") opts.service = false;
    else words.push(a);
  }
  return { text: words.join(" "), facts, opts };
}

const dump = (d: unknown) => console.log(JSON.stringify(d, null, 2));
const printEntry = (e: FaqEntry) => console.log(`Q: ${e.question}\nA: ${e.answer}`);

export function cli(argv: string[]): number {
  if (!argv.length || ["-h", "--help", "help"].includes(argv[0])) { console.log(USAGE); return 0; }
  const [cmd, ...rest] = argv;
  if (cmd === "--version") { console.log(VERSION); return 0; }
  const { text, facts, opts } = parseArgs(rest);

  switch (cmd) {
    case "ask": {
      const d = ask(text, opts.limit);
      if (opts.json) dump(d);
      else if (!d.length) console.log("No matching question. Try other words, or run: tp-faq list");
      else {
        printEntry(d[0]);
        if (d.length > 1) { console.log("\nAlso see:"); d.slice(1).forEach((e) => console.log(`  ${e.id}  ${e.question}`)); }
      }
      return 0;
    }
    case "show": {
      const e = get(text);
      if (!e) { console.error(`No question '${text}'`); return 1; }
      opts.json ? dump(e) : printEntry(e);
      return 0;
    }
    case "list":
    case "faqs": {
      const d = text ? byCategory(text) : [...FAQ];
      if (opts.json) { dump(d); return 0; }
      let current = "";
      for (const e of d) {
        if (e.category !== current) { current = e.category; console.log(`\n${current}`); }
        console.log(`  ${e.id}  ${e.question}`);
      }
      return 0;
    }
    case "categories":
      opts.json ? dump(categories()) : console.log(categories().join("\n"));
      return 0;
    case "reasons":
      for (const r of REASONS) console.log(`${r.id.padEnd(24)} ${r.label}\n${"".padEnd(24)} ${r.description}`);
      return 0;
    case "analyze": {
      if (!text) { console.log('Give the review text, e.g. tp-faq analyze "review text"'); return 1; }
      const res = analyze(text, facts);
      if (opts.json) { dump(res); return 0; }
      console.log(`Removal eligibility: ${res.eligibility}/100 (${res.band})`);
      console.log(`Advice: ${res.advice}\n`);
      if (!res.reasons.length) console.log("No Trustpilot reporting reason matched. Genuine negative opinions stay online.");
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
    case "generate": {
      const reasons = [...opts.reasons];
      const review = opts.review ?? (text || null);
      if (review) for (const r of analyze(review, facts).reasons) if (r.score > 30 && !reasons.includes(r.id)) reasons.push(r.id);
      process.stdout.write(render(generate(reasons, opts.service), opts.format));
      return 0;
    }
    case "html": process.stdout.write(pageHtml()); return 0;
    case "jsonld": console.log(toJsonLd(FAQ)); return 0;
    case "seo": dump(seo()); return 0;
    default:
      console.log(`Unknown command "${cmd}". Try --help`);
      return 1;
  }
}

if (require.main === module) {
  process.exitCode = cli(process.argv.slice(2));
}
