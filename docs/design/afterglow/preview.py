"""Serve only this design kit and its public background assets on loopback."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit, unquote
import argparse
HERE = Path(__file__).resolve().parent
ASSETS = HERE.parents[2] / "apps/web/public/backgrounds/afterglow"
class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, url):
        route = unquote(urlsplit(url).path).lstrip("/")
        base = ASSETS if route.startswith("assets/") else HERE
        relative = route.removeprefix("assets/") if base == ASSETS else route
        target = (base / (relative or "index.html")).resolve()
        return str(target if target.is_relative_to(base) else HERE / "not-found")
    def list_directory(self, path):
        self.send_error(404)
p = argparse.ArgumentParser()
p.add_argument("--port", type=int, default=8766)
args = p.parse_args()
ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
