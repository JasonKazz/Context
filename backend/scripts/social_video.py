"""Public-post extraction only. No browser cookies, login, subprocesses or saved URLs."""
import ipaddress
import json
import os
import resource
import socket
import sys
import urllib.request
from urllib.parse import urlsplit

MAX_BYTES = 8 * 1024 * 1024


def public_connection(address):
    if not isinstance(address, tuple) or len(address) < 2 or address[1] not in (80, 443):
        raise ValueError('blocked connection')
    ip = ipaddress.ip_address(address[0])  # Reject unresolved names at connect time.
    if not ip.is_global or ip.is_multicast or ip.is_reserved or (isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped):
        raise ValueError('blocked connection')


def network_audit(event, args):
    if event == 'socket.connect':
        public_connection(args[1])
    if event in ('subprocess.Popen', 'os.system', 'os.exec', 'os.posix_spawn'):
        raise ValueError('external processes disabled: '+os.path.basename(str(args[0])))


class Quiet:
    def debug(self, *args): pass
    def warning(self, *args): pass
    def error(self, *args): pass


def choose_format(info):
    if info.get('_type') in ('playlist', 'multi_video'):
        raise ValueError('MULTIPLE_VIDEOS')
    if info.get('is_live') or info.get('duration', 0) and info['duration'] > 180:
        raise ValueError('TOO_LONG')
    available = info.get('formats', [info])
    silent = bool(available) and all(f.get('acodec') == 'none' for f in available)
    formats = [f for f in available
               if f.get('ext') == 'mp4' and f.get('protocol', 'https') in ('https', 'http')
               and f.get('vcodec') != 'none' and (silent or f.get('acodec') != 'none')
               and (f.get('filesize') or f.get('filesize_approx') or 0) <= MAX_BYTES
               and urlsplit(f.get('url', '')).scheme in ('http', 'https')]
    if not formats:
        raise ValueError('NO_SMALL_MP4')
    return min(formats, key=lambda f: (0 if 240 <= (f.get('height') or 0) <= 480 else 1,
                                      f.get('filesize') or f.get('filesize_approx') or 0,
                                      f.get('height') or 0))


def run():
    resource.setrlimit(resource.RLIMIT_FSIZE, (MAX_BYTES, MAX_BYTES))
    resource.setrlimit(resource.RLIMIT_CPU, (5, 5))
    sys.addaudithook(network_audit)
    from yt_dlp import YoutubeDL
    from yt_dlp.extractor.instagram import InstagramIE
    from yt_dlp.extractor.tiktok import TikTokIE, TikTokVMIE
    from yt_dlp.extractor.twitter import TwitterIE
    request = json.loads(sys.stdin.read(8192))
    options = {'quiet': True, 'no_warnings': True, 'logger': Quiet(), 'cachedir': False,
               'proxy': '', 'socket_timeout': 2, 'retries': 0, 'extractor_retries': 0,
               'fragment_retries': 0, 'noplaylist': True, 'playlistend': 1,
               'skip_download': True, 'extract_flat': False, 'ignoreerrors': False,
               'ffmpeg_location': os.path.join(os.getcwd(), 'disabled-external-tools'),
               'js_runtimes': {}, 'format': 'best[ext=mp4]/best',
               'http_headers': {}, 'extractor_args': {'twitter': {'api': ['syndication']}}}
    with YoutubeDL(options, auto_init=False) as ydl:
        for cls in (InstagramIE, TikTokIE, TikTokVMIE, TwitterIE):
            ydl.add_info_extractor(cls())
        info = ydl.extract_info(request['url'], download=False)
    fmt = choose_format(info)
    headers = {k: v for k, v in fmt.get('http_headers', info.get('http_headers', {})).items()
               if k.lower() in ('user-agent', 'referer', 'accept', 'accept-language')}
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(ydl.cookiejar))
    with opener.open(urllib.request.Request(fmt['url'], headers=headers), timeout=2) as response:
        if int(response.headers.get('Content-Length') or 0) > MAX_BYTES:
            raise ValueError('TOO_LARGE')
        total = 0
        with open(request['output'], 'wb') as output:
            while True:
                chunk = response.read(min(65536, MAX_BYTES + 1 - total))
                if not chunk: break
                total += len(chunk)
                if total > MAX_BYTES: raise ValueError('TOO_LARGE')
                output.write(chunk)
    if total < 32:
        raise ValueError('UNAVAILABLE')
    with open(request['output'], 'rb') as video:
        if b'ftyp' not in video.read(64): raise ValueError('NO_SMALL_MP4')
    print(json.dumps({'ok': True, 'bytes': total, 'duration': info.get('duration'), 'audioAvailable': fmt.get('acodec') != 'none'}))


if __name__ == '__main__':
    try:
        run()
    except Exception as error:
        code = str(error) if str(error) in ('TOO_LONG', 'TOO_LARGE', 'NO_SMALL_MP4', 'MULTIPLE_VIDEOS') else 'UNAVAILABLE'
        hints = [label for label in ('Unsupported URL', '403', '429', 'certificate', 'blocked connection', 'external processes', 'Unable to extract', 'impersonat', 'login', 'timed out', 'sw_vers', 'uname', 'ffmpeg', 'ffprobe') if label.lower() in str(error).lower()]
        print(json.dumps({'ok': False, 'code': code, 'diagnostic': type(error).__name__, 'hints': hints}))  # Never expose upstream errors or signed URLs.
        sys.exit(1)
