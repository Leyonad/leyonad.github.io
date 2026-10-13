#!/usr/bin/env python3
"""
Ein einfaches Tool, das die Datei `poetic-novels/knabenheit.md` liest
und mit heuristischen Regeln schlechte Endreime in aufeinanderfolgenden
Zeilen (Couplets) meldet.

Benutzung: python check_rhymes.py
"""
from __future__ import annotations
import re
import sys
from pathlib import Path
from typing import List, Tuple
import argparse

# Versuche, eine phonetics-Bibliothek zu verwenden (falls installiert).
USE_PHONETICS = False
phonetics = None
try:
    import metaphone as _metaphone
    phonetics = _metaphone
    USE_PHONETICS = True
except Exception:
    try:
        # einige Distributionen haben 'phonetics' oder 'fuzzy' mit metaphone
        import phonetics as _phonetics
        phonetics = _phonetics
        USE_PHONETICS = True
    except Exception:
        USE_PHONETICS = False

# Vokale für die Heuristik
VOWELS = "aeiouäöü"

# optional pyphen hyphenation module for syllable counting
USE_PYPHEN = False
pyphen = None
try:
    import pyphen as _pyphen
    pyphen = _pyphen.Pyphen(lang='de_DE')
    USE_PYPHEN = True
except Exception:
    USE_PYPHEN = False


def normalize(word: str) -> str:
    word = word.lower()
    # einfache Normalisierung von typischen deutschen Zeichen
    word = word.replace("ß", "ss")
    word = word.replace("ä", "a").replace("ö", "o").replace("ü", "u")
    word = re.sub(r"^[^a-z0-9]+|[^a-z0-9]+$", "", word)
    return word


def last_word(line: str) -> str:
    # Entferne Markdown- und Zitatzeichen
    line = line.strip()
    line = re.sub(r"^([\"'„‚`]+)", "", line)
    line = re.sub(r"([\"'“”‚`]+)$", "", line)
    parts = re.findall(r"[\wÄÖÜäöüß'-]+", line, flags=re.UNICODE)
    if not parts:
        return ""
    return parts[-1]


def rhyme_part(w: str) -> str:
    """Return a short signature for rhyme comparison.
    Try phonetics when available, otherwise a heuristic: last vowel + consonant class.
    """
    w = normalize(w)
    if not w:
        return ""

    # Prefer phonetic key if available
    if USE_PHONETICS and phonetics is not None:
        try:
            if hasattr(phonetics, 'doublemetaphone'):
                k = phonetics.doublemetaphone(w)
                if isinstance(k, (list, tuple)):
                    k = k[0] or k[1] or ''
                return str(k)
            if hasattr(phonetics, 'metaphone'):
                return str(phonetics.metaphone(w))
        except Exception:
            pass

    # Fallback heuristic
    vowel = ""
    for ch in reversed(w):
        if ch in VOWELS:
            vowel = ch
            break
    tail = w[-3:].lower()
    cons_class = ""
    if tail.endswith('ng') or tail.endswith('n') or tail.endswith('m'):
        cons_class = 'N'
    elif tail.endswith('ch'):
        cons_class = 'CH'
    elif tail.endswith('ck') or tail.endswith('k') or tail.endswith('g'):
        cons_class = 'K'
    elif tail.endswith('st') or tail.endswith('s') or tail.endswith('ss') or tail.endswith('z'):
        cons_class = 'S'
    elif tail.endswith('t') or tail.endswith('d'):
        cons_class = 'T'
    else:
        cons_class = tail[-2:]

    sig = f"{vowel}:{cons_class}"
    return sig[:8]


def levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            insert = cur[j - 1] + 1
            delete = prev[j] + 1
            replace = prev[j - 1] + (0 if ca == cb else 1)
            cur.append(min(insert, delete, replace))
        prev = cur
    return prev[-1]


def count_syllables(line: str) -> int:
    """A simple heuristic to count syllables in a German line.
    Strategy:
    - Normalize to lowercase, replace umlauts and ß
    - Count groups of vowels (a,e,i,o,u,ä,ö,ü,eu,ei,au,ie) as syllables
    - Subtract for common silent endings or one-letter words
    This is heuristic and won't be perfect, but works reasonably for German poetry.
    """
    # Prefer pyphen hyphenation-based syllable counting when available
    if not line or not line.strip():
        return 0
    if USE_PYPHEN and pyphen is not None:
        try:
            s = line.strip()
            # remove punctuation that could interfere with hyphenation
            s = re.sub(r"[\"'“”‚`.,;:!?()\[\]{}<>–——]|—", ' ', s)
            words = [w for w in s.split() if w]
            total = 0
            for w in words:
                # pyphen returns hyphenated word like 'ge-hen', count parts
                hyp = pyphen.inserted(w)
                # if pyphen couldn't hyphenate, fallback to simple heuristic for the word
                if not hyp or hyp == w:
                    # fallback: count vowel groups
                    groups = re.findall(r"[aeiouy]+", w.lower())
                    cnt = len(groups) or 1
                else:
                    cnt = len([p for p in hyp.split('-') if p])
                total += max(1, cnt)
            return max(0, total)
        except Exception:
            # Fallthrough to heuristic
            pass

    # Heuristic fallback (previous implementation)
    s = line.lower()
    s = s.replace('ß', 'ss')
    # keep umlauts as vowels for counting
    s = s.replace('ä', 'a').replace('ö', 'o').replace('ü', 'u')
    # remove punctuation
    s = re.sub(r"[^a-z0-9\s]", ' ', s)
    words = s.split()
    total = 0
    for w in words:
        # count vowel groups
        groups = re.findall(r"[aeiouy]+", w)
        cnt = len(groups)
        # heuristic corrections
        if cnt == 0:
            cnt = 1
        total += cnt
    # final lower bound
    return max(0, total)


def similarity(a: str, b: str) -> float:
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    dist = levenshtein(a, b)
    maxlen = max(len(a), len(b))
    return 1.0 - dist / maxlen


def inspect_stanzas(lines: List[str]) -> List[Tuple[int, List[Tuple[int, str]]]]:
    """
    Build stanzas but keep original line indices so we can reference back to the full text.
    Returns list of (stanza_index, [ (orig_line_index, line_text), ... ])
    Headings (lines starting with '#') are skipped from stanza bodies but their lines remain in the full text.
    """
    stanzas = []
    cur: List[Tuple[int, str]] = []
    for idx, ln in enumerate(lines):
        s = ln.rstrip()
        if s.strip() == "":
            if cur:
                stanzas.append((len(stanzas) + 1, cur))
                cur = []
        else:
            # skip headings (we keep content-only lines in stanza bodies)
            if s.strip().startswith("#"):
                continue
            cur.append((idx, s))
    if cur:
        stanzas.append((len(stanzas) + 1, cur))
    return stanzas


def extract_first_chapter(lines: List[str]) -> List[str]:
    # Extrahiere die erste H2-Sektion (erste Zeile, die mit '## ' beginnt, bis zur nächsten H2 oder EOF)
    in_chapter = False
    out: List[str] = []
    for ln in lines:
        stripped = ln.strip()
        if stripped.startswith("## "):
            if in_chapter:
                # bereits im ersten Kapitel und begegnet neuer H2 -> Ende
                break
            else:
                in_chapter = True
                continue
        if in_chapter:
            out.append(ln)
    return out


def check_couplets(stanza_lines: List[Tuple[int, str]], stanza_index: int) -> List[dict]:
    reports: List[dict] = []
    # Wir vergleichen aufeinanderfolgende Zeilen als Paar (0/1, 2/3,...)
    for i in range(0, len(stanza_lines) - 1, 2):
        idx_a, a = stanza_lines[i]
        idx_b, b = stanza_lines[i + 1]
        wa = last_word(a)
        wb = last_word(b)
        pa = rhyme_part(wa)
        pb = rhyme_part(wb)
        sim = similarity(pa, pb)
        good = False
        # Regeln für 'gute' Reime (heuristisch):
        if pa and pb and pa == pb:
            good = True
        elif sim >= 0.7:
            good = True
        elif len(pa) <= 3 and len(pb) <= 3 and pa[-2:] == pb[-2:]:
            good = True

        if not good:
            reports.append({
                "stanza": stanza_index,
                "line_a_index": idx_a,
                "line_b_index": idx_b,
                "A": a,
                "B": b,
                "wordA": wa,
                "wordB": wb,
                "partA": pa,
                "partB": pb,
                "sim": sim,
            })
    return reports


def main(md_path: Path) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--first-chapter", action="store_true", help="Nur das erste Kapitel (erste '##' Sektion) prüfen")
    parser.add_argument("--max-similarity", type=float, default=0.7, help="Maximale Ähnlichkeit: nur Paare mit similarity < Wert werden ausgegeben (0-1)")
    parser.add_argument("--output-html", type=str, default=None, help="Optional: Pfad zur HTML-Datei, die alle Paare unter der Schwelle markiert")
    parser.add_argument("--highlight-full", action="store_true", help="Wenn gesetzt: schreibe den gesamten Text als HTML und hebe die schlechten Reimzeilen hervor")
    args, _ = parser.parse_known_args()

    if not md_path.exists():
        print(f"Datei nicht gefunden: {md_path}")
        return 2
    txt = md_path.read_text(encoding="utf-8")
    lines = txt.splitlines()
    if args.first_chapter:
        lines = extract_first_chapter(lines)
    stanzas = inspect_stanzas(lines)
    all_reports: List[dict] = []
    for idx, stanza in stanzas:
        rpt = check_couplets(stanza, idx)
        # filter by similarity threshold from args
        if args.max_similarity is not None:
            for r in rpt:
                if r["sim"] < args.max_similarity:
                    all_reports.append(r)
        else:
            all_reports.extend(rpt)

    if not all_reports:
        print("Keine eindeutig schlechten Reime gefunden (heuristische Prüfung).")
        return 0

    print("Schwach reimende Couplets (heuristisch erkannt):\n")
    for r in all_reports:
        print(f"Strophe {r['stanza']}, Zeilen {r['line_a_index']+1} & {r['line_b_index']+1}:")
        print(f"  A: {r['A']}")
        print(f"  B: {r['B']}")
        print(f"  Wort A: '{r['wordA']}' -> '{r['partA']}'")
        print(f"  Wort B: '{r['wordB']}' -> '{r['partB']}'")
        print(f"  Ähnlichkeit: {r['sim']:.2f}\n---")

    # HTML-Ausgabe
    if args.output_html:
        out_path = Path(args.output_html)
        if args.highlight_full:
            # komplette Datei in HTML schreiben, schlechte Reimzeilen hervorheben
            txt_lines = txt.splitlines()
            bad_lines = set()
            for r in all_reports:
                bad_lines.add(r["line_a_index"])
                bad_lines.add(r["line_b_index"])

            html = [
                "<!doctype html>",
                "<html><head><meta charset=\"utf-8\"><title>Knabenheit - Hervorgehobene schlechte Reime</title>",
                    "<style>body{font-family:Segoe UI,Arial;line-height:1.45;padding:20px;display:flex;justify-content:center;background:#fff;color:#111} .container{max-width:900px;width:100%;margin:20px} .content{text-align:left;position:relative;z-index:1;color:#111} .bad{background:#ffd6d6;padding:2px 4px;border-radius:3px} pre{white-space:pre-wrap;font-family:inherit;text-align:left;color:#111} .meter-7{background:rgba(60,160,80,0.08);border-left:3px solid rgba(60,160,80,0.18);padding-left:6px} .meter-9{background:rgba(40,120,200,0.06);border-left:3px solid rgba(40,120,200,0.12);padding-left:6px}</style>",
                "</head><body>",
                "<div class=\"container\"><div class=\"content\">",
                f"<h1>Knabenheit — Hervorgehobene schlechte Reime (similarity < {args.max_similarity})</h1>",
                "<pre>",
            ]
            for i, line in enumerate(txt_lines):
                esc = line.replace('<', '&lt;').replace('>', '&gt;')
                syl = count_syllables(line)
                # class for meter
                cls = ''
                if syl == 7:
                    cls = 'meter-7'
                elif syl == 9:
                    cls = 'meter-9'
                # append syllable count visually at line end
                suffix = f" <span style=\"color:#666;font-size:0.9em;margin-left:8px\">— {syl}</span>"
                line_html = f"{esc}{suffix}"
                if cls:
                    line_html = f"<span class=\"{cls}\">{line_html}</span>"
                if i in bad_lines:
                    html.append(f"<span class=\"bad\">{line_html}</span>")
                else:
                    html.append(line_html)
            html.append("</pre>")
            # summary of pairs below
            html.append("<h2>Gefundene schwache Paare</h2>")
            for r in all_reports:
                html.append('<div style=\"margin:6px 0;padding:6px;border:1px solid #eee\">')
                html.append(f"<div style=\"color:#555;\">Strophe {r['stanza']} — Ähnlichkeit: {r['sim']:.2f}</div>")
                html.append(f"<div><strong>A:</strong> {r['A']}</div>")
                html.append(f"<div><strong>B:</strong> {r['B']}</div>")
                html.append('</div>')

            # Canvas-based minimap: draw line pixels and red markers for bad lines
            total_lines = len(txt_lines)
            bad_list = sorted(bad_lines)
            html.append('<div class="minimap" style="position:fixed;right:18px;top:18px;width:120px;height:260px;background:rgba(255,255,255,0.95);border:1px solid #ddd;border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,0.08);z-index:9999;padding:6px;">')
            html.append('<canvas id="minimapCanvas" width="108" height="240" style="width:100%;height:100%;display:block"></canvas>')
            html.append('</div>')
            # close content/container
            html.append('</div></div>')
            # JS to paint canvas
            html.append('<script>')
            html.append('const totalLines=' + str(total_lines) + ';')
            html.append('const badLines=' + str(bad_list) + ';')
            html.append('const canvas=document.getElementById("minimapCanvas");')
            html.append('const ctx=canvas.getContext("2d");')
            html.append('function drawMinimap(){')
            html.append('  const w=canvas.width, h=canvas.height;')
            html.append('  ctx.clearRect(0,0,w,h);')
            html.append('  // background gradient')
            html.append('  ctx.fillStyle="#f7f7f7"; ctx.fillRect(0,0,w,h);')
            html.append('  // draw faint line pixels')
            html.append('  for(let i=0;i<totalLines;i++){')
            html.append('    const y=Math.floor((i/totalLines)*h);')
            html.append('    ctx.fillStyle="#ddd"; ctx.fillRect(Math.floor(w*0.2), y, Math.ceil(w*0.6), 1);')
            html.append('  }')
            html.append('  // draw bad lines')
            html.append('  ctx.fillStyle="#ff5b5b";')
            html.append('  badLines.forEach(function(i){ const y=Math.floor((i/totalLines)*h); ctx.fillRect(2,y,Math.max(2,Math.ceil(w*0.7)),2); });')
            html.append('}')
            # updateViewportBox: draw semi-transparent viewport rect onto canvas
            html.append('function updateViewportBox(){')
            html.append('  const rect=canvas.getBoundingClientRect();')
            html.append('  const w=canvas.width, h=canvas.height;')
            html.append('  const docH=document.body.scrollHeight-window.innerHeight;')
            html.append('  const topRatio=window.scrollY/Math.max(1,docH);')
            html.append('  const heightRatio=window.innerHeight/Math.max(1,document.body.scrollHeight);')
            html.append('  drawMinimap();')
            html.append('  // draw semi-transparent viewport overlay')
            html.append('  const yTop=Math.floor(topRatio*h); const boxH=Math.max(6,Math.floor(heightRatio*h));')
            html.append('  ctx.fillStyle = "rgba(30,120,220,0.12)"; ctx.fillRect(1, yTop, w-2, boxH);')
            html.append('  ctx.strokeStyle = "rgba(30,120,220,0.35)"; ctx.lineWidth = 1; ctx.strokeRect(1, yTop, w-2, boxH);')
            html.append('}')
            # click to jump
            html.append('canvas.addEventListener("click",function(e){ const rect=canvas.getBoundingClientRect(); const y=e.clientY-rect.top; const ratio=y/rect.height; const line=Math.floor(ratio*totalLines); const els=document.getElementById("line-"+line); if(els){ els.scrollIntoView({behavior:"smooth",block:"center"}); } else { window.scrollTo({top:Math.floor((line/totalLines)*(document.body.scrollHeight-window.innerHeight)), behavior:"smooth"}); } });')
            # drag-to-scroll (mouse)
            html.append('let dragging=false; let dragStartY=0; let startScrollY=0;')
            html.append('canvas.addEventListener("mousedown", function(e){ dragging=true; dragStartY = e.clientY; startScrollY = window.scrollY; e.preventDefault(); });')
            html.append('window.addEventListener("mouseup", function(){ dragging=false; });')
            html.append('canvas.addEventListener("mousemove", function(e){ if(!dragging) return; const dy = e.clientY - dragStartY; const rect = canvas.getBoundingClientRect(); const h = rect.height; const docH = document.body.scrollHeight - window.innerHeight; const ratio = dy / h; window.scrollTo({ top: Math.max(0, Math.min(docH, startScrollY + Math.floor(ratio * document.body.scrollHeight))), behavior: "auto" }); updateViewportBox(); });')
            # touch support
            html.append('canvas.addEventListener("touchstart", function(e){ if(e.touches && e.touches[0]){ dragging=true; dragStartY = e.touches[0].clientY; startScrollY = window.scrollY; } }, {passive:false});')
            html.append('canvas.addEventListener("touchmove", function(e){ if(!dragging) return; if(e.touches && e.touches[0]){ const dy = e.touches[0].clientY - dragStartY; const rect = canvas.getBoundingClientRect(); const h = rect.height; const docH = document.body.scrollHeight - window.innerHeight; const ratio = dy / h; window.scrollTo({ top: Math.max(0, Math.min(docH, startScrollY + Math.floor(ratio * document.body.scrollHeight))), behavior: "auto" }); updateViewportBox(); } e.preventDefault(); }, {passive:false});')
            html.append('canvas.addEventListener("touchend", function(e){ dragging=false; }, {passive:true});')
            html.append('window.addEventListener("scroll",updateViewportBox); window.addEventListener("resize",updateViewportBox);')
            html.append('drawMinimap(); updateViewportBox();')
            html.append('</script>')
            html.append('</body></html>')
            out_path.write_text("\n".join(html), encoding="utf-8")
            print(f"HTML-Datei geschrieben (voller Text mit Hervorhebung): {out_path}")
        else:
            # gleiche Darstellung wie vorher, aber mit strukturierten Daten
            html = [
                "<!doctype html>",
                "<html><head><meta charset=\"utf-8\"><title>Schwache Reime</title>",
                    "<style>body{font-family:Segoe UI,Arial;line-height:1.4;padding:20px;display:flex;justify-content:center} .container{max-width:900px;width:100%;margin:20px} .content{text-align:left} .pair{border:1px solid #ddd;padding:10px;margin:8px 0;border-radius:6px} .bad{background:#ffd6d6} .meta{color:#555;font-size:0.9em}</style>",
                "</head><body>",
                f"<h1>Schwach reimende Couplets (similarity < {args.max_similarity})</h1>",
            ]
            for r in all_reports:
                html.append('<div class="pair bad">')
                html.append(f"<div class=\"meta\">Strophe {r['stanza']} (Zeilen {r['line_a_index']+1} & {r['line_b_index']+1}) — Ähnlichkeit: {r['sim']:.2f}</div>")
                html.append(f"<div><strong>A:</strong> {r['A']}</div>")
                html.append(f"<div><strong>B:</strong> {r['B']}</div>")
                html.append(f"<div class=\"meta\"><strong>Wort A:</strong> {r['wordA']} &nbsp; <strong>Wort B:</strong> {r['wordB']}</div>")
                html.append("</div>")
            html.append("</body></html>")
            out_path.write_text("\n".join(html), encoding="utf-8")
            print(f"HTML-Datei geschrieben: {out_path}")
    return 0


if __name__ == "__main__":
    base = Path(__file__).parent
    target = base / "poetic-novels" / "knabenheit.md"
    sys.exit(main(target))
