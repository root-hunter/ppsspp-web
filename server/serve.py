#!/usr/bin/env python3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import argparse
import ssl
import os
import subprocess
import threading
import signal
from urllib.parse import urlparse
from functools import partial


from relay_auth import RelayAuth
from relay import AdhocWebSocketHandler, ThreadingAdhocWebSocketServer, TrackedServerMixin

SERVER_PORT = 27312


class WasmThreadingServer(TrackedServerMixin, ThreadingHTTPServer):
    pass


class WasmThreadingHandler(SimpleHTTPRequestHandler):
    """
    Serves the web repo and a separate PPSSPP wasm repo together.

    Requests for / or /index.html are transparently rewritten to the Angular build
    in /wasm-page/dist/ppsspp-web. Static assets first resolve from that build,
    then from /wasm-page/public for local development. Build outputs like
    /build-wasm/... are served from the wasm repo.
    """
    PUBLIC_FILES = {
        "/favicon.ico",
        "/manifest.webmanifest",
        "/ppsspp-runtime.js",
        "/adhoc-transport.js",
        "/sw.js",
    }

    def __init__(self, *args, web_root=None, wasm_root=None, **kwargs):
        self.web_root = os.path.abspath(web_root)
        self.wasm_root = os.path.abspath(wasm_root)
        self.angular_root = os.path.join(self.web_root, "wasm-page", "dist", "ppsspp-web")
        super().__init__(*args, directory=self.web_root, **kwargs)

    def log_request(self, code="-", size="-"):
        self.log_message("%s %s %s", self.command, urlparse(self.path).path, code)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/healthz":
            body = b'{"status":"ok","relay_protocol":1}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/adhoc" or path.startswith("/adhoc/"):
            if not getattr(self.server, "adhoc_enabled", False):
                self.send_error(404)
                return
            self.close_connection = True
            relay = object.__new__(AdhocWebSocketHandler)
            relay.request = self.connection
            relay.client_address = self.client_address
            relay.server = self.server
            relay.http_reader = self.rfile
            relay.http_headers = self.headers
            relay.http_path = self.path
            relay.setup()
            try:
                relay.handle()
            finally:
                relay.finish()
            return
        if path.startswith("/server/") or any(part.startswith(".") for part in path.split("/")):
            self.send_error(404)
            return
        super().do_GET()

    def do_HEAD(self):
        if urlparse(self.path).path.startswith("/server/"):
            self.send_error(404)
            return
        super().do_HEAD()

    def translate_path(self, path):
        request_path = urlparse(path).path

        if request_path in ("/", "/index.html"):
            angular_index = os.path.join(self.angular_root, "index.html")
            if os.path.isfile(angular_index):
                return self._translate_under(self.angular_root, "/index.html")
            return self._translate_under(self.web_root, "/wasm-page/src/index.html")
        angular_path = self._translate_under(self.angular_root, request_path)
        if os.path.isfile(angular_path):
            return angular_path
        public_path = self._translate_under(self.web_root, "/wasm-page/public" + request_path)
        if request_path in self.PUBLIC_FILES or request_path.startswith("/icons/"):
            return public_path
        if request_path == "/assets-manifest.txt":
            return public_path
        if request_path.startswith(("/wasm-page/", "/server/")):
            return self._translate_under(self.web_root, request_path)

        return self._translate_under(self.wasm_root, request_path)

    def _translate_under(self, root, path):
        previous = self.directory
        self.directory = root
        try:
            return super().translate_path(path)
        finally:
            self.directory = previous

    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        super().end_headers()


def generate_self_signed_cert(cert_file, key_file):
    """Generate a self-signed certificate using openssl."""
    subprocess.run([
        "openssl", "req", "-x509", "-newkey", "rsa:2048",
        "-keyout", key_file, "-out", cert_file,
        "-days", "365", "-nodes",
        "-subj", "/CN=localhost"
    ], check=True)
    print(f"Self-signed certificate generated: {cert_file}, {key_file}", flush=True)


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    web_root = os.path.dirname(script_dir)
    default_wasm_root = os.path.abspath(os.path.join(web_root, "..", "ppsspp-wasm"))
    if not os.path.isdir(default_wasm_root):
        default_wasm_root = web_root

    parser = argparse.ArgumentParser(description="Serve PPSSPP wasm with pthread-compatible headers.")
    parser.add_argument("--bind", "--address", dest="bind", default="192.168.1.170")
    parser.add_argument("--port", type=int, default=8081)
    parser.add_argument("--https", action="store_true", help="Enable HTTPS (TLS)")
    parser.add_argument("--cert", default="cert.pem", help="TLS certificate file (PEM)")
    parser.add_argument("--key", default="key.pem", help="TLS private key file (PEM)")
    parser.add_argument("--web-root", default=web_root, help="ppsspp-web checkout root.")
    parser.add_argument("--wasm-root", "--dir", dest="wasm_root", default=default_wasm_root, help="ppsspp-wasm checkout root containing build-wasm/ and build-wasm-release/.")
    parser.add_argument("--adhoc-ws", action="store_true", help="Enable the browser WebSocket ad hoc lobby server.")
    parser.add_argument("--adhoc-ws-port", type=int, default=SERVER_PORT, help="WebSocket ad hoc lobby port.")
    args = parser.parse_args()

    web_root = os.path.abspath(args.web_root)
    wasm_root = os.path.abspath(args.wasm_root)
    handler = partial(WasmThreadingHandler, web_root=web_root, wasm_root=wasm_root)

    server = WasmThreadingServer((args.bind, args.port), handler)

    server.relay_auth = RelayAuth.from_env()
    server.adhoc_enabled = args.adhoc_ws
    if args.https:
        if not os.path.isabs(args.cert):
            args.cert = os.path.join(script_dir, args.cert)
        if not os.path.isabs(args.key):
            args.key = os.path.join(script_dir, args.key)
        if not os.path.exists(args.cert) or not os.path.exists(args.key):
            generate_self_signed_cert(args.cert, args.key)
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(certfile=args.cert, keyfile=args.key)
        server.socket = ctx.wrap_socket(server.socket, server_side=True, do_handshake_on_connect=False)
        scheme = "https"
    else:
        ctx = None
        scheme = "http"

    adhoc_server = None
    if args.adhoc_ws:
        adhoc_server = ThreadingAdhocWebSocketServer((args.bind, args.adhoc_ws_port), AdhocWebSocketHandler)
        adhoc_server.relay_auth = server.relay_auth
        if ctx:
            adhoc_server.socket = ctx.wrap_socket(adhoc_server.socket, server_side=True, do_handshake_on_connect=False)
        threading.Thread(target=adhoc_server.serve_forever, name="AdhocWebSocketServer", daemon=True).start()
        print(f"Adhoc WebSocket lobby on {'wss' if ctx else 'ws'}://{args.bind}:{args.adhoc_ws_port}/", flush=True)

    print(f"Serving on {scheme}://{args.bind}:{args.port}/", flush=True)
    print(f"  web root:  {web_root}", flush=True)
    print(f"  wasm root: {wasm_root}", flush=True)
    def stop_signal(signum, frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, stop_signal)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        if adhoc_server:
            adhoc_server.shutdown()
            adhoc_server.server_close()
        with AdhocWebSocketHandler.lobby.lock:
            for user in list(AdhocWebSocketHandler.lobby.users.values()):
                user.handler.stop()
        server.server_close()


if __name__ == "__main__":
    main()
