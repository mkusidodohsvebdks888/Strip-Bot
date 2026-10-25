"""Ask the already-running Strip Bot host to start its managed plugin."""
from urllib.request import build_opener, ProxyHandler, Request
try:
    request = Request('http://127.0.0.1:3060/api/plugins/nono/enable', data=b'{"enabled":true}', headers={'Content-Type':'application/json'})
    with build_opener(ProxyHandler({})).open(request, timeout=35):
        print('Nono plugin enabled.')
except Exception:
    print('Start Strip Bot, then enable Nono in Settings > Desktop pet.')
    raise SystemExit(1)
