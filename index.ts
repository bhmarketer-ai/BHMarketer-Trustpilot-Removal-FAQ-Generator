#!/usr/bin/env node
/**
 * @bhmarketer-ai/trustpilot-removal-faq-generator
 * BHMarketer Trustpilot Removal FAQ Generator: library and CLI.
 *
 * Answers questions about the BHMarketer.ai Trustpilot Review Removal Service
 * from a 50-question FAQ database, ranks questions by popularity, and builds the
 * page FAQ section (one H2, an H3 per question) with FAQPage JSON-LD.
 *
 *   npx tp-faq ask how much does it cost
 *   npx tp-faq top 10
 *   npx tp-faq html > faq-section.html
 *
 * Data files: trustpilot_faq/faq.json, trustpilot_faq/config.json.
 * Popularity is BHMarketer.ai's estimate of how often each question is asked.
 * Built by BHMarketer.ai (https://bhmarketer.ai). MIT License.
 */
import { readFileSync } from "fs";
import { join } from "path";

export const VERSION = "2.0.0";

export interface FaqEntry {
  id: string; category: string; question: string; answer: string;
  popularity: number; keywords: string[]; searches: string[];
}
export interface Config {
  brand: string; website: string; repository: string; service: string; service_page: string;
  seo: { title: string; meta_description: string; h1: string; url_path: string; primary_keyword: string; keywords: string[] };
  faq_heading: string; stopwords: string[];
}

const DATA_DIR = join(__dirname, "..", "trustpilot_faq");
const load = <T>(name: string): T => JSON.parse(readFileSync(join(DATA_DIR, name), "utf8"));

export const CONFIG: Config = load("config.json");
export const FAQ: FaqEntry[] = load("faq.json");
export const WEBSITE = CONFIG.website;
export const SERVICE_PAGE = CONFIG.service_page;
export const REPO = CONFIG.repository;
const STOPWORDS = new Set(CONFIG.stopwords);
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ================================================================ search

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
export const popular = (limit = 10): FaqEntry[] => [...FAQ].sort((a, b) => b.popularity - a.popularity).slice(0, limit);
export const number = (e: FaqEntry): number => Number(e.id.split("-")[1]);

// ================================================================ output

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
  for (const f of faqs) lines.push(`## ${number(f)}. ${f.question}`, "", `*Popularity: ${f.popularity}%*`, "", f.answer, "");
  return lines.join("\n") + "\n";
}

export const toText = (faqs: FaqEntry[]) =>
  faqs.map((f) => `${number(f)}. ${f.question} (${f.popularity}%)\n    ${f.answer}\n`).join("\n");

export function render(faqs: FaqEntry[], fmt = "text", title?: string): string {
  if (fmt === "markdown") return toMarkdown(faqs, title);
  if (fmt === "json") return JSON.stringify(faqs, null, 2) + "\n";
  if (fmt === "jsonld") return toJsonLd(faqs) + "\n";
  if (fmt === "html") return toHtml(faqs, title);
  return toText(faqs);
}

export const pageHtml = () => toHtml(FAQ);
export const seo = () => ({ ...CONFIG.seo, service_page: SERVICE_PAGE });

// ================================================================ CLI

const USAGE = `tp-faq: BHMarketer Trustpilot Removal FAQ Generator

  tp-faq ask QUESTION [--limit N] [--json]
  tp-faq top [N] [--json]           most popular questions
  tp-faq show N [--json]
  tp-faq list [CATEGORY] [--json]
  tp-faq categories
  tp-faq export [--format text|markdown|json|jsonld|html]
  tp-faq html                       full 50-question page FAQ section with JSON-LD
  tp-faq jsonld                     FAQPage structured data for all 50 questions
  tp-faq seo                        page SEO settings

Popularity is BHMarketer.ai's estimate of how often each question is asked.`;

export function parseArgs(args: string[]) {
  const opts = { json: false, format: "text", limit: 3 };
  const words: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--json") opts.json = true;
    else if (a === "--format" && i + 1 < args.length) opts.format = args[++i];
    else if (a === "--limit" && i + 1 < args.length) opts.limit = Number(args[++i]);
    else words.push(a);
  }
  return { text: words.join(" "), opts };
}

const dump = (d: unknown) => console.log(JSON.stringify(d, null, 2));
const printEntry = (e: FaqEntry) => console.log(`Q: ${e.question}\nPopularity: ${e.popularity}%\nA: ${e.answer}`);
const printLine = (e: FaqEntry) => console.log(`  ${e.id}  ${String(e.popularity).padStart(3)}%  ${e.question}`);

export function cli(argv: string[]): number {
  if (!argv.length || ["-h", "--help", "help"].includes(argv[0])) { console.log(USAGE); return 0; }
  const [cmd, ...rest] = argv;
  if (cmd === "--version") { console.log(VERSION); return 0; }
  const { text, opts } = parseArgs(rest);

  switch (cmd) {
    case "ask": {
      const d = ask(text, opts.limit);
      if (opts.json) dump(d);
      else if (!d.length) console.log("No matching question. Try other words, or run: tp-faq list");
      else {
        printEntry(d[0]);
        if (d.length > 1) { console.log("\nAlso see:"); d.slice(1).forEach(printLine); }
      }
      return 0;
    }
    case "top": {
      const d = popular(/^\d+$/.test(text) ? Number(text) : 10);
      opts.json ? dump(d) : d.forEach(printLine);
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
        printLine(e);
      }
      return 0;
    }
    case "categories":
      opts.json ? dump(categories()) : console.log(categories().join("\n"));
      return 0;
    case "export": process.stdout.write(render(FAQ, opts.format)); return 0;
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
