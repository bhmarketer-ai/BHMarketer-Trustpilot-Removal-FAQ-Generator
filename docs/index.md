# BHMarketer Trustpilot Removal FAQ Generator

A searchable database of 50 questions about the BHMarketer.ai Trustpilot Review Removal Service, with a popularity score for each question, a page FAQ section and FAQPage JSON-LD. Built by [BHMarketer.ai](https://bhmarketer.ai/trustpilot-review-removal/).

## Install

```bash
npm install -g @bhmarketer-ai/trustpilot-removal-faq-generator
# or
pip install bhmarketer-trustpilot-faq
```

## Ask a question

```bash
tp-faq ask how much does it cost
tp-faq ask what is the tat
tp-faq show 37
```

## Most asked questions

```bash
tp-faq top 10
```

Popularity is BHMarketer.ai's estimate of how often each question is asked, from 0 to 100%.

## Page FAQ section

```bash
tp-faq html > faq-section.html   # one H2, an H3 per question, FAQPage JSON-LD
tp-faq seo                       # page SEO settings
```

See the full [FAQ](faq.md).
