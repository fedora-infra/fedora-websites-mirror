import glob
import gnupg
import os.path
import tempfile
import yaml

def generate_gpg_bundle():
    '''Generate a fedora.gpg bundle with active keys.'''
    yaml_file = os.path.join(os.path.dirname(__file__), '..', 'release.yaml')
    with open(yaml_file) as data:
        yaml_data = yaml.safe_load(data)

    gpg_home = tempfile.mkdtemp()
    gpg = gnupg.GPG(gnupghome=gpg_home)
    current = yaml_data.get('gpg_keys', {}).get('current', [])
    current_fingerprints = []

    for key in current:
        # the id stuff is kept around as a sanity check, but we use fingerprints
        # now, see #196.
        key_id = key.get('id')
        if not key_id or '/' not in key_id:
            raise Exception('invalid id field for GPG key in release.yaml')

        key_id = key_id.split('/', 1)[1].split(' ')[0]
        if len(key_id) != 8:
            raise Exception('invalid id field for GPG key in release.yaml')

        key_fingerprint = key.get('fingerprint').replace(' ', '')
        if not key_fingerprint:
            raise Exception('Missing fingerprint for GPG key in release.yaml')

        current_fingerprints.append(key_fingerprint)

        # If the key exists on disk with the full fingerprint use it, else fall
        # back to short id.
        path = os.path.join(
            os.path.dirname(__file__),
            '..',
            'static',
            'keys',
            key_fingerprint + '.txt')
        if not os.path.exists(path):
            path = os.path.join(
                os.path.dirname(__file__),
                '..',
                'static',
                'keys',
                key_id + '.txt')
        try:
            with open(path, 'r') as f:
                gpg.import_keys(f.read())
        except Exception as e:
            print('Could not open key file {0}: {1}'.format(path, e))
            raise

    armor = gpg.export_keys(current_fingerprints, armor=True)
    return armor

def check_gpg_keys():
    '''
    Basic sanity check to ensure:
    1) Each key listed in release.yaml is in static/keys
    2) The bundle has the release key in it.
    '''
    yaml_file = os.path.join(os.path.dirname(__file__), '..', 'release.yaml')
    with open(yaml_file) as data:
        yaml_data = yaml.safe_load(data)

    dir_keys = glob.glob(
        '{0}/*.txt'.format(
            os.path.join(os.path.dirname(__file__), '..', 'static', 'keys')))

    gpg_home = tempfile.mkdtemp()
    gpg = gnupg.GPG(gnupghome=gpg_home)

    for key in dir_keys:
        with open(key, 'r') as f:
            gpg.import_keys(f.read())

    current = yaml_data.get('gpg_keys', {}).get('current', [])
    # We should add these at some point a few are missing.
    #obsolete = yaml_data.get('gpg_keys', {}).get('obsolete', [])
    obsolete = []
    missing = []

    for key in current + obsolete:
        fp = key.get('fingerprint').replace(' ', '').replace('\t', '')
        matches = [ik for ik in gpg.list_keys() if ik.get('fingerprint') == fp]

        if len(matches) == 0:
            missing.append(key)

    if missing:
        for key in missing:
            print(
                '[Static GPG Key Missing] {0} ({1})'.format(
                    key.get('name'),
                    key.get('id')))
        return False

    print('GPG keys look good.')
    return True
