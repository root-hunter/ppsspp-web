import io
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from demo_archive import archive_url, serve_demo_archive


class Handler:
    def __init__(self, path):
        self.path = path
        self.wfile = io.BytesIO()
        self.headers = {}
        self.status = None
    def send_error(self, code, message): self.status = code
    def send_response(self, code): self.status = code
    def send_header(self, name, value): self.headers[name] = value
    def end_headers(self): pass


class DemoArchiveTest(unittest.TestCase):
    def test_only_fixed_archive_origin_and_simple_filenames(self):
        self.assertEqual(archive_url('file=ape-academy-2_EU.zip'), 'https://data.playdreamcreate.com/ape-academy-2_EU.zip')
        for query in ['file=../evil.zip', 'file=https://evil.example/a.zip', 'file=a.zip&file=b.zip', 'file=a.zip&url=anything', 'file=a.zip%3Fx=1', 'file=a.exe', '']:
            with self.subTest(query=query), self.assertRaises(ValueError): archive_url(query)

    def test_invalid_gateway_request_does_not_open_network(self):
        handler = Handler('/api/demos/download?file=../evil.zip')
        with patch('demo_archive.build_opener') as opener:
            self.assertTrue(serve_demo_archive(handler)); opener.assert_not_called()
        self.assertEqual(handler.status, 400)

    def test_streams_zip_and_marks_it_network_only(self):
        handler = Handler('/api/demos/download?file=demo.zip')
        upstream = io.BytesIO(b'zip payload'); upstream.headers = {'Content-Length': '11'}
        with patch('demo_archive.build_opener') as opener:
            opener.return_value.open.return_value = upstream
            self.assertTrue(serve_demo_archive(handler))
            request = opener.return_value.open.call_args.args[0]
            self.assertEqual(request.full_url, 'https://data.playdreamcreate.com/demo.zip')
        self.assertEqual(handler.status, 200)
        self.assertEqual(handler.wfile.getvalue(), b'zip payload')
        self.assertEqual(handler.headers['Cache-Control'], 'no-store')

    def test_failure_and_oversized_archive_are_reported_before_streaming(self):
        for error in [True, False]:
            handler = Handler('/api/demos/catalog')
            with patch('demo_archive.build_opener') as opener:
                if error: opener.return_value.open.side_effect = OSError('offline')
                else:
                    upstream = io.BytesIO(b''); upstream.headers = {'Content-Length': str(3 * 1024 * 1024)}
                    opener.return_value.open.return_value = upstream
                self.assertTrue(serve_demo_archive(handler))
            self.assertEqual(handler.status, 502)

    def test_other_routes_are_not_handled(self):
        self.assertFalse(serve_demo_archive(Handler('/other')))
