#!/usr/bin/env python3
"""
Renders the stuartsingleton.com homepage terminal boot as a 1200x630 motion
share card. Frame 0 is the FINISHED card (so platforms that only read the first
frame -- Facebook, LinkedIn, X, Google -- still get a complete, designed image),
then it reboots and rebuilds on loop.
"""
import math, os, random
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "fonts")
OUT = os.path.join(HERE, "frames")
os.makedirs(OUT, exist_ok=True)

W, H = 1200, 630
BG = (5, 5, 5)
FPS = 15
DUR = 5.2                      # seconds, full loop
NF = int(round(DUR * FPS))

MONO = os.path.join(FONTS, "ShareTechMono.ttf")
DISP = os.path.join(FONTS, "BebasNeue.ttf")

f_term  = ImageFont.truetype(MONO, 17)
f_label = ImageFont.truetype(MONO, 13)
f_btn   = ImageFont.truetype(MONO, 14)
f_links = ImageFont.truetype(MONO, 13)

# ---------- helpers ----------------------------------------------------------
def tw(draw, text, font, track=0.0):
    """width of text with letter tracking"""
    if not text:
        return 0
    w = 0
    for ch in text:
        w += draw.textlength(ch, font=font) + track
    return w - track

def tracked(draw, xy, text, font, fill, track=0.0, alpha=1.0):
    """draw text char-by-char so we can emulate CSS letter-spacing"""
    if alpha <= 0.003 or not text:
        return
    x, y = xy
    col = tuple(int(round(c * alpha + BG[i] * (1 - alpha))) for i, c in enumerate(fill))
    for ch in text:
        draw.text((x, y), ch, font=font, fill=col)
        x += draw.textlength(ch, font=font) + track

def ease_out(t):                       # cubic-bezier(.16,1,.3,1)-ish
    return 1 - pow(1 - max(0.0, min(1.0, t)), 3)

def seg(t, start, dur):
    """0..1 progress of a segment, clamped"""
    if dur <= 0:
        return 1.0 if t >= start else 0.0
    return max(0.0, min(1.0, (t - start) / dur))

# ---------- geometry ---------------------------------------------------------
_probe = ImageDraw.Draw(Image.new("RGB", (10, 10)))

# scale the wordmark so SINGLETON lands at ~590px wide, like the real hero
NAME_TARGET = 460
_ts = 100
_f = ImageFont.truetype(DISP, _ts)
_w = tw(_probe, "SINGLETON", _f, 1.5)
NAME_SIZE = int(_ts * NAME_TARGET / _w)
f_name = ImageFont.truetype(DISP, NAME_SIZE)
NAME_TRACK = NAME_SIZE * 0.015
NAME_W = tw(_probe, "SINGLETON", f_name, NAME_TRACK)
LINE_H = int(NAME_SIZE * 0.87)

X0 = 100
TERM_LH = 28

TERM_LINES = [
    # (segments[(text, colour)], delay)
    ([("~/", (85, 85, 85)), ("portfolio", (85, 85, 85)), (" $ ", (51, 51, 51)),
      ("whoami", (138, 138, 138))], 0.00),
    ([("initializing...", (85, 85, 85))], 0.62),
    ([("songwriter · producer · builder", (138, 138, 138))], 0.86),
    ([("location: nashville, tn", (85, 85, 85))], 1.10),
    ([("> rendering identity...", (51, 51, 51))], 1.34),
]
LINE1_CHARS = sum(len(s[0]) for s in TERM_LINES[0][0])
TYPE_DUR = 0.58

T_NAME   = 1.52          # wordmark wipe starts
NAME_DUR = 0.85
T_LABEL  = 2.52
T_BTNS   = 2.76
T_LINKS  = 3.06
T_SETTLE = 3.40          # everything is on screen by here

# the "reboot" cut: frame 0 shows the finished card, holds, then restarts
HOLD = 1.30              # seconds of finished card at the top of the loop
BOOT_LEN = DUR - HOLD    # time available for the boot sequence

BTN_H = 46
BTNS = [("01 /", "music"), ("02 /", "photos"), ("03 /", "code")]

# vertical stack
TERM_TOP = 56
NAME_TOP = TERM_TOP + len(TERM_LINES) * TERM_LH + 18
LABEL_TOP = NAME_TOP + LINE_H * 2 + 44
BTN_TOP = LABEL_TOP + 26
DOMAIN_Y = BTN_TOP + BTN_H - 18

# ---------- background: particles + code sphere (both loop seamlessly) -------
random.seed(137)
PARTS = []
for _ in range(46):
    PARTS.append(dict(
        x=random.uniform(0, W), y=random.uniform(0, H),
        ax=random.uniform(14, 52), ay=random.uniform(10, 40),
        px=random.uniform(0, math.tau), py=random.uniform(0, math.tau),
        r=random.choice([1, 1, 1, 2]),
        a=random.uniform(0.05, 0.20),
    ))

SPH = []
N = 90
for i in range(N):                      # fibonacci sphere
    yy = 1 - (i / (N - 1)) * 2
    rad = math.sqrt(max(0.0, 1 - yy * yy))
    th = math.pi * (3 - math.sqrt(5)) * i
    SPH.append((math.cos(th) * rad, yy, math.sin(th) * rad))

SPH_CX, SPH_CY, SPH_R = 1082, 96, 44


def draw_bg(d, t, phase):
    """phase: 0..1 global visibility (background is always on)"""
    u = t / DUR
    for p in PARTS:
        x = (p["x"] + math.sin(math.tau * u + p["px"]) * p["ax"]) % W
        y = (p["y"] + math.cos(math.tau * u + p["py"]) * p["ay"]) % H
        v = int(round(255 * p["a"] * phase))
        if v <= 2:
            continue
        if X0 - 12 < x < X0 + 540 and TERM_TOP - 8 < y < TERM_TOP + len(TERM_LINES) * TERM_LH + 4:
            continue
        c = (v, v, v)
        r = p["r"]
        d.ellipse([x - r, y - r, x + r, y + r], fill=c)


def draw_sphere(d, t, alpha):
    if alpha <= 0.01:
        return
    ang = math.tau * (t / DUR)
    tilt = 0.42
    for (sx, sy, sz) in SPH:
        # rotate around Y
        rx = sx * math.cos(ang) - sz * math.sin(ang)
        rz = sx * math.sin(ang) + sz * math.cos(ang)
        ry = sy * math.cos(tilt) - rz * math.sin(tilt)
        rz = sy * math.sin(tilt) + rz * math.cos(tilt)
        depth = (rz + 1) / 2                     # 0 back .. 1 front
        px = SPH_CX + rx * SPH_R
        py = SPH_CY + ry * SPH_R
        v = int(round((40 + 165 * depth) * alpha))
        if v <= 3:
            continue
        r = 1 if depth < 0.55 else 1.6
        d.ellipse([px - r, py - r, px + r, py + r], fill=(v, v, v))


# ---------- foreground -------------------------------------------------------
def draw_terminal(d, t, typed_only):
    """typed_only=True  -> line 1 types out, others fade in on their delays
       typed_only=False -> everything fully drawn"""
    y = TERM_TOP
    for idx, (segs, delay) in enumerate(TERM_LINES):
        if typed_only:
            if idx == 0:
                n = int(round(LINE1_CHARS * seg(t, 0.0, TYPE_DUR)))
                x = X0
                left = n
                for text, col in segs:
                    if left <= 0:
                        break
                    chunk = text[:left]
                    tracked(d, (x, y), chunk, f_term, col, 0.85, 1.0)
                    x += tw(d, chunk, f_term, 0.85) + 0.85
                    left -= len(chunk)
                # caret
                if seg(t, 0.0, TYPE_DUR) < 1.0:
                    d.rectangle([x, y + 3, x + 7, y + 16], fill=(255, 255, 255))
            else:
                a = seg(t, delay, 0.26)
                if a > 0:
                    x = X0
                    for text, col in segs:
                        tracked(d, (x, y), text, f_term, col, 0.85, a)
                        x += tw(d, text, f_term, 0.85) + 0.85
        else:
            x = X0
            for text, col in segs:
                tracked(d, (x, y), text, f_term, col, 0.85, 1.0)
                x += tw(d, text, f_term, 0.85) + 0.85
        y += TERM_LH


def draw_name(img, d, reveal):
    """reveal 0..1 -> clip-path inset(0 100% 0 0) wipe, left to right"""
    if reveal <= 0.001:
        return
    layer = Image.new("RGB", (W, H), BG)
    ld = ImageDraw.Draw(layer)
    tracked(ld, (X0, NAME_TOP), "STUART", f_name, (255, 255, 255), NAME_TRACK, 1.0)
    tracked(ld, (X0, NAME_TOP + LINE_H), "SINGLETON", f_name, (255, 255, 255), NAME_TRACK, 1.0)
    cut = int(X0 + NAME_W * reveal) + 2
    box = (X0 - 4, NAME_TOP - 12, min(W, cut), NAME_TOP + LINE_H * 2 + 30)
    img.paste(layer.crop(box), (box[0], box[1]))


def draw_label(d, alpha, blink_on):
    if alpha <= 0.01:
        return
    txt = ">  SELECT_ENVIRONMENT —"
    tracked(d, (X0, LABEL_TOP), txt, f_label, (85, 85, 85), 1.8, alpha)
    if blink_on:
        x = X0 + tw(d, txt, f_label, 1.8) + 8
        v = int(round(255 * alpha))
        d.rectangle([x, LABEL_TOP + 1, x + 7, LABEL_TOP + 13], fill=(v, v, v))


def draw_buttons(d, t, full):
    total = NAME_W
    bw = total / 3
    for i, (prefix, word) in enumerate(BTNS):
        a = 1.0 if full else seg(t, T_BTNS + i * 0.08, 0.32)
        if a <= 0.01:
            continue
        x = X0 + i * bw
        bcol = tuple(int(round(34 * a + 5 * (1 - a))) for _ in range(3))
        d.rectangle([x, BTN_TOP, x + bw, BTN_TOP + BTN_H], outline=bcol, width=1)
        tx = x + 24
        ty = BTN_TOP + (BTN_H - 14) / 2 - 2
        tracked(d, (tx, ty), prefix, f_btn, (85, 85, 85), 2.0, a)
        tx += tw(d, prefix, f_btn, 2.0) + 9
        tracked(d, (tx, ty), word.upper(), f_btn, (153, 153, 153), 2.0, a)


def draw_domain(d, alpha):
    if alpha <= 0.01:
        return
    txt = "stuartsingleton.com"
    w = tw(d, txt, f_links, 2.2)
    tracked(d, (W - 100 - w, DOMAIN_Y), txt, f_links, (78, 78, 78), 2.2, alpha)


# ---------- frame loop -------------------------------------------------------
def render_frame(i):
    t = i / FPS
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    in_hold = t < HOLD
    bt = 0.0 if in_hold else (t - HOLD)      # boot-sequence clock

    draw_bg(d, t, 1.0)

    if in_hold:
        draw_sphere(d, t, 1.0)
        draw_terminal(d, 99, False)
        draw_name(img, d, 1.0)
        draw_label(d, 1.0, True)
        draw_buttons(d, 99, True)
        draw_domain(d, 1.0)
    else:
        draw_sphere(d, t, min(1.0, seg(bt, 2.30, 1.10)))
        draw_terminal(d, bt, True)
        draw_name(img, d, ease_out(seg(bt, T_NAME, NAME_DUR)))
        draw_label(d, seg(bt, T_LABEL, 0.40), True)
        draw_buttons(d, bt, False)
        draw_domain(d, seg(bt, T_LINKS, 0.45))

    return img


if __name__ == "__main__":
    for i in range(NF):
        render_frame(i).save(os.path.join(OUT, f"f{i:03d}.png"))
    # poster = the finished card
    render_frame(0).save(os.path.join(HERE, "poster.png"))
    print(f"rendered {NF} frames @ {FPS}fps ({DUR}s), name size {NAME_SIZE}px, width {NAME_W:.0f}px")
