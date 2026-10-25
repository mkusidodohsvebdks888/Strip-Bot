"""Local plugin bridge. Provider credentials never enter the pet process."""
import json
import os
from urllib.request import Request, build_opener, ProxyHandler, HTTPRedirectHandler
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

class StripBotClient:
    def __init__(self):
        self.url = os.environ.get('NONO_STRIPBOT_URL', '').rstrip('/')
        self.token = os.environ.get('NONO_STRIPBOT_TOKEN', '')
        parsed = urlsplit(self.url)
        if parsed.scheme != 'http' or parsed.hostname != '127.0.0.1' or not parsed.port or parsed.path or parsed.username or parsed.password or parsed.query or parsed.fragment or not self.token:
            raise ValueError('请从 Strip Bot 的设置 → 桌面宠物中启用此插件。')
        self.opener = build_opener(ProxyHandler({}), NoRedirect())

    def request(self, route, data=None):
        body = None if data is None else json.dumps(data, ensure_ascii=False).encode('utf-8')
        request = Request(self.url + '/api/plugins/nono/' + route, data=body,
                          headers={'Authorization': 'Bearer ' + self.token, 'Content-Type': 'application/json'})
        try:
            with self.opener.open(request, timeout=95 if route == 'chat' else 3) as response:
                return json.load(response)
        except HTTPError as error:
            try:
                message = json.load(error).get('error', '连接失败，请在 Strip Bot 中检查配置。')
            except (ValueError, OSError):
                message = '连接失败，请在 Strip Bot 中检查配置。'
            raise RuntimeError(message) from None
        except (URLError, OSError):
            raise RuntimeError('无法连接 Strip Bot，请确认主程序正在运行。') from None

    def chat(self, messages):
        return self.request('chat', {'messages': messages})

    def heartbeat(self):
        return self.request('heartbeat')
