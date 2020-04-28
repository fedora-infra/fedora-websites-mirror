import os.path
import json
import yaml

def check_releases_json():
    '''Basic sanity check to ensure versions we list are all in releases.json'''
    yaml_file = os.path.join(os.path.dirname(__file__), '..', 'release.yaml')
    with open(yaml_file) as data:
        yaml_data = yaml.safe_load(data)

    json_file = os.path.join(
        os.path.dirname(__file__),
        '..',
        'static',
        'releases.json')

    if not os.path.exists(json_file):
        print(
            'Could not find json file at {0}. Generate it '
            'first.'.format(json_file))
        return False

    with open(json_file) as data:
        json_data = json.load(data)
    json_versions = set(d['version'].lower() for d in json_data)

    for release in yaml_data.get('fmw', {}).get('releases_json', []):
        ver = release.get('version')
        ms = release.get('milestone', 'final')

        if not ver:
            print(
                'release.yaml invalid, fmw.releases_json entry is missing a '
                '"version" field. Failing.')
            return False

        if ms == 'final':
            ms = ''

        lookup = '{0} {1}'.format(ver, ms).strip()

        if lookup not in json_versions:
            print(
                '{0} not in releases.json. Did you forget to regenerate '
                'releases.json after updating release.yaml?'.format(lookup))
            return False

    print('[OK] releases.json is in sync with release.yaml')
    return True
