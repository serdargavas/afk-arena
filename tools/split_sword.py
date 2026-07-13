# Split knight.png into body / sword / hands-patch layers for real swing animation.
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

SRC = '/Users/serdargavas/Documents/afk-arena/public/art/knight.png'
OUT = '/Users/serdargavas/Documents/afk-arena/public/art'

im = Image.open(SRC).convert('RGBA')
W, H = im.size
arr = np.array(im).astype(np.float64)

# Sword: the full blade band (measured from per-column opaque runs), cut just left
# of the gold guard so the guard + fists stay with the body as the static grip.
SWORD_POLY = [
    (18, -6), (50, -3), (75, 2), (100, 8), (125, 16), (150, 25), (175, 36),
    (200, 48), (225, 59), (250, 70), (275, 83), (300, 105), (325, 111), (345, 118),
    (354, 145), (358, 205), (352, 268),  # cut line, left of the guard/fists
    (325, 260), (300, 252), (275, 222), (250, 205), (225, 190), (200, 176),
    (175, 161), (150, 147), (125, 130), (100, 112), (75, 94), (50, 74),
    (30, 50), (8, 30), (-6, 10),
]
# Guard + gauntlets: rendered as a static patch IN FRONT of the sword to hide the pivot seam.
HANDS_POLY = [(335, 95), (430, 88), (452, 150), (448, 225), (408, 258), (362, 235), (338, 160)]
PIVOT = (390, 195)  # grip center in source px


def poly_mask(poly, feather=1.5):
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    if feather:
        m = m.filter(ImageFilter.GaussianBlur(feather))
    return np.array(m).astype(np.float64) / 255.0


def box_blur(a, r):
    """Box blur via cumsum, axis-separable; a is 2D float."""
    for axis in (0, 1):
        c = np.cumsum(np.pad(a, [(r + 1, r) if ax == axis else (0, 0) for ax in (0, 1)], mode='edge'), axis=axis)
        if axis == 0:
            a = (c[2 * r + 1:, :] - c[:-(2 * r + 1), :]) / (2 * r + 1)
        else:
            a = (c[:, 2 * r + 1:] - c[:, :-(2 * r + 1)]) / (2 * r + 1)
    return a


sw = poly_mask(SWORD_POLY)
hp = poly_mask(HANDS_POLY)
alpha = arr[..., 3] / 255.0

# --- sword layer ---
sword = arr.copy()
sword[..., 3] *= sw
simg = Image.fromarray(np.clip(sword, 0, 255).astype(np.uint8))
bbox = simg.getbbox()
simg.crop(bbox).save(f'{OUT}/sword.png')
print('sword', simg.crop(bbox).size, 'bbox', bbox, 'pivot-in-crop', (PIVOT[0] - bbox[0], PIVOT[1] - bbox[1]))

# --- hands patch (copy, stays on the body pivot) ---
hands = arr.copy()
hands[..., 3] *= hp
himg = Image.fromarray(np.clip(hands, 0, 255).astype(np.uint8))
hb = himg.getbbox()
himg.crop(hb).save(f'{OUT}/hands.png')
print('hands', himg.crop(hb).size, 'bbox', hb)

# --- body: remove sword, inpaint the hole by pull-push diffusion of known pixels ---
hole = sw * (alpha > 0.02)  # only where the blade covered actual pixels
known = (1.0 - sw)  # weight of trustworthy pixels (incl. transparent ones)
premul = arr[..., :4].copy()
premul[..., :3] *= alpha[..., None]

fillC = np.zeros_like(premul)
fillW = np.zeros((H, W))
for r in (3, 6, 12, 24, 48, 96):
    wgt = box_blur(known, r)
    ch = np.stack([box_blur(premul[..., i] * known, r) for i in range(4)], axis=-1)
    take = (fillW < 1e-4) & (wgt > 1e-4)
    fillC[take] = ch[take] / wgt[take][..., None]
    fillW[take] = 1.0

body = arr.copy()
# un-premultiply the diffused color
fa = np.maximum(fillC[..., 3] / 255.0, 1e-4)
frgb = fillC[..., :3] / fa[..., None]
m = hole[..., None]
body[..., :3] = body[..., :3] * (1 - m) + np.clip(frgb, 0, 255) * m
body[..., 3] = body[..., 3] * (1 - hole) + fillC[..., 3] * hole
# outside the original silhouette the sword cut leaves pure transparency
body[..., 3] *= np.where(sw > 0.02, np.maximum(alpha > 0.02, 1 - sw), 1)

Image.fromarray(np.clip(body, 0, 255).astype(np.uint8)).save(f'{OUT}/knight-body.png')
print('body saved', (W, H))

# --- proof sheet: body | sword | hands side by side on dark bg ---
sheet = Image.new('RGB', (W * 2 + 20, H), (24, 18, 40))
b = Image.open(f'{OUT}/knight-body.png')
sheet.paste(b, (0, 0), b)
s2 = Image.open(f'{OUT}/sword.png')
sheet.paste(s2, (W + 20, 0), s2)
h2 = Image.open(f'{OUT}/hands.png')
sheet.paste(h2, (W + 20, H - h2.size[1]), h2)
sheet.save('layers.png')
print('proof sheet: layers.png')
