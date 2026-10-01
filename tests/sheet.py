# Combine screenshots side by side: python3 tests/sheet.py out.png a.png b.png ...
import sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert('RGB') for f in files]
h = 700
ims = [im.resize((int(im.width * h / im.height), h)) for im in ims]
W = sum(i.width for i in ims) + 10 * (len(ims) - 1)
sheet = Image.new('RGB', (W, h), (40, 40, 40))
x = 0
for im in ims:
    sheet.paste(im, (x, 0)); x += im.width + 10
sheet.save(out)
