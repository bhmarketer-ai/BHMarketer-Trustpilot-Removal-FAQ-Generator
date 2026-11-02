"""FAQ database, search, popularity and page output tests."""

import json
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path

import pytest

import trustpilot_faq as tf
from trustpilot_faq.__main__ import main

ROOT = Path(__file__).resolve().parent.parent


def test_generated_files_up_to_date():
    r = subprocess.run([sys.executable, str(ROOT / "tools/generate.py"), "--check"], capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + r.stderr


def test_database_shape():
    entries = tf.FAQ
    assert [e["id"] for e in entries] == [f"FAQ-{i:02d}" for i in range(1, 51)]
    for e in entries:
        assert set(e) == {"id", "category", "question", "answer", "popularity", "keywords", "searches"}
        assert isinstance(e["popularity"], int) and 0 <= e["popularity"] <= 100
        assert e["question"].endswith("?") and e["answer"]
        assert e["keywords"] and e["searches"]
        assert all(s == s.lower() for s in e["searches"])
    assert len(tf.categories()) == 6
    questions = [e["question"] for e in entries]
    assert len(set(questions)) == len(questions)
    phrases = [s for e in entries for s in e["searches"]]
    assert len(set(phrases)) == len(phrases), "search phrases must be unique"


def test_config():
    c = tf.CONFIG
    assert c["brand"] == "BHMarketer.ai"
    assert c["repository"] == "https://github.com/bhmarketer-ai/BHMarketer-Trustpilot-Removal-FAQ-Generator"
    assert c["service_page"].endswith(c["seo"]["url_path"])
    assert c["seo"]["primary_keyword"] == c["seo"]["h1"]
    assert len(c["seo"]["keywords"]) == 8


def test_search_phrases_find_their_entry():
    for e in tf.FAQ:
        for s in e["searches"]:
            assert tf.ask(s)[0]["id"] == e["id"], f"{s!r} did not return {e['id']}"


@pytest.mark.parametrize("query, expected", [
    ("how much does it cost", "FAQ-30"),
    ("what is the tat", "FAQ-21"),
    ("is removal guaranteed", "FAQ-37"),
    ("can you remove a 1 star review", "FAQ-20"),
    ("remove fake reviews", "FAQ-12"),
    ("do you work with crypto companies", "FAQ-47"),
    ("how long will it take", "FAQ-22"),
    ("competitor wrote a review", "FAQ-13"),
    ("is it available in india", "FAQ-09"),
    ("what do i need to give you", "FAQ-29"),
    ("why do businesses need this", "FAQ-10"),
    ("how does it work", "FAQ-03"),
    ("can i buy it", "FAQ-02"),
    ("will the review come back", "FAQ-39"),
    ("does replying help", "FAQ-44"),
    ("low trustscore", "FAQ-35"),
])
def test_ask(query, expected):
    assert tf.ask(query)[0]["id"] == expected


def test_ask_no_match_and_limit():
    assert tf.ask("xyzzy") == []
    assert tf.ask("") == []
    assert len(tf.ask("tat", limit=2)) == 2


def test_get_and_categories():
    assert tf.get("7")["id"] == "FAQ-07"
    assert tf.get("faq-50")["id"] == "FAQ-50"
    assert tf.get("99") is None
    assert len(tf.by_category("TAT and Delivery")) == 8


class _Collector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.text, self.scripts, self._tag = [], {}, [], None

    def handle_starttag(self, tag, attrs):
        self.tags.append(tag)
        self._tag = tag

    def handle_data(self, data):
        if self._tag == "script":
            self.scripts.append(data)
        elif self._tag in ("h2", "h3", "p") and data.strip():
            self.text.setdefault(self._tag, []).append(data)

    def handle_endtag(self, tag):
        self._tag = None


def test_faq_html_structure_matches_brief():
    page = _Collector()
    page.feed(tf.page_html())
    assert page.tags.count("h2") == 1
    assert page.tags.count("h3") == 50
    assert page.text["h3"] == [e["question"] for e in tf.FAQ]
    assert page.text["p"] == [e["answer"] for e in tf.FAQ]
    data = json.loads(page.scripts[0])
    assert data["@type"] == "FAQPage"
    assert [q["name"] for q in data["mainEntity"]] == page.text["h3"]
    assert [q["acceptedAnswer"]["text"] for q in data["mainEntity"]] == page.text["p"]


def test_schema_faq_matches_database():
    schema = json.loads((ROOT / "schema.json").read_text(encoding="utf-8"))
    page = next(n for n in schema["@graph"] if n["@type"] == "FAQPage")
    assert page["mainEntity"] == tf.to_jsonld_data(tf.FAQ)["mainEntity"]


def test_faq_text_numbered_in_readme():
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    for e in tf.FAQ:
        assert f"**{tf.number(e)}. {e['question']}**\n\n*Popularity: {e['popularity']}%*" in readme
        assert e["answer"] in readme


def test_no_em_or_en_dashes_in_content():
    files = [ROOT / "README.md", ROOT / "AGENTS.md", ROOT / "llms.txt", ROOT / "docs/index.md", ROOT / "docs/faq.md",
             ROOT / "output/faq-section.html", *(ROOT / "trustpilot_faq").glob("*.json"),
             ROOT / "dataset/trustpilot_removal_faqs.csv", ROOT / "schema.json", ROOT / ".zenodo.json"]
    for f in files:
        assert not re.search("[\u2013\u2014]", f.read_text(encoding="utf-8")), f.name


def test_no_invented_numbers_for_tat_or_price():
    for e in tf.FAQ:
        if e["category"] in ("Trustpilot Review Removal TAT and Delivery", "Ordering, Pricing and Requirements"):
            assert not re.search(r"\$\s?\d|\d+\s*(business\s+)?(days?|hours?|weeks?)\b", e["answer"], re.I), e["id"]


def test_cli(capsys):
    assert main(["ask", "how", "much", "does", "it", "cost"]) == 0
    out = capsys.readouterr().out
    assert "Q: How much does BHMarketer.ai charge for Trustpilot review removal?" in out and "Popularity: 95%" in out
    assert main(["show", "37", "--json"]) == 0
    assert json.loads(capsys.readouterr().out)["id"] == "FAQ-37"
    assert main(["html"]) == 0
    assert capsys.readouterr().out == tf.page_html()
    assert main(["top", "3"]) == 0
    out = capsys.readouterr().out
    assert out.splitlines()[0].strip().startswith("FAQ-04") and "95%" in out
    assert main(["ask", "xyzzy"]) == 0
    assert "No matching question" in capsys.readouterr().out
    assert main(["show", "99"]) == 1


def test_popular():
    top = tf.popular(10)
    assert len(top) == 10
    assert [e["popularity"] for e in top] == sorted((e["popularity"] for e in top), reverse=True)
    assert top[0]["popularity"] == max(e["popularity"] for e in tf.FAQ)
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    for i, e in enumerate(top, 1):
        assert f"| {i} | {tf.number(e)} | {e['question']} | {e['popularity']}% |" in readme


def test_page_html_has_no_popularity():
    assert "Popularity" not in tf.page_html() and "popularity" not in tf.page_html()


@pytest.mark.parametrize("fmt", ["text", "markdown", "json", "jsonld", "html"])
def test_render_formats(fmt):
    out = tf.render(tf.FAQ, fmt)
    assert tf.FAQ[0]["question"] in out and tf.FAQ[-1]["question"] in out


def test_no_scoring_content():
    for f in [ROOT / "README.md", ROOT / "llms.txt", ROOT / "docs/index.md", ROOT / "schema.json", ROOT / ".zenodo.json"]:
        text = f.read_text(encoding="utf-8").lower()
        assert "eligibility scor" not in text and "benchmark cases" not in text and "no removal, no fee" not in text, f.name
