import os
from fetch_commons import get_file_info, download, ASSETS_DIR

targets = {
    "02_nuggets_cc0.jpg": "File:Native gold and mineral specimens on display (2010).jpg",
    "02_nugget_pd.png": "File:A nugget of gold.png",
    "02_nuggets_1904.jpg": "File:Gold nuggets, Alaska, ca 1904 (NOWELL 9).jpeg",
    "05.jpg": "File:David Roberts (1796-1864) - A View in Cairo - RCIN 403602 - Royal Collection.jpg",
    "06.jpg": "File:Gold dinar of an-Nasir Muhammad.jpg",
    "06_hires.jpg": "File:Gold dinar of Lajin.jpg",
}

for fname, title in targets.items():
    info = get_file_info(title, width=1280)
    if info:
        print(fname, "->", info["title"], "| License:", info["license"])
        download(info["url"], os.path.join(ASSETS_DIR, fname))
