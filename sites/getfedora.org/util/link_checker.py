import os
import os.path
import requests

# By default check dl.fedoraproject.org (master mirrors) because
# mirrors might not all have content yet and we don't want to block websites
# releases on that.
def check_download_link(link, rewrite_dlfpo=True):
    if rewrite_dlfpo:
        link = link.replace(
            'download.fedoraproject.org',
            'dl.fedoraproject.org')
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
