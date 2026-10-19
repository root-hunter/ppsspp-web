import http.client
import ssl
import subprocess
import sys
import tempfile
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from onboarding import SetupServer


class SetupTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.directory.cleanup)
        cls.ca = Path(cls.directory.name) / 'ca.crt'
        cls.key = Path(cls.directory.name) / 'key.pem'
        subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
                        '-keyout', str(cls.key), '-out', str(cls.ca), '-days', '1',
                        '-subj', '/CN=Setup Test'], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    def setUp(self):
        self.server = SetupServer(('127.0.0.1', 0), ca_file=str(self.ca), https_port=8081)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.thread.join, 2)
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)

    def get(self, path, host='192.168.10.172:8082'):
        connection = http.client.HTTPConnection(*self.server.server_address, timeout=3)
        self.addCleanup(connection.close)
        connection.request('GET', path, headers={'Host': host})
        response = connection.getresponse()
        return response.status, dict(response.getheaders()), response.read()

    def test_setup_launch_preserves_relay_and_room(self):
        status, _, body = self.get('/setup?room=ROOM')
        self.assertEqual(status, 200)
        self.assertIn(b'wss%3A%2F%2F192.168.10.172%3A8081%2Fadhoc', body)
        self.assertIn(b'&amp;room=ROOM', body)
        self.assertIn(b'/setup/ca.crt', body)
        self.assertIn(b'SHA-256', body)

    def test_public_certificate_download(self):
        status, headers, body = self.get('/setup/ca.crt')
        self.assertEqual(status, 200)
        self.assertIn('attachment;', headers['Content-Disposition'])
        self.assertEqual(headers['Cache-Control'], 'no-store')
        self.assertEqual(ssl.PEM_cert_to_DER_cert(body.decode()),
                         ssl.PEM_cert_to_DER_cert(self.ca.read_text()))
        self.assertNotIn(b'PRIVATE KEY', body)

    def test_only_setup_routes_are_available(self):
        for route in ('/', '/server/key.pem', '/setup/../key.pem', '/adhoc', '/setup/rootCA-key.pem'):
            self.assertEqual(self.get(route)[0], 404)

    def test_invalid_room_and_host_are_rejected(self):
        self.assertEqual(self.get('/setup?room=%3Cscript%3E')[0], 400)
        self.assertEqual(self.get('/setup', host='user@192.168.10.172:8082')[0], 400)

    def test_private_key_cannot_be_downloaded_as_ca(self):
        self.server.ca_file = str(self.key)
        status, _, body = self.get('/setup/ca.crt')
        self.assertEqual(status, 503)
        self.assertNotIn(b'PRIVATE KEY', body)

    def test_missing_ca_is_reported(self):
        self.server.ca_file = str(self.ca.parent / 'missing.crt')
        self.assertEqual(self.get('/setup')[0], 503)

    def test_qr_is_locally_generated_svg(self):
        status, headers, body = self.get('/setup/qr.svg?room=game-night')
        self.assertEqual(status, 200)
        self.assertEqual(headers['Content-Type'], 'image/svg+xml')
        self.assertIn(b'<svg', body)

    def test_explicit_public_origin_and_localhost_hint(self):
        self.server.public_origin = 'https://192.168.10.172:8443'
        status, _, body = self.get('/setup', host='localhost:8082')
        self.assertEqual(status, 200)
        self.assertIn(b'192.168.10.172%3A8443', body)
        self.assertIn(b'http://192.168.10.172:8082/setup?', body)
        self.assertNotIn(b'instead of localhost', body)
