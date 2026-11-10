import urllib.request
import urllib.parse
import json
import os

ASSETS_DIR = r"c:\Users\mania\.antigravity-ide\mansa-musa-film\assets"
HEADERS = {"User-Agent": "MansaMusaDocumentaryBot/1.0 (https://example.org; contact@example.org)"}

def api_get(params):
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))

def get_file_info(title, width=1280):
    data = api_get({
        "action": "query",
        "titles": title,
        "prop": "imageinfo",
        "iiprop": "url|extmetadata|dimensions",
        "iiurlwidth": width,
        "format": "json"
    })
    pages = data.get("query", {}).get("pages", {})
    for pid, page in pages.items():
        if int(pid) < 0:
            return None
        ii = page.get("imageinfo", [])
        if not ii:
            return None
        info = ii[0]
        ext = info.get("extmetadata", {})
        license_name = ext.get("LicenseShortName", {}).get("value", "Unknown")
        pd = ext.get("PublicDomain", {}).get("value", "Unknown")
        thumb_url = info.get("thumburl") or info.get("url")
        return {
            "title": page.get("title"),
            "url": thumb_url,
            "orig_url": info.get("url"),
            "license": license_name,
            "public_domain": pd,
            "width": info.get("width"),
            "height": info.get("height")
        }
    return None

def search_commons(query, limit=8):
    data = api_get({
        "action": "query",
        "generator": "search",
        "gsrsearch": f"filetype:bitmap {query}",
        "gsrnamespace": 6,
        "gsrlimit": limit,
        "prop": "imageinfo",
        "iiprop": "url|extmetadata|dimensions",
        "iiurlwidth": 1280,
        "format": "json"
    })
    pages = data.get("query", {}).get("pages", {})
    results = []
    for pid, page in pages.items():
        ii = page.get("imageinfo", [])
        if not ii:
            continue
        info = ii[0]
        ext = info.get("extmetadata", {})
        license_name = ext.get("LicenseShortName", {}).get("value", "Unknown")
        results.append({
            "title": page.get("title"),
            "url": info.get("thumburl") or info.get("url"),
            "license": license_name,
            "width": info.get("width", 0),
            "height": info.get("height", 0)
        })
    return results

def download(url, dest):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        with open(dest, "wb") as f:
            f.write(resp.read())

if __name__ == "__main__":
    # 1. Exact file 09: File:Mansa_Moussa_on_the_map_of_Angelino_Dulcert.jpg
    info09 = get_file_info("File:Mansa_Moussa_on_the_map_of_Angelino_Dulcert.jpg")
    print("09:", info09)
    if info09:
        download(info09["url"], os.path.join(ASSETS_DIR, "09.jpg"))

    # Search for 02 (Gold nuggets), 05 (David Roberts Cairo lithograph), 06 (Mamluk gold dinar)
    for tag, q in [
        ("02", "gold nuggets natural"),
        ("05", "David Roberts Cairo lithograph"),
        ("06", "Mamluk gold dinar coin"),
    ]:
        res = search_commons(q, limit=6)
        print(f"Search {tag} ({q}):")
        for r in res:
            print("  ", r["title"], "| License:", r["license"], "| Size:", r["width"], "x", r["height"])

