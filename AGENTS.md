# Instructions for AI Coding Tools

This repository is a FAQ generator for one service page: the BHMarketer.ai Trustpilot Review Removal Service. It holds 50 questions and answers, each with a popularity score, and builds the page FAQ section and SEO settings. Read this file before changing anything.

## How the repository works

There are two source files. Everything else is generated from them.

| Source file | Holds |
|-------------|-------|
| `trustpilot_faq/faq.json` | The questions and answers. A list of entries with `id`, `category`, `question`, `answer`, `popularity`, `keywords`, `searches`. |
| `trustpilot_faq/config.json` | Brand, website, repository, service name, service page URL, SEO title, meta description, H1, URL path, keywords, FAQ heading, search stopwords. |

`python tools/generate.py` rebuilds these generated files:

- `README.md` (only the parts between `<!-- POPULAR:START/END -->`, `<!-- CATEGORIES:START/END -->` and `<!-- FAQ:START/END -->`)
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
8. `popularity` is an estimate (0 to 100) of how often a question is asked. Do not describe it as measured data unless the user supplies real figures.
9. This repository is FAQ only. Do not add review scoring, benchmark tables or example results.

## Common tasks

**Edit an answer.** Change `answer` in `faq.json`, run `python tools/generate.py`, run `pytest`.

**Add a question.** Append an entry to `faq.json` with the next id (`FAQ-51`), a `popularity` (0 to 100), a `category` (reuse an existing one where it fits), 2 to 6 `keywords`, and 1 to 3 lowercase `searches`: short phrases people type, which must not duplicate another entry's phrases. Run the generator and the tests. The test `test_search_phrases_find_their_entry` fails if a phrase returns a different question; fix the phrase or keywords until it passes.

**Change the SEO title, meta description, H1 or keywords.** Edit `config.json`, run the generator. Also update the "Page SEO Settings" table in `README.md`, which is written by hand.

**Change popularity.** Edit `popularity` (a whole number from 0 to 100) in `faq.json`, run the generator. The "Most Asked Questions" table in the README updates itself.

## Checks before committing

```bash
python tools/generate.py --check   # generated files match the sources
pytest -q                          # database, search and output tests
npm test                           # Node.js build and CLI
```

All three must pass. Commit every changed file in a single commit so the GitHub Actions run does not fail on a half-uploaded state.
