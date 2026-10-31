"""
trustpilot_faq: BHMarketer Trustpilot Removal FAQ Generator.

A dependency-free bot that (1) checks a Trustpilot review against the reasons
Trustpilot accepts when a business reports a review, scoring removal
eligibility from 0 to 100, and (2) generates a tailored Trustpilot review
removal FAQ as text, Markdown, JSON, FAQPage JSON-LD or HTML.

Usage:
    tp-faq analyze "review text" [--no-record] [--product-not-sold]
                   [--location-not-exist] [--competitor] [--wrong-business]
                   [--staff NAME] [--other BUSINESS] [--json]
    tp-faq generate [--review "review text" [facts]] [--reason ID]
                    [--format text|markdown|json|jsonld|html] [--no-service]
    tp-faq reasons
    tp-faq faqs [--tag TAG]

The score is an estimate to guide a report, not a guarantee: Trustpilot's
Content Integrity team makes the final decision. Not affiliated with Trustpilot.
Built by BHMarketer.ai (https://bhmarketer.ai). MIT License.
"""

import html
import json
import re
import sys

__version__ = "1.0.0"

WEBSITE = "https://bhmarketer.ai"
SERVICE_PAGE = "https://bhmarketer.ai/trustpilot-review-removal/"
REPO = "https://github.com/bhmarketer-ai/BHMarketer-Trustpilot-Removal-FAQ-Generator"

REASONS = [
    {"id": "harmful-illegal", "label": "Harmful or illegal", "description": "Threats, hate speech, harassment, discriminatory or obscene language, or other content that breaks the law.", "evidence": "The exact sentences that are threatening, hateful or unlawful.", "note": "Trustpilot hides reviews flagged for this reason while it investigates."},
    {"id": "personal-information", "label": "Contains personal information", "description": "Names, phone numbers, email addresses, home addresses or other details that identify a private person.", "evidence": "The personal details in the review and confirmation they are not already public on your profile or website.", "note": "Trustpilot will not remove information that is already on your Trustpilot profile or website, or the reviewer's own details."},
    {"id": "advertising-promotional", "label": "Advertising or promotional", "description": "Links, promo codes or calls to action for another business, or content that only promotes a political, religious or ethical view.", "evidence": "The link, code or promotional wording, and why it is unrelated to a real experience.", "note": "Mentioning or comparing a competitor is not enough on its own."},
    {"id": "not-genuine", "label": "Not based on a genuine experience", "description": "The reviewer never bought, used or contacted your business, or the review describes a product, staff member or location you do not have.", "evidence": "Records showing no matching order or contact, or facts in the review that cannot be true for your business.", "note": "A reviewer can be genuine even if you cannot find them in your records, so evidence matters more than suspicion."},
    {"id": "different-business", "label": "About a different business", "description": "The review is clearly about another company, product or website, not yours.", "evidence": "The other business named or described in the review and how it differs from yours.", "note": "Only businesses can report for this reason."}
]

FAQS = [
    {"id": 1, "tags": ["core"], "question": "Can a business remove a Trustpilot review?", "answer": "Not directly. A business can report a review that breaks Trustpilot's guidelines, and Trustpilot's Content Integrity team decides whether it comes down. Reviews that are negative but genuine stay online."},
    {"id": 2, "tags": ["core"], "question": "Which Trustpilot reviews can be removed?", "answer": "Reviews that are harmful or illegal, contain personal information, are advertising or promotional, are not based on a genuine experience, or are about a different business. These are the reasons Trustpilot accepts when a business reports a review."},
    {"id": 3, "tags": ["core", "not-removable"], "question": "Will Trustpilot remove a negative review just because it is unfair?", "answer": "No. Trustpilot keeps honest opinions online, even harsh ones. A review only qualifies for removal when it breaks a specific guideline, so the first step is always to check which guideline, if any, it breaks."},
    {"id": 4, "tags": ["core"], "question": "How do I report a Trustpilot review?", "answer": "Log in to your Trustpilot Business account, find the review, click the flag icon and choose the reason that matches the guideline it breaks. Add a short, factual explanation and any supporting evidence."},
    {"id": 5, "tags": ["core"], "question": "Does a reported review stay visible during the investigation?", "answer": "Usually yes. Trustpilot keeps reported reviews online while it investigates, except reviews flagged as harmful or illegal, which are hidden during the check."},
    {"id": 6, "tags": ["core"], "question": "What happens if Trustpilot agrees with the report?", "answer": "Trustpilot removes the review because it breaches its guidelines and lets the reviewer know. If Trustpilot disagrees, the review stays and you can still reply to it publicly."},
    {"id": 7, "tags": ["core"], "question": "Can reporting reviews get my business in trouble?", "answer": "Reporting a review that genuinely breaks the guidelines is allowed. Misusing the flagging tool, for example reporting every negative review, is not tolerated by Trustpilot and can lead to action against the business."},
    {"id": 8, "tags": ["core", "not-removable"], "question": "What should I do if a review cannot be removed?", "answer": "Reply publicly, calmly and factually, offer to resolve the issue, and keep inviting all genuine customers to review you through a fair, neutral invitation process. A thoughtful reply often matters more to readers than the review itself."},
    {"id": 9, "tags": ["harmful-illegal"], "question": "What counts as harmful or illegal content on Trustpilot?", "answer": "Threats, hate speech, harassment, discriminatory or obscene language, and content that breaks the law. Calling a service bad is an opinion; threatening a staff member is harmful content."},
    {"id": 10, "tags": ["harmful-illegal"], "question": "Is a review defamatory if it says my service is terrible?", "answer": "No. Opinions such as \"I did not like their service\" are not statements of fact, so they are not defamation. False statements of fact that harm your business are a different matter and may need legal advice."},
    {"id": 11, "tags": ["personal-information"], "question": "Can a review be removed for naming my staff?", "answer": "It can be reported if it includes personal information that identifies a private person, such as a full name with contact details. Information already shown on your Trustpilot profile or website does not count."},
    {"id": 12, "tags": ["personal-information"], "question": "What personal information breaks Trustpilot's guidelines?", "answer": "Details that identify a private person, such as phone numbers, email addresses, home addresses or full names combined with other identifying details. A reviewer sharing their own details is not a reason for removal."},
    {"id": 13, "tags": ["advertising-promotional"], "question": "Can I report a review that promotes a competitor?", "answer": "Yes, if it advertises another business, for example with links, promo codes or calls to action unrelated to the reviewer's experience. A review that simply mentions or compares a competitor is allowed."},
    {"id": 14, "tags": ["advertising-promotional"], "question": "What about reviews that are really political or social posts?", "answer": "Reviews written only to push a political, religious or ethical view, or only about a trending news topic, rather than feedback on a genuine experience, can be reported as promotional."},
    {"id": 15, "tags": ["not-genuine"], "question": "How do I prove a reviewer was never a customer?", "answer": "Search your orders, bookings, emails and support tickets for any match. A strong report explains what you searched and points to facts in the review that cannot be true, such as a product you do not sell or a location you do not have."},
    {"id": 16, "tags": ["not-genuine"], "question": "Is \"I cannot find this customer\" enough to remove a review?", "answer": "No. A genuine experience includes calls, chats, emails and support contact, and people sometimes review under a different name. Trustpilot looks for evidence, not just a missing record."},
    {"id": 17, "tags": ["not-genuine"], "question": "Can a review from a competitor or former employee be removed?", "answer": "A review written to undermine a competitor or by someone without a genuine customer experience can be reported as not based on a genuine experience. Show the connection with evidence rather than just claiming it."},
    {"id": 18, "tags": ["different-business"], "question": "What if the review is about a different company?", "answer": "Businesses can report a review that is clearly about another business. Point out the other company, product or website it describes and how that differs from yours."},
    {"id": 19, "tags": ["service"], "question": "How does BHMarketer.ai help with Trustpilot review removal?", "answer": "BHMarketer.ai checks each review against Trustpilot's guidelines first, prepares a clear evidence-based report for the reviews that qualify, and handles follow-up. Reviews that do not break a guideline are not reported."},
    {"id": 20, "tags": ["service"], "question": "What is BHMarketer.ai's removal guarantee?", "answer": "No removal, no fee. If a rule-breaking review is not taken down, you do not pay for that review."},
    {"id": 21, "tags": ["service"], "question": "Does BHMarketer.ai write or buy fake reviews?", "answer": "Never. BHMarketer.ai only uses legitimate guideline-based reporting. Buying, incentivizing or faking reviews breaks Trustpilot's rules and is never part of the process."},
    {"id": 22, "tags": ["service"], "question": "Do I need a Trustpilot Business account?", "answer": "Reporting is done from a Trustpilot Business account, and claiming your free profile also lets you reply to reviews. BHMarketer.ai can guide you through setting it up."},
    {"id": 23, "tags": ["service"], "question": "Can you remove every negative Trustpilot review?", "answer": "No, and no honest provider can. Only reviews that break Trustpilot's guidelines can be reported. BHMarketer.ai tells you upfront which reviews qualify and which are better handled with a public reply."},
    {"id": 24, "tags": ["service"], "question": "Is my business information kept private?", "answer": "Yes. Order records and evidence you share are used only to prepare the report for your case."},
    {"id": 25, "tags": ["service"], "question": "Does BHMarketer.ai handle reviews on other platforms too?", "answer": "Yes. BHMarketer.ai also handles guideline-based review removal for Google, Glassdoor and Airbnb, plus press release distribution and AI search visibility."}
]

BANDS = [
    (0, 30, "Unlikely", "No clear guideline breach found. Reply publicly instead of reporting."),
    (31, 60, "Possible", "A guideline may apply. Gather stronger evidence before reporting."),
    (61, 80, "Likely", "A guideline probably applies. Report with the evidence listed."),
    (81, 100, "Strong case", "A clear guideline breach. Report it with the evidence listed."),
]

THREAT_WORDS = ["kill you", "kill him", "kill her", "hurt you", "burn down", "find you", "find where you live",
                "beat you", "watch your back", "you will pay", "coming for you"]
ABUSE_WORDS = ["fuck", "fucking", "shit", "bitch", "bastard", "asshole", "cunt", "retard", "whore"]
NOT_GENUINE_CUES = ["never used", "never bought", "never ordered", "never tried", "have not used",
                    "haven't used", "havent used", "not a customer", "my friend said", "a friend told",
                    "someone told me", "i heard", "heard that", "i read that", "apparently"]
PROMO_CUES = ["use code", "promo code", "discount code", "coupon", "referral code", "% off"]
CTA_CUES = ["buy from", "go to", "visit ", "check out", "switch to", "sign up at", "order from"]

EMAIL_RE = re.compile(r"[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}")
PHONE_RE = re.compile(r"\+\d[\d\s().-]{7,}\d|\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b")
URL_RE = re.compile(r"(?:https?://|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|co|shop|store|ai)\b")
ADDRESS_RE = re.compile(r"\b\d{1,5}\s+\w+(?:\s\w+)?\s+(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr)\b|lives at|home address")


def _hits(text, words):
    """Return the cue words found in text as whole words."""
    return [w.strip() for w in words if re.search(r"(?<!\w)" + re.escape(w.strip()) + r"(?!\w)", text)]


def analyze(review, facts=None):
    """Score a review against each Trustpilot reporting reason.

    facts (all optional): no_record, product_not_sold, location_not_exist,
    competitor, wrong_business (bool); staff, other (list of names).
    """
    f = facts or {}
    text = " ".join(str(review).lower().split())
    found = {r["id"]: [] for r in REASONS}
    score = {r["id"]: 0 for r in REASONS}

    def add(reason, points, signal):
        score[reason] = min(100, score[reason] + points)
        found[reason].append(signal)

    for w in _hits(text, THREAT_WORDS):
        add("harmful-illegal", 85, f"threatening language: \"{w}\"")
    for w in _hits(text, ABUSE_WORDS):
        add("harmful-illegal", 35, f"abusive language: \"{w}\"")

    if EMAIL_RE.search(text):
        add("personal-information", 60, "email address in the review")
    if PHONE_RE.search(text):
        add("personal-information", 60, "phone number in the review")
    if ADDRESS_RE.search(text):
        add("personal-information", 50, "home or street address in the review")
    for name in f.get("staff", []):
        if name and name.lower() in text:
            add("personal-information", 40, f"names staff member \"{name}\" (not removable if shown on your profile or website)")

    if URL_RE.search(EMAIL_RE.sub(" ", text)):
        add("advertising-promotional", 45, "link or website address in the review")
    for w in _hits(text, PROMO_CUES):
        add("advertising-promotional", 50, f"promotional wording: \"{w}\"")
    for w in _hits(text, CTA_CUES):
        add("advertising-promotional", 20, f"call to action: \"{w}\"")

    if f.get("no_record"):
        add("not-genuine", 40, "no matching order, booking or contact found in your records")
    if f.get("product_not_sold"):
        add("not-genuine", 45, "mentions a product or service you do not sell")
    if f.get("location_not_exist"):
        add("not-genuine", 45, "mentions a location you do not have")
    if f.get("competitor"):
        add("not-genuine", 40, "evidence the reviewer is a competitor or former employee")
    for w in _hits(text, NOT_GENUINE_CUES):
        add("not-genuine", 35, f"second-hand or no-experience wording: \"{w}\"")

    if f.get("wrong_business"):
        add("different-business", 80, "you confirmed the review is about another business")
    for name in f.get("other", []):
        if name and name.lower() in text:
            add("different-business", 50, f"names another business: \"{name}\"")

    reasons = []
    for r in REASONS:
        if score[r["id"]] > 0:
            reasons.append({"id": r["id"], "label": r["label"], "score": score[r["id"]],
                            "signals": found[r["id"]], "evidence": r["evidence"], "note": r["note"]})
    reasons.sort(key=lambda x: (-x["score"], [r["id"] for r in REASONS].index(x["id"])))
    eligibility = reasons[0]["score"] if reasons else 0
    label, advice = band(eligibility)
    return {"eligibility": eligibility, "band": label, "advice": advice, "reasons": reasons}


def band(score):
    """Return (label, advice) for an eligibility score."""
    for low, high, label, advice in BANDS:
        if low <= score <= high:
            return label, advice
    return "Unlikely", ""


def generate(reasons=None, include_service=True):
    """Return a tailored FAQ list: core FAQs, FAQs for the given reason ids, then service FAQs."""
    wanted = list(reasons or [])
    out = [f for f in FAQS if "core" in f["tags"]]
    for rid in wanted:
        out += [f for f in FAQS if rid in f["tags"] and f not in out]
    if include_service:
        out += [f for f in FAQS if "service" in f["tags"] and f not in out]
    return [{"question": f["question"], "answer": f["answer"]} for f in out]


def to_markdown(faqs, title="Trustpilot Review Removal FAQ"):
    lines = [f"# {title}", ""]
    for i, f in enumerate(faqs, 1):
        lines += [f"## {i}. {f['question']}", "", f["answer"], ""]
    lines.append(f"*Generated by the BHMarketer Trustpilot Removal FAQ Generator. Learn more: {SERVICE_PAGE}*")
    return "\n".join(lines) + "\n"


def to_jsonld(faqs):
    return json.dumps({"@context": "https://schema.org", "@type": "FAQPage",
                       "mainEntity": [{"@type": "Question", "name": f["question"],
                                       "acceptedAnswer": {"@type": "Answer", "text": f["answer"]}} for f in faqs]},
                      indent=2, ensure_ascii=False)


def to_html(faqs, title="Trustpilot Review Removal FAQ"):
    items = "\n".join(f"  <h3>{html.escape(f['question'])}</h3>\n  <p>{html.escape(f['answer'])}</p>" for f in faqs)
    return (f"<section class=\"tp-faq\">\n  <h2>{html.escape(title)}</h2>\n{items}\n</section>\n"
            f"<script type=\"application/ld+json\">\n{to_jsonld(faqs)}\n</script>\n")


def to_text(faqs):
    return "\n".join(f"Q{i}. {f['question']}\n    {f['answer']}\n" for i, f in enumerate(faqs, 1))


def render(faqs, fmt="text"):
    if fmt == "markdown":
        return to_markdown(faqs)
    if fmt == "json":
        return json.dumps(faqs, indent=2, ensure_ascii=False) + "\n"
    if fmt == "jsonld":
        return to_jsonld(faqs) + "\n"
    if fmt == "html":
        return to_html(faqs)
    return to_text(faqs)


def parse_args(args):
    """Parse CLI options into (positional text, facts, options)."""
    facts = {"staff": [], "other": []}
    opts = {"json": False, "format": "text", "reasons": [], "service": True, "review": None, "tag": None}
    words = []
    flags = {"--no-record": "no_record", "--product-not-sold": "product_not_sold",
             "--location-not-exist": "location_not_exist", "--competitor": "competitor",
             "--wrong-business": "wrong_business"}
    i = 0
    while i < len(args):
        a = args[i]
        if a in flags:
            facts[flags[a]] = True
        elif a == "--staff" and i + 1 < len(args):
            i += 1; facts["staff"].append(args[i])
        elif a == "--other" and i + 1 < len(args):
            i += 1; facts["other"].append(args[i])
        elif a == "--json":
            opts["json"] = True
        elif a == "--format" and i + 1 < len(args):
            i += 1; opts["format"] = args[i]
        elif a == "--reason" and i + 1 < len(args):
            i += 1; opts["reasons"].append(args[i])
        elif a == "--review" and i + 1 < len(args):
            i += 1; opts["review"] = args[i]
        elif a == "--tag" and i + 1 < len(args):
            i += 1; opts["tag"] = args[i]
        elif a == "--no-service":
            opts["service"] = False
        else:
            words.append(a)
        i += 1
    return " ".join(words), facts, opts


def main(argv=None):
    args = sys.argv[1:] if argv is None else list(argv)
    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    cmd, rest = args[0], args[1:]
    if cmd == "--version":
        print(__version__)
        return 0
    text, facts, opts = parse_args(rest)

    if cmd == "reasons":
        for r in REASONS:
            print(f"{r['id']:24} {r['label']}\n{'':24} {r['description']}")
        return 0
    if cmd == "faqs":
        for f in FAQS:
            if not opts["tag"] or opts["tag"] in f["tags"]:
                print(f"{f['id']:>2}. [{', '.join(f['tags'])}] {f['question']}")
        return 0
    if cmd == "analyze":
        if not text:
            print("Give the review text, e.g. tp-faq analyze \"review text\"")
            return 1
        res = analyze(text, facts)
        if opts["json"]:
            print(json.dumps(res, indent=2, ensure_ascii=False))
            return 0
        print(f"Removal eligibility: {res['eligibility']}/100 ({res['band']})")
        print(f"Advice: {res['advice']}\n")
        if not res["reasons"]:
            print("No Trustpilot reporting reason matched. Genuine negative opinions stay online.")
        for r in res["reasons"]:
            print(f"- {r['label']} [{r['id']}]: {r['score']}/100")
            for s in r["signals"]:
                print(f"    signal: {s}")
            print(f"    evidence to include: {r['evidence']}")
            print(f"    note: {r['note']}")
        print("\nEstimate only. Trustpilot makes the final decision. Not affiliated with Trustpilot.")
        print(f"Help with eligible reviews: {SERVICE_PAGE}")
        return 0
    if cmd == "generate":
        reasons = list(opts["reasons"])
        review = opts["review"] or (text or None)
        if review:
            reasons += [r["id"] for r in analyze(review, facts)["reasons"] if r["score"] > 30 and r["id"] not in reasons]
        sys.stdout.write(render(generate(reasons, opts["service"]), opts["format"]))
        return 0
    print(f"Unknown command \"{cmd}\". Try --help")
    return 1


if __name__ == "__main__":
    sys.exit(main())
