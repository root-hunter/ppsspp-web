"""Bounded, stateless CORS gateway for the RetroAchievements runtime protocol."""
import re
from urllib.parse import parse_qs, urlsplit
from urllib.request import Request, build_opener
from urllib.error import HTTPError, URLError
from demo_archive import NoRedirects

ROUTE = '/api/retroachievements'
MAX_BODY = 64 * 1024
MAX_RESPONSE = 8 * 1024 * 1024


def upstream_url(query, method):
    params = parse_qs(query, strict_parsing=True)
    if set(params) != {'url'} or len(params['url']) != 1:
        raise ValueError('Expected one URL')
    url = urlsplit(params['url'][0])
    if url.scheme != 'https' or url.username or url.password or url.port not in (None, 443) or url.fragment:
        raise ValueError('Invalid URL')
    api = url.hostname == 'retroachievements.org' and url.path == '/dorequest.php'
    image = (url.hostname == 'media.retroachievements.org' and not url.query
             and re.fullmatch(r'/(?:Badge|Images|UserPic)/[A-Za-z0-9_.-]+\.png', url.path))
    if not api and not (image and method == 'GET'):
        raise ValueError('Unsupported resource')
    # Never forward API query strings: credentials belong in POST bodies.
    if api and (method != 'POST' or url.query):
        raise ValueError('API requires POST')
    return 'https://' + url.hostname + url.path


def serve_retroachievements(handler):
    parsed = urlsplit(handler.path)
    if parsed.path != ROUTE:
        return False

    def respond(status, body, mime='application/json'):
        handler.send_response(status)
        handler.send_header('Content-Type', mime)
        handler.send_header('Content-Length', str(len(body)))
        handler.send_header('Cache-Control', 'no-store')
        handler.send_header('Access-Control-Allow-Origin', '*')
        handler.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        handler.send_header('Access-Control-Allow-Headers', 'Content-Type')
        handler.send_header('Cross-Origin-Resource-Policy', 'cross-origin')
        handler.send_header('X-Content-Type-Options', 'nosniff')
        handler.end_headers()
        handler.wfile.write(body)

    if handler.command == 'OPTIONS':
        respond(204, b'')
        return True
    try:
        url = upstream_url(parsed.query, handler.command)
        body = None
        if handler.command == 'POST':
            length = int(handler.headers.get('Content-Length', '0'))
            if not 0 < length <= MAX_BODY or handler.headers.get('Transfer-Encoding'):
                raise ValueError('Invalid body size')
            if handler.headers.get_content_type() != 'application/x-www-form-urlencoded':
                raise ValueError('Invalid content type')
            body = handler.rfile.read(length)
            if len(body) != length:
                raise ValueError('Incomplete body')
    except (ValueError, TypeError):
        handler.close_connection = True
        respond(400, b'{"error":"Invalid RetroAchievements request"}')
        return True
    request = Request(url, data=body, headers={
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'PPSSPP-Web/1.0',
    }, method=handler.command)
    try:
        try:
            upstream = build_opener(NoRedirects).open(request, timeout=30)
        except HTTPError as exc:
            upstream = exc
        with upstream:
            data = upstream.read(MAX_RESPONSE + 1)
            if len(data) > MAX_RESPONSE or 300 <= upstream.code < 400:
                raise ValueError('Invalid response')
            mime = 'image/png' if '/dorequest.php' not in url else 'application/json'
            respond(upstream.code, data, mime)
    except (URLError, OSError, TimeoutError, ValueError):
        respond(502, b'{"error":"RetroAchievements unavailable; retry later"}')
    return True
