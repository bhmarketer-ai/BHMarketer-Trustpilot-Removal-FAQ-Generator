# Instructions for AI Coding Tools

This repository does two things for the BHMarketer.ai Trustpilot Review Removal Service: a FAQ generator (50 questions, page FAQ section, SEO settings) and a review eligibility scorer (0 to 100). Read this file before changing anything.

## How the repository works

There are three source files. The FAQ outputs are generated from them.

| Source file | Holds |
|-------------|-------|
| `trustpilot_faq/faq.json` | The questions and answers. A list of entries with `id`, `category`, `question`, `answer`, `keywords`, `searches`. |
| `trustpilot_faq/config.json` | Brand, website, repository, service name, service page URL, SEO title, meta description, H1, URL path, keywords, FAQ heading, search stopwords. |
| `trustpilot_faq/rules.json` | Eligibility scorer: the five Trustpilot reporting reasons, score bands, signal cue words, regex patterns, and which FAQ ids `generate` uses for each reason. |

`python tools/generate.py` rebuilds these generated files:

- `README.md` (only the parts between `<!-- CATEGORIES:START/END -->` and `<!-- FAQ:START/END -->`)
- `docs/faq.md`
- `dataset/trustpilot_removal_faqs.csv`
- `schema.json` (the FAQPage `mainEntity`)
- `output/faq-section.html`
- `output/seo.json`
- `llms.txt`

Never edit a generated file by hand. Edit the source file, then run the generator.

## Rules for content

1. Keep question and answer text exactly as supplied by the user. Do not rewrite, summarise or "improve" it.
2. Do not add sources, citations, "according to" lines, verification labels or checked dates.
3. Do not invent prices, turnaround times, delivery days, success rates or guarantees. The answers deliberately say these depend on the package and that Trustpilot makes the final decision.
4. Use "BHMarketer.ai" for the brand everywhere.
5. Do not use em dashes or en dashes in copy. Use a comma, colon or plain hyphen.
6. Keep the page FAQ structure: one H2 for the section and an H3 for each question, every answer visible, JSON-LD built from the same text.
7. Do not reuse these questions for another BHMarketer.ai service. Each service needs its own questions, terms and answers.
8. Do not change scoring points or cue words without updating `dataset/trustpilot_removal_benchmarks.csv`; the tests and the daily heartbeat check all 20 benchmark cases.

## Common tasks

**Edit an answer.** Change `answer` in `faq.json`, run `python tools/generate.py`, run `pytest`.

**Add a question.** Append an entry to `faq.json` with the next id (`FAQ-51`), a `category` (reuse an existing one where it fits), 2 to 6 `keywords`, and 1 to 3 lowercase `searches`: short phrases people type, which must not duplicate another entry's phrases. Run the generator and the tests. The test `test_search_phrases_find_their_entry` fails if a phrase returns a different question; fix the phrase or keywords until it passes.

**Change the SEO title, meta description, H1 or keywords.** Edit `config.json`, run the generator. Also update the "Page SEO Settings" table in `README.md`, which is written by hand.

**Change the eligibility scorer.** Edit `rules.json` (cue words, patterns, bands) or the scoring points in `trustpilot_faq/__init__.py` and `index.ts` (keep both identical). Update the expected results in `dataset/trustpilot_removal_benchmarks.csv` if they change, then run the tests.

**Change which FAQs `generate` returns.** Edit `faq_core`, `faq_by_reason` and `faq_service` in `rules.json`. Every id must exist in `faq.json`.

## Checks before committing

```bash
python tools/generate.py --check   # generated files match the sources
pytest -q                          # database, search and output tests
npm test                           # Node.js build, CLI and benchmarks
```

All three must pass. Commit every changed file in a single commit so the GitHub Actions run does not fail on a half-uploaded state.
