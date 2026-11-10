import os
from fetch_commons import get_file_info, download, ASSETS_DIR

for fname, title in [
    ("02.jpg", "File:Gold nugget (Australia) 4 (16848647509).jpg"),
    ("02_victoria.jpg", "File:A chart showing the great nuggets of Victoria.jpg"),
]:
    info = get_file_info(title, width=1280)
    if info:
        print(fname, "->", info["title"], "| License:", info["license"])
        download(info["url"], os.path.join(ASSETS_DIR, fname))

