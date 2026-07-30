# Motion share card generator

Builds the animated homepage share card (`/og-home-v2.gif`, `.mp4`, `.jpg`) by
recreating the landing-page terminal boot at 1200x630.

```
cd _og_build
python3 render.py                       # -> frames/ + poster.png
ffmpeg -y -framerate 15 -i frames/f%03d.png \
  -c:v libx264 -pix_fmt yuv420p -crf 20 -preset slow -movflags +faststart \
  ../og-home-v2.mp4
ffmpeg -y -framerate 15 -i frames/f%03d.png \
  -vf "fps=12,split[a][b];[a]palettegen=max_colors=48:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" \
  -loop 0 ../og-home-v2.gif
python3 -c "from PIL import Image; Image.open('poster.png').convert('RGB').save('../og-home-v2.jpg','JPEG',quality=90,optimize=True,progressive=True)"
```

Two things that are load-bearing, do not "simplify" them away:

1. **Frame 0 is the FINISHED card, not an empty terminal.** LinkedIn, Facebook,
   X and Google only ever read one frame. The loop is therefore: finished card
   (1.3s hold) -> reboot -> rebuild -> finished card.
2. **Ship under a NEW filename when the design changes** (`-v3`, etc.) and update
   the tags in `index.html` + `og/whoami.html`. Unfurl caches key on URL; reusing
   a filename means iMessage and Slack keep serving the old card for weeks.

Fonts are vendored (Share Tech Mono, Bebas Neue — the real site faces, SIL OFL).
