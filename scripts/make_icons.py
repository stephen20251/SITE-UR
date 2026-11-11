# Icônes du site à partir du logo officiel (public/logo-ur.jpg) :
# emblème « UR » seul, agrandi, centré sur un fond blanc carré (lisible en 16 à 48 px,
# y compris sur fond sombre dans Google).
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter

root = Path(sys.argv[1])
out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)

logo = Image.open(root / "public" / "logo-ur.jpg").convert("RGB")
W, H = logo.size

# Emblème seul : partie haute du logo (le texte « UNIVERSITY REFERENCE » commence vers 74 % de la hauteur)
top = logo.crop((0, 0, W, int(H * 0.72)))
# Pixels « encre » : nettement plus sombres ou plus colorés que le fond gris clair
gray = top.convert("L")
mask = gray.point(lambda v: 255 if v < 200 else 0)
bbox = mask.getbbox()
print("bbox emblème", bbox)
emb = top.crop(bbox)

# Fond : tout pixel très clair (fond et ombre douce) devient blanc pur
px = emb.load()
for y in range(emb.height):
    for x in range(emb.width):
        r, g, b = px[x, y]
        if min(r, g, b) > 205 and max(r, g, b) - min(r, g, b) < 18:
            px[x, y] = (255, 255, 255)

def square(size, pad_ratio):
    """Emblème centré dans un carré blanc ; pad_ratio = marge de chaque côté."""
    canvas = Image.new("RGB", (size, size), (255, 255, 255))
    inner = size * (1 - 2 * pad_ratio)
    scale = inner / max(emb.width, emb.height)
    w, h = max(1, round(emb.width * scale)), max(1, round(emb.height * scale))
    # Réduction progressive pour garder des traits nets en petite taille
    img = emb.resize((w * 4, h * 4), Image.LANCZOS).resize((w, h), Image.LANCZOS) if size < 64 else emb.resize((w, h), Image.LANCZOS)
    if size <= 48:
        img = img.filter(ImageFilter.UnsharpMask(radius=1, percent=80, threshold=2))
    canvas.paste(img, ((size - w) // 2, (size - h) // 2))
    return canvas

# Petites tailles : marge minimale pour que l'emblème soit le plus grand possible
sizes = {
    "favicon-48.png": (48, 0.04),
    "favicon-96.png": (96, 0.05),
    "favicon-144.png": (144, 0.06),
    "icon-192.png": (192, 0.08),
    "icon-512.png": (512, 0.08),
    "apple-touch-icon.png": (180, 0.10),
    # Icône « maskable » (Android) : zone de sécurité de 20 %
    "icon-512-maskable.png": (512, 0.20),
}
for name, (s, pad) in sizes.items():
    square(s, pad).save(out / name, optimize=True)
    print("écrit", name)

# favicon.ico : 16, 32 et 48 px
ico = square(256, 0.04)
ico.save(out / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
print("écrit favicon.ico")
# Aperçu agrandi des petites tailles pour contrôle visuel
preview = Image.new("RGB", (16 * 8 + 32 * 4 + 48 * 3 + 40, 160), (20, 26, 40))
x = 10
for s, k in ((16, 8), (32, 4), (48, 3)):
    im = square(s, 0.04).resize((s * k, s * k), Image.NEAREST)
    preview.paste(im, (x, 10)); x += s * k + 10
preview.save(out / "_apercu.png")
