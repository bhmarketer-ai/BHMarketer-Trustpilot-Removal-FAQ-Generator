"""
trustpilot_faq: BHMarketer Trustpilot Removal FAQ Generator.

A dependency-free FAQ generator for the BHMarketer.ai Trustpilot Review Removal
Service. It answers questions in plain words from a 50-question database, ranks
questions by popularity, and builds the page FAQ section (one H2, an H3 per
question) with matching FAQPage structured data.

Data files (edit these, not the code):
    faq.json     the 50 questions and answers, each with a popularity score
    config.json  brand, service page, SEO settings, search stopwords

Popularity (0 to 100%) is BHMarketer.ai's estimate of how often each question
is asked. It is not measured survey or search data.
Built by BHMarketer.ai (https://bhmarketer.ai). MIT License.
"""

import html
import json
import re
from importlib import resources

__version__ = "2.0.0"


def _load(name):
    return json.loads(resources.files(__package__).joinpath(name).read_text(encoding="utf-8"))


CONFIG = _load("config.json")
FAQ = _load("faq.json")

WEBSITE = CONFIG["website"]
SERVICE_PAGE = CONFIG["service_page"]
REPO = CONFIG["repository"]
STOPWORDS = set(CONFIG["stopwords"])


# ================================================================ search

def normalize(text):
    """Lowercase and strip punctuation, keeping letters, digits, '-', '/', '.' and '%'."""
    text = re.sub(r"[^a-z0-9\-/.% ]+", " ", text.lower())
    return re.sub(r"\s+", " ", text).strip(" .")


def tokens(query):
    """Meaningful words from a query, stopwords removed and simple plurals stemmed."""
    out = []
    for w in normalize(query).split():
        w = w.strip(".")
        if not w or w in STOPWORDS:
            continue
        if len(w) > 4 and w.endswith("s") and not w.endswith("ss"):
            w = w[:-1]
        out.append(w)
    return out


def _has(tok, text):
    return re.search(rf"(?<![a-z0-9]){re.escape(tok)}(s|es)?(?![a-z0-9])", text) is not None


def score(entry, query):
    """Relevance score of one FAQ entry for a query (0 = no match)."""
    nq = normalize(query)
    s = 0
    searches = [x.lower() for x in entry["searches"]]
    if nq in searches:
        s += 20
    elif len(nq) >= 6 and any(x in nq or nq in x for x in searches):
        s += 8
    keywords = [k.lower() for k in entry["keywords"]]
    question, answer = entry["question"].lower(), entry["answer"].lower()
    for tok in tokens(query):
        if any(_has(tok, k) for k in keywords):
            s += 3
        if _has(tok, question):
            s += 2
        elif _has(tok, answer):
            s += 1
    return s


def ask(query, limit=3):
    """Return the best-matching FAQ entries for a question, best first."""
    ranked = sorted(((score(e, query), e) for e in FAQ), key=lambda p: -p[0])
    return [e for sc, e in ranked if sc > 0][:limit]


def get(faq_id):
    """Return one entry by id ('FAQ-07' or '7'), or None."""
    faq_id = str(faq_id).upper()
    if faq_id.isdigit():
        faq_id = f"FAQ-{int(faq_id):02d}"
    return next((e for e in FAQ if e["id"] == faq_id), None)


def categories():
    """Return category names in order."""
    return list(dict.fromkeys(e["category"] for e in FAQ))


def by_category(name):
    """Return entries in a category (case-insensitive substring)."""
    n = name.lower()
    return [e for e in FAQ if n in e["category"].lower()]


def popular(limit=10):
    """Return the most popular questions, highest popularity first (ties keep FAQ order)."""
    return sorted(FAQ, key=lambda e: -e["popularity"])[:limit]


def number(entry):
    """Question number from its id, e.g. 'FAQ-07' -> 7."""
    return int(entry["id"].split("-")[1])


# ================================================================ output

def to_jsonld_data(faqs):
    """schema.org FAQPage structured data for a list of entries."""
    return {"@context": "https://schema.org", "@type": "FAQPage",
            "mainEntity": [{"@type": "Question", "name": f["question"],
                            "acceptedAnswer": {"@type": "Answer", "text": f["answer"]}} for f in faqs]}


def to_jsonld(faqs):
    return json.dumps(to_jsonld_data(faqs), indent=2, ensure_ascii=False)


def to_html(faqs, title=None):
    """FAQ section: one H2, an H3 per question, every answer visible, plus inert JSON-LD. No JavaScript."""
    esc = html.escape
    lines = ['<section class="faq" id="faq">', f'  <h2>{esc(title or CONFIG["faq_heading"])}</h2>']
    for f in faqs:
        lines.append(f"  <h3>{esc(f['question'])}</h3>")
        lines.append(f"  <p>{esc(f['answer'])}</p>")
    lines.append("</section>")
    lines.append('<script type="application/ld+json">')
    lines.append(to_jsonld(faqs).replace("</", "<\\/"))
    lines.append("</script>")
    return "\n".join(lines) + "\n"


def to_markdown(faqs, title=None):
    lines = [f"# {title or CONFIG['faq_heading']}", ""]
    for f in faqs:
        lines += [f"## {number(f)}. {f['question']}", "", f"*Popularity: {f['popularity']}%*", "", f["answer"], ""]
    return "\n".join(lines) + "\n"


def to_text(faqs):
    return "\n".join(f"{number(f)}. {f['question']} ({f['popularity']}%)\n    {f['answer']}\n" for f in faqs)


def render(faqs, fmt="text", title=None):
    """Render entries as text, markdown, json, jsonld or html."""
    if fmt == "markdown":
        return to_markdown(faqs, title)
    if fmt == "json":
        return json.dumps(faqs, indent=2, ensure_ascii=False) + "\n"
    if fmt == "jsonld":
        return to_jsonld(faqs) + "\n"
    if fmt == "html":
        return to_html(faqs, title)
    return to_text(faqs)


def page_html():
    """The full 50-question FAQ section for the service page."""
    return to_html(FAQ)


def seo():
    """SEO settings for the service page."""
    return dict(CONFIG["seo"], service_page=SERVICE_PAGE)


__all__ = [
    "ask", "get", "categories", "by_category", "popular", "score", "tokens", "normalize", "number",
    "render", "to_html", "to_jsonld", "to_jsonld_data", "to_markdown", "to_text",
    "page_html", "seo", "CONFIG", "FAQ", "__version__",
]
