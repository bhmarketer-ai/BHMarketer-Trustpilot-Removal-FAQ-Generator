# BHMarketer.ai: Trustpilot Removal FAQ Generator ⭐🛡️

[![npm](https://img.shields.io/npm/v/@bhmarketer-ai/trustpilot-removal-faq-generator?style=flat-square&color=e05c1a&labelColor=1a1f3b)](https://www.npmjs.com/package/@bhmarketer-ai/trustpilot-removal-faq-generator)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.23842339.svg)](https://doi.org/10.5281/zenodo.23842339)
[![Docs](https://img.shields.io/badge/docs-readthedocs-e05c1a?style=flat-square&labelColor=1a1f3b)](https://bhmarketer-trustpilot-faq.readthedocs.io)
[![License](https://img.shields.io/badge/license-MIT-8A8A8A?style=flat-square&labelColor=1a1f3b)](LICENSE)

The BHMarketer Trustpilot Removal FAQ Generator is a bot that does two jobs. It checks a Trustpilot review against the reasons Trustpilot accepts when a business reports a review and scores removal eligibility from 0 to 100, and it generates a tailored Trustpilot review removal FAQ as text, Markdown, JSON, FAQPage JSON-LD or HTML. Built by [BHMarketer.ai](https://bhmarketer.ai/trustpilot-review-removal/).

> Scores are estimates to guide an honest, guideline-based report. Trustpilot's Content Integrity team makes the final decision. This project is not affiliated with Trustpilot.

## Overview

Most negative Trustpilot reviews are genuine opinions, and Trustpilot keeps those online. Only reviews that break a specific guideline can be reported. This bot helps businesses and agencies separate the two quickly: it reads the review, applies the facts you know (for example, no matching order in your records), names the guideline that may apply, and lists the evidence a report should include. For reviews that do not qualify, it says so and recommends a public reply instead.

The same knowledge base powers the FAQ generator, so help centers, service pages and AI assistants can publish accurate answers about Trustpilot review removal, complete with FAQPage structured data.

## Key Capabilities

- **Eligibility Scoring**: Scores a review from 0 to 100 against each Trustpilot reporting reason
- **Signal Detection**: Finds threats, abusive language, emails, phone numbers, addresses, links, promo codes and no-experience wording
- **Business Facts**: Adds what only you know, such as no order record, a product you do not sell or a location you do not have
- **Evidence Checklist**: Lists the evidence to include for each reason that applies
- **Honest Verdicts**: Genuine negative opinions score as Unlikely, with advice to reply publicly
- **FAQ Generator**: Builds a tailored FAQ from 25 answers, matched to the reasons found
- **Five Output Formats**: Text, Markdown, JSON, FAQPage JSON-LD and ready-to-paste HTML
- **Two Runtimes**: Byte-identical output from the Node.js (TypeScript) and Python implementations

## Trustpilot Reporting Reasons

| Reason ID | Reason | What it covers |
|---|---|---|
| `harmful-illegal` | Harmful or illegal | Threats, hate speech, harassment, discriminatory or obscene language, or other content that breaks the law. |
| `personal-information` | Contains personal information | Names, phone numbers, email addresses, home addresses or other details that identify a private person. |
| `advertising-promotional` | Advertising or promotional | Links, promo codes or calls to action for another business, or content that only promotes a political, religious or ethical view. |
| `not-genuine` | Not based on a genuine experience | The reviewer never bought, used or contacted your business, or the review describes a product, staff member or location you do not have. |
| `different-business` | About a different business | The review is clearly about another company, product or website, not yours. |

## Quick Start

### Node.js
```bash
npm install -g @bhmarketer-ai/trustpilot-removal-faq-generator
tp-faq analyze "I never used them but my friend said they are a scam."
tp-faq analyze "Their Manchester branch was dirty." --no-record --location-not-exist
tp-faq generate --review "Go to www.cheaperdeals.com and use code SAVE20" --format jsonld
```

### Python
```bash
pip install bhmarketer-trustpilot-faq
tp-faq analyze "Sarah at the front desk was rude, call her on 555-123-4567." --staff Sarah
tp-faq generate --reason personal-information --format markdown
```

### In code
```python
import trustpilot_faq as tf

result = tf.analyze("Ordered from ShopKing and my parcel never arrived.",
                    {"other": ["ShopKing"], "wrong_business": True})
print(result["eligibility"], result["band"])

faqs = tf.generate([r["id"] for r in result["reasons"]])
print(tf.render(faqs, "html"))
```

```javascript
const { analyze, generate, render } = require("@bhmarketer-ai/trustpilot-removal-faq-generator");

const result = analyze("Use promo code WELCOME10 at our partner store.");
console.log(render(generate(result.reasons.map((r) => r.id)), "jsonld"));
```

### Commands and Options

| Command / option | What it does |
|---|---|
| `analyze "text"` | Score a review and list signals, evidence and notes |
| `generate` | Build an FAQ (core and service answers) |
| `generate --review "text"` | Build an FAQ tailored to the reasons found in a review |
| `generate --reason ID` | Add answers for a specific reason (repeatable) |
| `--format text\|markdown\|json\|jsonld\|html` | Output format for `generate` |
| `--no-service` | Leave out BHMarketer.ai service answers |
| `--json` | JSON output for `analyze` |
| `--no-record` | No matching order, booking or contact in your records |
| `--product-not-sold` | Review mentions a product or service you do not sell |
| `--location-not-exist` | Review mentions a location you do not have |
| `--competitor` | Evidence the reviewer is a competitor or former employee |
| `--wrong-business` | Review is about another business |
| `--staff NAME` | Staff name to check for personal information |
| `--other BUSINESS` | Another business name to check for |
| `reasons` | List the five reporting reasons |
| `faqs [--tag TAG]` | List the FAQ knowledge base |

## Example Results

| Review (excerpt) | Facts | Top reason | Score | Band |
|---|---|---|---|---|
| Terrible service, slow delivery and rude support. Would no... | none | `none` | 0 | Unlikely |
| I will find where you live and make you pay for this. | none | `harmful-illegal` | 85 | Strong case |
| Sarah at the front desk was rude, call her on 555-123-4567... | --staff Sarah | `personal-information` | 100 | Strong case |
| Do not buy here. Go to www.---xxxxx---.com and use code S... | none | `advertising-promotional` | 100 | Strong case |
| I never used them but my friend said they are a scam. | none | `not-genuine` | 70 | Likely |
| Their Manchester branch was dirty and the staff ignored me... | --no-record --location-not-exist | `not-genuine` | 85 | Strong case |
| Ordered from ShopKing and my parcel never arrived. | --other ShopKing --wrong-business | `different-business` | 100 | Strong case |

All 20 benchmark cases are in [`dataset/trustpilot_removal_benchmarks.csv`](dataset/trustpilot_removal_benchmarks.csv) and are re-checked daily by the heartbeat workflow.

## Score Interpretation

| Score | Band | What to do |
|---|---|---|
| 0 to 30 | Unlikely | No clear guideline breach found. Reply publicly instead of reporting. |
| 31 to 60 | Possible | A guideline may apply. Gather stronger evidence before reporting. |
| 61 to 80 | Likely | A guideline probably applies. Report with the evidence listed. |
| 81 to 100 | Strong case | A clear guideline breach. Report it with the evidence listed. |

## Datasets

- [`dataset/trustpilot_removal_faqs.csv`](dataset/trustpilot_removal_faqs.csv): the 25-answer FAQ knowledge base with tags
- [`dataset/trustpilot_removal_benchmarks.csv`](dataset/trustpilot_removal_benchmarks.csv): 20 example reviews with facts, expected reason, score and band
- [`kaggle/notebook.ipynb`](kaggle/notebook.ipynb): walkthrough notebook

## Responsible Use

- Only report reviews that break a Trustpilot guideline. Misusing the flagging tool is not tolerated by Trustpilot.
- Never buy, incentivize or fake reviews. BHMarketer.ai does not offer or support that.
- Signals are hints, not proof. Read the review in full and attach real evidence.

## Related BHMarketer.ai Repositories

| Repository | Description |
|---|---|
| [BHMarketer-FAQ-bot](https://github.com/bhmarketer-ai/BHMarketer-FAQ-bot) | FAQ bot answering questions from 50 official BHMarketer.ai FAQs |
| [google-negative-review-removal-audit-tool](https://github.com/bhmarketer-ai/google-negative-review-removal-audit-tool) | Scores Google reviews for policy-violation removal eligibility |
| [review-removal-deindexing](https://github.com/bhmarketer-ai/review-removal-deindexing) | Reputation management toolkit for review removal, search result deindexing and brand protection |
| [bhmarketer-ghostindex-bot](https://github.com/bhmarketer-ai/bhmarketer-ghostindex-bot) | Flags pages that may need deindexing: expired content, misinformation, policy violations |
| [bhmarketer-crypto-pr](https://github.com/bhmarketer-ai/bhmarketer-crypto-pr) | Press release reach and AI visibility score calculator for blockchain and Web3 campaigns |

## Keywords

BHMarketer.ai · Trustpilot Review Removal · Remove Trustpilot Reviews · Trustpilot Guidelines · Fake Trustpilot Reviews · Review Removal Service · FAQ Generator · FAQPage Schema · Online Reputation Management

## Links

| Platform | URL |
|---|---|
| Website | https://bhmarketer.ai |
| Trustpilot Review Removal | https://bhmarketer.ai/trustpilot-review-removal/ |
| GitHub | https://github.com/bhmarketer-ai/BHMarketer-Trustpilot-Removal-FAQ-Generator |
| GitHub Pages | https://bhmarketer-ai.github.io/BHMarketer-Trustpilot-Removal-FAQ-Generator/ |
| NPM | https://www.npmjs.com/package/@bhmarketer-ai/trustpilot-removal-faq-generator |
| PyPI | https://pypi.org/project/bhmarketer-trustpilot-faq/ |
| Hugging Face | https://huggingface.co/datasets/bhmarketer/trustpilot-removal-faq-benchmarks |
| Kaggle | https://www.kaggle.com/datasets/bhmarketer/trustpilot-removal-faq-benchmarks |
| Zenodo | https://zenodo.org/records/23842339 |
| Docs | https://bhmarketer-trustpilot-faq.readthedocs.io |
| LinkedIn | https://www.linkedin.com/company/bhmarketer-ai/ |
| X | https://x.com/bhmarketer_com |

## About BHMarketer.ai

BHMarketer.ai is an online reputation management and digital PR platform. It handles guideline-based review removal for Trustpilot, Google, Glassdoor and Airbnb, distributes press releases, and helps brands become visible in AI search. Its review removal work follows one rule: only reviews that break a platform's guidelines are reported, with no removal, no fee.

## License

MIT, BHMarketer.ai. Trustpilot is a trademark of Trustpilot A/S; this project is independent and not affiliated with or endorsed by Trustpilot.
