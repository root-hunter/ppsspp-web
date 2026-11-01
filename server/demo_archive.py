"""Read-only gateway for the public PlayDreamCreate archive (downloads lack CORS)."""
import re
from urllib.parse import parse_qs, urlsplit
from urllib.request import build_opener, HTTPRedirectHandler, Request
from urllib.error import HTTPError, URLError


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def archive_url(query):
    params = parse_qs(query, strict_parsing=True)
    if set(params) != {"file"} or len(params["file"]) != 1:
        raise ValueError("Expected one archive filename")
    name = params["file"][0]
    if not re.fullmatch(r"[A-Za-z0-9_-]+\.zip", name):
        raise ValueError("Invalid archive filename")
    return "https://data.playdreamcreate.com/" + name


def serve_demo_archive(handler):
    """Return True only for this gateway's routes; never proxy arbitrary hosts."""
    parsed = urlsplit(handler.path)
    if parsed.path not in ("/api/demos/catalog", "/api/demos/download"):
        return False
    try:
        url = ("https://playdreamcreate.com/data/demos.json" if parsed.path.endswith("/catalog")
               else archive_url(parsed.query))
    except ValueError:
        handler.send_error(400, "Invalid demo archive request")
        return True
    try:
        upstream = build_opener(NoRedirects).open(Request(url, headers={"User-Agent": "PPSSPP-Web-Demos/1.0"}), timeout=30)
    except (HTTPError, URLError, TimeoutError, OSError):
        handler.send_error(502, "Demo archive unavailable; retry later")
        return True
    with upstream:
        limit = 2 * 1024 * 1024 if parsed.path.endswith("/catalog") else 512 * 1024 * 1024
        try:
            length = int(upstream.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > limit:
            handler.send_error(502, "Invalid demo archive size")
            return True
        handler.send_response(200)
        handler.send_header("Content-Type", "application/json" if parsed.path.endswith("/catalog") else "application/zip")
        handler.send_header("Content-Length", str(length))
        handler.send_header("Cache-Control", "no-store")
        handler.send_header("X-Content-Type-Options", "nosniff")
        handler.end_headers()
        try:
            remaining = length
            while remaining:
                chunk = upstream.read(min(256 * 1024, remaining))
                if not chunk:
                    handler.close_connection = True
                    break
                handler.wfile.write(chunk)
                remaining -= len(chunk)
        except (OSError, TimeoutError):
            handler.close_connection = True
    return True
