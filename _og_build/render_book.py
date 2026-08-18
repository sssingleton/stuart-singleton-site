#!/usr/bin/env python3
"""
Renders /og-book.jpg, the share card for stuartsingleton.com/book.

Type only, no photograph. Two reasons, both deliberate:

  1. This card unfurls directly beneath a Facebook post that is already a carousel
     of portraits. Repeating a portrait inside the card competes with the post
     instead of completing it. The card's job down there is to look like a door.
  2. Decision 241 says client photographs may be used promotionally only where the
     subject signed a likeness release. A type card needs no release and cannot
     rot into a rights problem later.

NO PRICES ON THIS CARD. It renders in the feed, and Decision 259 keeps figures out
of the feed so nobody decides before they have looked at the work. "ON SALE NOW"
carries the urgency without carrying the judgement.

Family: matches og-home-v2.jpg (Bebas wordmark, #050505, drifting particle field)
rather than og-gallery.jpg / og-shop.jpg, because those two are photo cards and set
their name in Cormorant Garamond, which is not vendored here.

    cd _og_build && python3 render_book.py

Ships as og-book.jpg. Per README, NEVER overwrite a live card to change a design:
unfurl caches key on URL, so a redesign ships as og-book-v2.jpg and the tags in
og/book.html move with it.
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "fonts")
OUT = os.path.abspath(os.path.join(HERE, "..", "og-book.jpg"))

W, H = 1200, 630
BG = (5, 5, 5)

MONO = os.path.join(FONTS, "ShareTechMono.ttf")
DISP = os.path.join(FONTS, "BebasNeue.ttf")

# palette. the paper tokens off #photos-page.book-on, read from index.html and
# inverted for the dark card rather than eyeballed.
INK = (255, 255, 255)
EYEBROW = (154, 148, 138)      # .photos-eyebrow #9a948a, used as-is
SUB = (138, 133, 124)          # .photos-sub     #8a857c
RULE = (48, 48, 48)
TAG_TXT = (179, 174, 163)      # .svc-tag        #b3aea3
TAG_BRD = (58, 56, 53)         # .svc-tag border #d8d5cd, inverted for dark
FOOT = (78, 78, 78)

X0 = 100

f_eyebrow = ImageFont.truetype(MONO, 13)
f_sub = ImageFont.truetype(MONO, 15)
f_tag = ImageFont.truetype(MONO, 12)
f_foot = ImageFont.truetype(MONO, 13)


def tw(draw, text, font, track=0.0):
    if not text:
        return 0
    w = 0
    for ch in text:
        w += draw.textlength(ch, font=font) + track
    return w - track


def tracked(draw, xy, text, font, fill, track=0.0):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + track


# scale the wordmark so SINGLETON lands at 460px, identical to og-home-v2
_probe = ImageDraw.Draw(Image.new("RGB", (10, 10)))
NAME_TARGET = 460
_ts = 100
_f = ImageFont.truetype(DISP, _ts)
NAME_SIZE = int(_ts * NAME_TARGET / tw(_probe, "SINGLETON", _f, 1.5))
f_name = ImageFont.truetype(DISP, NAME_SIZE)
NAME_TRACK = NAME_SIZE * 0.015
NAME_W = tw(_probe, "SINGLETON", f_name, NAME_TRACK)
LINE_H = int(NAME_SIZE * 0.87)

# ---- vertical stack ---------------------------------------------------------
# the tag row and the footer were 15px apart in the first render, which reads as a
# collision rather than as two elements. everything below the wordmark moved up and
# the footer moved down, so the card now breathes at the bottom edge.
RULE_Y = 88
EYEBROW_Y = RULE_Y + 20
NAME_TOP = EYEBROW_Y + 44
HAIR_Y = NAME_TOP + LINE_H * 2 + 30
SUB_Y = HAIR_Y + 24
TAG_Y = SUB_Y + 40
FOOT_Y = 552

# ---- tags: the /book row, one filled among outlined (the svc-tag-lead
# mechanism, so the card gets emphasis without inventing an accent colour) ----
TAGS = [
    ("ON SALE NOW", True),
    ("FREE 15 MIN CALL", False),
    ("12+ IMAGES", False),
    ("SEVEN DAYS", False),
]
TAG_PAD_X, TAG_PAD_Y, TAG_GAP, TAG_TRACK = 11, 7, 8, 1.2


def draw_particles(d):
    """the og-home-v2 field, same seed, so the two cards feel like one set"""
    random.seed(137)
    for _ in range(46):
        x = random.uniform(0, W)
        y = random.uniform(0, H)
        r = random.choice([1, 1, 1, 2])
        a = random.uniform(0.05, 0.20)
        # keep the type area clean
        if X0 - 20 < x < X0 + NAME_W + 40 and RULE_Y - 20 < y < TAG_Y + 60:
            continue
        v = int(round(255 * a))
        if v <= 2:
            continue
        d.ellipse([x - r, y - r, x + r, y + r], fill=(v, v, v))


def render():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    draw_particles(d)

    # short rule above the eyebrow, the gallery/shop card's opening move
    d.rectangle([X0, RULE_Y, X0 + 72, RULE_Y + 1], fill=(108, 104, 97))

    tracked(d, (X0, EYEBROW_Y), "BOOK A SHOOT", f_eyebrow, EYEBROW, 3.4)

    tracked(d, (X0, NAME_TOP), "STUART", f_name, INK, NAME_TRACK)
    tracked(d, (X0, NAME_TOP + LINE_H), "SINGLETON", f_name, INK, NAME_TRACK)

    d.rectangle([X0, HAIR_Y, X0 + 300, HAIR_Y + 1], fill=RULE)

    # no dashes. rules.md:41 applies to every surface, baked pixels included.
    # one line, not two: "Nashville." alone on line 2 read as an orphan.
    sub = "Portraits, headshots and band press photos. Nashville."
    assert tw(d, sub, f_sub, 0.7) < W - X0 * 2, "sub line overruns the margins"
    tracked(d, (X0, SUB_Y), sub, f_sub, SUB, 0.7)

    x = X0
    for label, lead in TAGS:
        w = tw(d, label, f_tag, TAG_TRACK)
        box = [x, TAG_Y, x + w + TAG_PAD_X * 2, TAG_Y + 14 + TAG_PAD_Y * 2]
        if lead:
            d.rectangle(box, fill=INK)
            tracked(d, (x + TAG_PAD_X, TAG_Y + TAG_PAD_Y - 1), label, f_tag,
                    BG, TAG_TRACK)
        else:
            d.rectangle(box, outline=TAG_BRD, width=1)
            tracked(d, (x + TAG_PAD_X, TAG_Y + TAG_PAD_Y - 1), label, f_tag,
                    TAG_TXT, TAG_TRACK)
        x = box[2] + TAG_GAP

    tracked(d, (X0, FOOT_Y), "STUARTSINGLETON.COM", f_foot, FOOT, 3.0)

    right = "/BOOK"
    tracked(d, (W - X0 - tw(d, right, f_foot, 3.0), FOOT_Y), right, f_foot,
            FOOT, 3.0)

    return img


if __name__ == "__main__":
    im = render()
    im.save(OUT, "JPEG", quality=90, optimize=True, progressive=True)
    print(f"wrote {OUT}  {im.size[0]}x{im.size[1]}  "
          f"{os.path.getsize(OUT) / 1024:.0f} KB  (name {NAME_SIZE}px / {NAME_W:.0f}px wide)")
