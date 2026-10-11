import importlib.util
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('social', Path(__file__).resolve().parents[1] / 'backend/scripts/social_video.py')
social = importlib.util.module_from_spec(spec)
spec.loader.exec_module(social)

class SocialGuard(unittest.TestCase):
    def test_private_addresses(self):
        for host in ('127.0.0.1', '10.0.0.1', '169.254.169.254', '192.168.0.1', '100.64.0.1', '::1', '::ffff:8.8.8.8', 'localhost', 'example.com'):
            with self.assertRaises(ValueError): social.public_connection((host, 443))
        for host in ('8.8.8.8', '2606:4700:4700::1111'): social.public_connection((host, 443))
        with self.assertRaises(ValueError): social.public_connection(('8.8.8.8', 22))
    def test_format_limits(self):
        good = {'url':'https://example.com/clip.mp4', 'ext':'mp4', 'protocol':'https', 'vcodec':'h264', 'acodec':'aac', 'height':360}
        self.assertEqual(social.choose_format({'duration':26,'formats':[good]}),good)
        silent = {**good, 'acodec':'none'}
        self.assertEqual(social.choose_format({'formats':[silent]}),silent)
        with self.assertRaises(ValueError): social.choose_format({'formats':[silent, {**good, 'ext':'m4a', 'vcodec':'none'}]})
        for info in ({'duration':181,'formats':[good]}, {'is_live':True,'formats':[good]}, {'formats':[{**good,'filesize':social.MAX_BYTES+1}]}, {'formats':[{**good,'protocol':'m3u8_native'}]}, {'formats':[{**good,'url':'file:///etc/passwd'}]}):
            with self.assertRaises(ValueError): social.choose_format(info)
    def test_external_processes_blocked(self):
        with self.assertRaises(ValueError): social.network_audit('subprocess.Popen', ('ffmpeg',))

unittest.main()
