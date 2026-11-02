"""
tp-faq: BHMarketer Trustpilot Removal FAQ Generator.

Usage:
    tp-faq ask QUESTION [--limit N] [--json]
    tp-faq top [N] [--json]           most popular questions
    tp-faq show N [--json]
    tp-faq list [CATEGORY] [--json]
    tp-faq categories
    tp-faq export [--format text|markdown|json|jsonld|html]
    tp-faq html                       full 50-question page FAQ section with JSON-LD
    tp-faq jsonld                     FAQPage structured data for all 50 questions
    tp-faq seo                        page SEO settings

Popularity is BHMarketer.ai's estimate of how often each question is asked.
Built by BHMarketer.ai (https://bhmarketer.ai). MIT License.
"""

import json
import sys

from . import FAQ, __version__, ask, by_category, categories, get, page_html, popular, render, seo, to_jsonld


def parse_args(args):
    """Split CLI args into (positional text, options)."""
    opts = {"json": False, "format": "text", "limit": 3}
    words = []
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--json":
            opts["json"] = True
        elif a == "--format" and i + 1 < len(args):
            i += 1
            opts["format"] = args[i]
        elif a == "--limit" and i + 1 < len(args):
            i += 1
            opts["limit"] = int(args[i])
        else:
            words.append(a)
        i += 1
    return " ".join(words), opts


def _entry(e):
    print(f"Q: {e['question']}")
    print(f"Popularity: {e['popularity']}%")
    print(f"A: {e['answer']}")


def _line(e):
    print(f"  {e['id']}  {e['popularity']:>3}%  {e['question']}")


def _dump(data):
    print(json.dumps(data, indent=2, ensure_ascii=False))


def main(argv=None):
    args = sys.argv[1:] if argv is None else list(argv)
    if not args or args[0] in ("-h", "--help", "help"):
        print(__doc__)
        return 0
    cmd, rest = args[0], args[1:]
    if cmd == "--version":
        print(__version__)
        return 0
    text, opts = parse_args(rest)

    if cmd == "ask":
        data = ask(text, opts["limit"])
        if opts["json"]:
            _dump(data)
        elif not data:
            print("No matching question. Try other words, or run: tp-faq list")
        else:
            _entry(data[0])
            if len(data) > 1:
                print("\nAlso see:")
                for e in data[1:]:
                    _line(e)
        return 0

    if cmd == "top":
        data = popular(int(text) if text.isdigit() else 10)
        if opts["json"]:
            _dump(data)
        else:
            for e in data:
                _line(e)
        return 0

    if cmd == "show":
        e = get(text)
        if e is None:
            print(f"No question '{text}'", file=sys.stderr)
            return 1
        _dump(e) if opts["json"] else _entry(e)
        return 0

    if cmd in ("list", "faqs"):
        data = by_category(text) if text else list(FAQ)
        if opts["json"]:
            _dump(data)
            return 0
        current = None
        for e in data:
            if e["category"] != current:
                current = e["category"]
                print(f"\n{current}")
            _line(e)
        return 0

    if cmd == "categories":
        _dump(categories()) if opts["json"] else print("\n".join(categories()))
        return 0

    if cmd == "export":
        sys.stdout.write(render(FAQ, opts["format"]))
        return 0
    if cmd == "html":
        sys.stdout.write(page_html())
        return 0
    if cmd == "jsonld":
        print(to_jsonld(FAQ))
        return 0
    if cmd == "seo":
        _dump(seo())
        return 0

    print(f"Unknown command \"{cmd}\". Try --help")
    return 1


if __name__ == "__main__":
    sys.exit(main())
