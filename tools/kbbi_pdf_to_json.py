#!/usr/bin/env python3
"""
kbbi_pdf_to_json.py

Converts a KBBI PDF into structured JSON for local, offline use inside Manuskrip.

Why it works: in this PDF the typography is the grammar.
  * bold span sitting at the column left margin  -> a headword (lema)
  * bold span sitting at the hanging indent      -> a sublemma (derived form)
  * bold digit inside a paragraph                -> a sense number
  * italic span right after a headword           -> word class and usage labels
  * a line ending in "-" plus a lowercase start  -> hyphenation to be rejoined

So the parser reads font, weight, and x position rather than guessing from text.

Usage:
    pip install pymupdf
    python3 kbbi_pdf_to_json.py KBBI_Lengkap.pdf --out kbbi.json
    python3 kbbi_pdf_to_json.py KBBI_Lengkap.pdf --out sample.json --first 30 --last 40
    python3 kbbi_pdf_to_json.py KBBI_Lengkap.pdf --out headwords.json --headwords-only

Run this on your own copy. Keep the output local to your machine.
Do not bundle the result into a distributed build of the app.
"""

import argparse, json, re, statistics, sys
from collections import defaultdict

import fitz  # pymupdf

SENSE = "\u2016"          # internal marker for a sense number
NOISE = re.compile(r"(shared by|www\.|http)", re.I)
WORD_CLASS = {"n", "v", "a", "adv", "num", "p", "pron", "part"}


def page_lines(page):
    """Return visible lines as (y, x0, bold_first, spans) with page furniture dropped."""
    out = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            spans = [s for s in line["spans"] if s["text"]]   # keep spacing spans
            if not any(s["text"].strip() for s in spans):
                continue
            text = "".join(s["text"] for s in spans)
            size = max(s["size"] for s in spans)
            if NOISE.search(text):            # watermark
                continue
            if size > 11.0:                   # running header
                continue
            if len(text.strip()) <= 4 and text.strip().isdigit():   # folio
                continue
            out.append((round(line["bbox"][1], 1), round(line["bbox"][0], 1), spans))
    out.sort(key=lambda t: (t[0], t[1]))
    return out


def column_margins(lines, page_width):
    """Find the left margin of each of the two columns from the x histogram."""
    mid = page_width / 2
    left = [x for _, x, _ in lines if x < mid]
    right = [x for _, x, _ in lines if x >= mid]
    return (min(left) if left else 0.0, min(right) if right else mid)


def render(spans):
    """Flatten spans, marking bold sense digits and capturing the leading italic run.

    The leading italic run is the word class and usage labels, e.g. "kl a" or "n Bot".
    It sits after the bold headword and after any /pronunciation/, and before the gloss.
    """
    parts, lead = [], []
    phase = "pre"
    for s in spans:
        t = s["text"]
        bold = "Bold" in s["font"]
        italic = "Italic" in s["font"]
        if bold and t.strip().isdigit():
            parts.append(f"{SENSE}{t.strip()}{SENSE} ")
            phase = "done"
            continue
        if phase != "done":
            if not t.strip() or bold:
                pass                                  # headword or spacing
            elif italic:
                lead.append(t.strip())
                phase = "ital"
            elif re.match(r"\s*/", t):
                pass                                  # pronunciation, still in the head
            else:
                phase = "done"                        # gloss has begun
        parts.append(t)
    return "".join(parts), " ".join(x for x in lead if x)


def dehyphenate(text):
    text = re.sub(r"(\w)-\s+(\w)", r"\1\2", text)     # ja-\n ringan -> jaringan
    return re.sub(r"\s+", " ", text).strip()


def split_senses(body):
    """Split a body on sense markers into numbered senses."""
    chunks = [c.strip(" ;:,") for c in re.split(rf"{SENSE}\d+{SENSE}", body)]
    nums = re.findall(rf"{SENSE}(\d+){SENSE}", body)
    senses = []
    if not nums:
        text = chunks[0] if chunks else ""
        if text:
            senses.append({"n": 1, **split_example(text)})
        return senses
    if chunks and chunks[0]:
        senses.append({"n": 0, **split_example(chunks[0])})   # text before sense 1
    for n, chunk in zip(nums, chunks[1:]):
        if chunk:
            senses.append({"n": int(n), **split_example(chunk)})
    return [s for s in senses if s["definition"]]


def split_example(text):
    """KBBI puts usage examples after a colon, in italics. Text after ':' is the example."""
    if ":" in text:
        d, ex = text.split(":", 1)
        return {"definition": d.strip(" ;,"), "example": ex.strip(" ;,")}
    return {"definition": text.strip(" ;,"), "example": None}


def parse_head(body, lead_italic):
    """Pull pronunciation, word class, and usage labels off the front of an entry body."""
    pron = None
    m = re.match(r"\s*/([^/]+)/\s*", body)
    if m:
        pron, body = m.group(1), body[m.end():]
    tokens = lead_italic.split() if lead_italic else []
    # strip exactly those head tokens from the front of the body
    for tok in tokens:
        body = re.sub(rf"^\s*{re.escape(tok)}\b", "", body)
    wclass = [t for t in tokens if t in WORD_CLASS]
    labels = [t for t in tokens if t not in WORD_CLASS]
    return pron, wclass, labels, body.strip(" ;:,")


def parse(doc, first, last):
    entries, current = [], None
    for pno in range(first - 1, min(last, doc.page_count)):
        page = doc[pno]
        lines = page_lines(page)
        if not lines:
            continue
        c1, c2 = column_margins(lines, page.rect.width)
        # walk column by column, top to bottom
        for margin in (c1, c2):
            hi = margin + 12.0     # anything past this is the hanging indent
            col = [l for l in lines if margin - 1 <= l[1] < margin + 40]
            for _, x, spans in col:
                text, lead = render(spans)
                head_span = next((s for s in spans if s["text"].strip()), None)
                if head_span is None:
                    continue
                bold_first = "Bold" in head_span["font"]
                is_head = bold_first and x <= margin + 2.0
                is_sub = bold_first and x > margin + 2.0 and x < hi + 30
                if is_head:
                    if current:
                        entries.append(current)
                    head = head_span["text"].strip()
                    current = {
                        "lemma": head,
                        "page": pno + 1,
                        "_body": text.split(head, 1)[-1],
                        "_lead": lead,
                        "sub": [],
                    }
                elif current is not None and is_sub and len(head_span["text"].strip()) > 2:
                    head = head_span["text"].strip()
                    current["sub"].append({"lemma": head,
                                           "_body": text.split(head, 1)[-1],
                                           "_lead": lead})
                elif current is not None:
                    if current["sub"]:
                        current["sub"][-1]["_body"] += " " + text
                    else:
                        current["_body"] += " " + text
    if current:
        entries.append(current)
    return [finalize(e) for e in entries]


def finalize(e):
    body = dehyphenate(e.pop("_body"))
    pron, wclass, labels, body = parse_head(body, e.pop("_lead"))
    subs = []
    for s in e["sub"]:
        sbody = dehyphenate(s.pop("_body"))
        _, swc, slab, sbody = parse_head(sbody, s.pop("_lead"))
        subs.append({"lemma": s["lemma"], "wordClass": swc, "labels": slab,
                     "senses": split_senses(sbody)})
    return {
        "lemma": re.sub(r"^\d+\s*", "", e["lemma"]).strip(),
        "homonym": (m.group(1) if (m := re.match(r"^(\d+)", e["lemma"])) else None),
        "pronunciation": pron,
        "wordClass": wclass,
        "labels": labels,
        "senses": split_senses(body),
        "subEntries": subs,
        "page": e["page"],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--out", default="kbbi.json")
    ap.add_argument("--first", type=int, default=1)
    ap.add_argument("--last", type=int, default=10**6)
    ap.add_argument("--headwords-only", action="store_true",
                    help="emit a flat wordlist for the spell checker instead of full entries")
    a = ap.parse_args()

    doc = fitz.open(a.pdf)
    last = min(a.last, doc.page_count)
    entries = parse(doc, a.first, last)
    entries = [e for e in entries if e["lemma"] and (e["senses"] or e["subEntries"])]

    if a.headwords_only:
        words = set()
        for e in entries:
            words.add(e["lemma"])
            words.update(s["lemma"] for s in e["subEntries"])
        payload = sorted(w for w in words if re.fullmatch(r"[A-Za-zÉéÈè'\- ]{2,}", w))
    else:
        payload = entries

    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)

    n_sub = sum(len(e["subEntries"]) for e in entries)
    n_sense = sum(len(e["senses"]) for e in entries)
    print(f"pages {a.first}..{last}  lemmas {len(entries)}  sublemmas {n_sub}  senses {n_sense}")
    print(f"wrote {a.out}")


if __name__ == "__main__":
    main()
