import os
import os.path
import requests

def check_download_link(link):
    r = requests.head(link, allow_redirects=True)
    if r.status_code != 200:
        print('[BROKEN LINK] %s' % link)
        return False
    print('[OK] %s' % link)
    return True

def check_checksum_link(path):
    if path.startswith('/'):
        path = path.lstrip('/')
    current = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    full_path = os.path.join(current, path)
    if not os.path.exists(full_path):
        print('[MISSING CHECKSUM] %s' % full_path)
        return False
    print('[OK] %s' % path)
    return True
