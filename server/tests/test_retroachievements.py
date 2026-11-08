import io
import sys
import unittest
from email.message import Message
from pathlib import Path
from urllib.parse import urlencode
from urllib.error import HTTPError
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from retroachievements import upstream_url, serve_retroachievements, MAX_BODY, MAX_RESPONSE

API = 'https://retroachievements.org/dorequest.php'


class Handler:
    def __init__(self, url=API, method='POST', body=b'r=login2&u=test&p=secret'):
        self.path = '/api/retroachievements?' + urlencode({'url': url})
        self.command = method
        self.headers = Message()
        self.headers['Content-Length'] = str(len(body))
        self.headers['Content-Type'] = 'application/x-www-form-urlencoded'
        self.rfile, self.wfile = io.BytesIO(body), io.BytesIO()
        self.response_headers = {}
        self.status = None
    def send_response(self, status): self.status = status
    def send_header(self, name, value): self.response_headers[name] = value
    def end_headers(self): pass


class RetroAchievementsTest(unittest.TestCase):
    def test_allowlist_blocks_credentials_query_injection_and_other_hosts(self):
        self.assertEqual(upstream_url(urlencode({'url': API}), 'POST'), API)
        self.assertEqual(upstream_url(urlencode({'url': 'https://media.retroachievements.org/Badge/123_lock.png'}), 'GET'),
                         'https://media.retroachievements.org/Badge/123_lock.png')
        for url in ['http://retroachievements.org/dorequest.php', 'https://localhost/dorequest.php',
                    API + '?p=secret', API + '#fragment', 'https://retroachievements.org:444/dorequest.php',
                    'https://user:pass@retroachievements.org/dorequest.php',
                    'https://retroachievements.org.evil.test/dorequest.php',
                    'https://media.retroachievements.org/Badge/../private.png',
                    'https://media.retroachievements.org/Badge/a.svg',
                    'https://retroachievements.org/API/API_GetUserProfile.php']:
            with self.subTest(url=url), self.assertRaises(ValueError):
                upstream_url(urlencode({'url': url}), 'POST')
        with self.assertRaises(ValueError): upstream_url(urlencode({'url': API}), 'GET')
        with self.assertRaises(ValueError): upstream_url(urlencode({'url': API}) + '&url=' + API, 'POST')

    def test_credentials_only_in_body_and_response_is_never_cached(self):
        handler = Handler()
        upstream = io.BytesIO(b'{"Success":true}'); upstream.code = 200
        with patch('retroachievements.build_opener') as opener:
            opener.return_value.open.return_value = upstream
            self.assertTrue(serve_retroachievements(handler))
            request = opener.return_value.open.call_args.args[0]
            self.assertEqual(request.full_url, API)
            self.assertEqual(request.data, b'r=login2&u=test&p=secret')
            self.assertNotIn('Cookie', request.headers)
            self.assertNotIn('Authorization', request.headers)
        self.assertEqual(handler.status, 200)
        self.assertEqual(handler.wfile.getvalue(), b'{"Success":true}')
        self.assertEqual(handler.response_headers['Cache-Control'], 'no-store')
        self.assertEqual(handler.response_headers['Access-Control-Allow-Origin'], '*')
        self.assertNotIn('Access-Control-Allow-Credentials', handler.response_headers)

    def test_rejects_oversize_and_incomplete_body_without_network(self):
        for length in [MAX_BODY + 1, -1, 'bad', 100]:
            handler = Handler(); handler.headers.replace_header('Content-Length', str(length))
            with patch('retroachievements.build_opener') as opener:
                self.assertTrue(serve_retroachievements(handler)); opener.assert_not_called()
            self.assertEqual(handler.status, 400)

    def test_preflight_needs_no_upstream_and_other_routes_are_ignored(self):
        handler = Handler(method='OPTIONS')
        with patch('retroachievements.build_opener') as opener:
            self.assertTrue(serve_retroachievements(handler)); opener.assert_not_called()
        self.assertEqual(handler.status, 204)
        handler.path = '/other'
        self.assertFalse(serve_retroachievements(handler))

    def test_upstream_errors_timeouts_size_limits_and_redirects(self):
        for outcome, expected in [('offline', 502), ('redirect', 502), ('oversize', 502), ('unauthorized', 401)]:
            handler = Handler()
            with patch('retroachievements.build_opener') as opener:
                if outcome == 'offline': opener.return_value.open.side_effect = OSError('private internal error')
                elif outcome == 'unauthorized':
                    opener.return_value.open.side_effect = HTTPError(API, 401, 'denied', {}, io.BytesIO(b'{"Success":false}'))
                else:
                    upstream = io.BytesIO(b'x' * (MAX_RESPONSE + 1) if outcome == 'oversize' else b'')
                    upstream.code = 302 if outcome == 'redirect' else 200
                    opener.return_value.open.return_value = upstream
                serve_retroachievements(handler)
            self.assertEqual(handler.status, expected)
            self.assertNotIn(b'private internal error', handler.wfile.getvalue())
