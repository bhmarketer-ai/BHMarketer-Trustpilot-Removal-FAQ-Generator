# Changelog

## 2.0.0

- FAQ database replaced: 50 questions and answers about the BHMarketer.ai Trustpilot Review Removal Service (`trustpilot_faq/faq.json`) in six categories, each with keywords and search phrases.
- New `ask`, `show`, `list`, `categories`, `html`, `jsonld` and `seo` commands.
- Page FAQ section (`output/faq-section.html`): one H2, an H3 per question, visible answers and matching FAQPage JSON-LD.
- Page SEO settings in `trustpilot_faq/config.json` and `output/seo.json`.
- Eligibility scorer unchanged; its reasons, bands and cues moved to `trustpilot_faq/rules.json`. All 20 benchmark cases give the same results.
- `llms.txt` and `AGENTS.md` for AI systems and AI coding tools.
- Python package restored (`bhmarketer-trustpilot-faq`), with tests and PyPI workflow.
- Removed "no removal, no fee" wording; no removal is guaranteed.

## 1.0.1

- Package metadata updates.

## 1.0.0

- Eligibility scoring, 25-answer FAQ knowledge base and FAQ generator.
