"""Regenerate every derived file from config.json and faq.json.

    python tools/generate.py           write generated files
    python tools/generate.py --check   exit 1 if any generated file is stale

Generated: dataset CSV, docs/faq.md, README FAQ and category sections, schema.json FAQPage,
output/faq-section.html, output/seo.json, llms.txt.
"""

import csv
import io
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import trustpilot_faq as tf  # noqa: E402

FIELDS = ["id", "category", "question", "answer", "popularity", "keywords", "searches"]
REPO = tf.REPO


def faq_csv():
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=FIELDS, lineterminator="\n")
    w.writeheader()
    for e in tf.FAQ:
        w.writerow({**{k: e[k] for k in FIELDS[:5]},
                    "keywords": "; ".join(e["keywords"]), "searches": "; ".join(e["searches"])})
    return buf.getvalue()


def faq_markdown(level):
    out, current = [], None
    for e in tf.FAQ:
        if e["category"] != current:
            current = e["category"]
            out.append(f"{level} {current}\n")
        out.append(f"**{tf.number(e)}. {e['question']}**\n")
        out.append(f"*Popularity: {e['popularity']}%*\n")
        out.append(f"{e['answer']}\n")
    return "\n".join(out).rstrip()


def categories_table():
    counts = {}
    for e in tf.FAQ:
        counts[e["category"]] = counts.get(e["category"], 0) + 1
    lines = ["| Category | Questions |", "|----------|-----------|"]
    lines += [f"| {c} | {n} |" for c, n in counts.items()]
    return "\n".join(lines)


def popular_table():
    lines = ["| Rank | # | Question | Popularity |", "|---|---|---|---|"]
    lines += [f"| {i} | {tf.number(e)} | {e['question']} | {e['popularity']}% |" for i, e in enumerate(tf.popular(10), 1)]
    return "\n".join(lines)


def replace_block(text, name, body):
    pattern = re.compile(rf"(<!-- {name}:START -->\n).*?(<!-- {name}:END -->)", re.S)
    if not pattern.search(text):
        raise SystemExit(f"marker {name} not found")
    return pattern.sub(lambda m: m.group(1) + body + "\n" + m.group(2), text)


def readme():
    text = (ROOT / "README.md").read_text(encoding="utf-8")
    text = replace_block(text, "CATEGORIES", categories_table())
    text = replace_block(text, "POPULAR", popular_table())
    return replace_block(text, "FAQ", faq_markdown("###"))


def schema():
    data = json.loads((ROOT / "schema.json").read_text(encoding="utf-8"))
    for node in data["@graph"]:
        if node["@type"] == "FAQPage":
            node["mainEntity"] = tf.to_jsonld_data(tf.FAQ)["mainEntity"]
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n"


def llms_txt():
    c = tf.CONFIG
    lines = [
        f"# {c['brand']} {c['service']} FAQ",
        "",
        f"> {len(tf.FAQ)} questions and answers about the {c['brand']} {c['service']}: what it is, which reviews "
        "can be reported, turnaround time (TAT), ordering, pricing, results and support. "
        f"{c['brand']} assists with assessing and reporting reviews; Trustpilot makes the final removal decision "
        "and no removal is guaranteed. Each question has a popularity score (0 to 100%), BHMarketer.ai's estimate of "
        "how often it is asked.",
        "",
        f"- Service page: {c['service_page']}",
        f"- Website: {c['website']}",
        f"- Repository: {REPO}",
        "- Database: trustpilot_faq/faq.json",
        "",
        "## Questions",
        "",
    ]
    lines += [f"- {e['id']} ({e['popularity']}%): {e['question']}" for e in tf.FAQ]
    return "\n".join(lines) + "\n"


def outputs():
    return {
        ROOT / "dataset/trustpilot_removal_faqs.csv": faq_csv(),
        ROOT / "docs/faq.md": f"# {tf.CONFIG['faq_heading']}\n\n{faq_markdown('##')}\n",
        ROOT / "README.md": readme(),
        ROOT / "schema.json": schema(),
        ROOT / "output/faq-section.html": tf.page_html(),
        ROOT / "output/seo.json": json.dumps(tf.seo(), indent=2, ensure_ascii=False) + "\n",
        ROOT / "llms.txt": llms_txt(),
    }


def main():
    check = "--check" in sys.argv
    stale = []
    for path, content in outputs().items():
        current = path.read_text(encoding="utf-8") if path.exists() else None
        if current != content:
            stale.append(path.relative_to(ROOT))
            if not check:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content, encoding="utf-8")
    if check and stale:
        print("Stale generated files:", *stale, sep="\n  ")
        return 1
    print("Up to date." if not stale else f"Wrote {len(stale)} file(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
