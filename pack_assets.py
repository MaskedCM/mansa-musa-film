import base64
import json
import os

ASSETS_DIR = r"c:\Users\mania\.antigravity-ide\mansa-musa-film\assets"
OUT_JS = r"c:\Users\mania\.antigravity-ide\mansa-musa-film\assets_data.js"

# Check if Pillow is installed; if not, just read raw JPEG bytes
files = {
    "img01": "01.jpg",
    "img02": "02.jpg",
    "img03": "03.jpg",
    "img04": "04.jpg",
    "img05": "05.jpg",
    "img06": "06.jpg",
    "img07": "07.jpg",
    "img08": "08.jpg",
    "img09": "09.jpg",
}

data = {}
for key, fname in files.items():
    path = os.path.join(ASSETS_DIR, fname)
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    data[key] = f"data:image/jpeg;base64,{b64}"
    print(f"Packed {key} ({fname}): {len(b64)//1024} KB base64")

with open(r"c:\Users\mania\.antigravity-ide\mansa-musa-film\timings.json", "r", encoding="utf-8") as f:
    timings = json.load(f)

with open(OUT_JS, "w", encoding="utf-8") as f:
    f.write("window.FILM_ASSETS = " + json.dumps(data) + ";\n")
    f.write("window.FILM_TIMINGS = " + json.dumps(timings, indent=2) + ";\n")

print("Wrote", OUT_JS)
