"""
Turns the raw generated artwork into the one master the app uses.

Run with: .qr-venv/bin/python3 scripts/build-mark.py

The source is a white silhouette painted on an opaque black square, with a
generator watermark in the corner. Three things have to happen before it is
usable as an icon:

  1. The watermark goes. It sits in the bottom-right corner and would
     otherwise survive into every icon size.

  2. The black ground becomes transparent, via alpha = luminance rather than a
     colour-key. That matters because the black is not only *around* the
     figure — the "BODY HOLIC" lettering and the muscle definition lines are
     black knocked out of the white torso. Keying only the outside would leave
     an opaque black slab behind the letters; taking alpha from luminance
     turns every black pixel transparent at once, so the lettering reads as a
     true cut-out on whatever it is placed over, and the anti-aliased edges
     keep their soft falloff instead of going jagged.

  3. Every pixel's colour is forced to white, so the mark can be laid over any
     background, or tinted, without dragging a grey halo with it.

The output is committed. This only needs re-running if the artwork changes.
"""

from PIL import Image
import numpy as np
import pathlib

SRC = pathlib.Path("design/source/bodyholic-logo-raw.png")
OUT_DESIGN = pathlib.Path("design/bodyholic-mark.png")
OUT_PUBLIC = pathlib.Path("public/brand/bodyholic-mark.png")

# The watermark, measured off the source rather than guessed, plus a margin.
WATERMARK = (1982, 1568, 2077, 1663)
MARGIN = 24

# Breathing room around the trimmed figure, as a fraction of its longest side.
PAD = 0.04

img = Image.open(SRC).convert("RGB")
rgb = np.asarray(img).astype(np.uint8)

# Luminance is the whole signal here: the art is greyscale.
lum = rgb.max(axis=2).astype(np.uint8)

# 1. Erase the watermark.
x0, y0, x1, y1 = WATERMARK
lum[max(0, y0 - MARGIN):y1 + MARGIN, max(0, x0 - MARGIN):x1 + MARGIN] = 0

# 2. Trim to what is left. The threshold ignores the near-black ground, which
#    is (1,2,4) rather than a true zero.
ys, xs = np.nonzero(lum > 60)
left, right = int(xs.min()), int(xs.max())
top, bottom = int(ys.min()), int(ys.max())

pad = int(max(right - left, bottom - top) * PAD)
left, top = max(0, left - pad), max(0, top - pad)
right = min(lum.shape[1] - 1, right + pad)
bottom = min(lum.shape[0] - 1, bottom + pad)

alpha = lum[top:bottom + 1, left:right + 1]

# 3. Pure white, with the shape carried entirely by the alpha channel.
h, w = alpha.shape
out = np.zeros((h, w, 4), dtype=np.uint8)
out[..., :3] = 255
out[..., 3] = alpha

mark = Image.fromarray(out, mode="RGBA")

# The master keeps full resolution; the icon generator resamples from it.
OUT_DESIGN.parent.mkdir(parents=True, exist_ok=True)
mark.save(OUT_DESIGN, optimize=True)

# The copy the browser downloads does not. The launch screen paints it about
# 340px wide, so 1000px is already past what any display can resolve, and the
# full-size master is a megabyte nobody needs on a phone connection.
#
# Saved as LA rather than RGBA: every colour channel holds the same 255, so
# three of the four are pure waste. next/image re-encodes this to AVIF or WebP
# on the way out, which is what the browser actually receives — this is the
# source it optimises from, not the payload.
web = mark.copy()
web.thumbnail((1000, 1000), Image.LANCZOS)
OUT_PUBLIC.parent.mkdir(parents=True, exist_ok=True)
web.convert("LA").save(OUT_PUBLIC, optimize=True)

print(f"source      {img.size[0]}x{img.size[1]}")
print(f"trimmed to  {w}x{h}  (crop {left},{top} -> {right},{bottom})")
print(f"opaque px   {int((alpha > 200).sum()):,}")
print(f"web copy    {web.size[0]}x{web.size[1]}")
print(f"written     {OUT_DESIGN}  {OUT_PUBLIC}")
