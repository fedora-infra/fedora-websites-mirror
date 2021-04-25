import requests

def _iot_checksum_link(artifact, arch, date, version, beta=False):
    beta_path = 'test/' if beta else ''

    url = u'https://download.fedoraproject.org/pub/alt/iot/{0}{1}/IoT/{2}/{3}/' \
        'Fedora-IoT-IoT-{4}-{5}-{6}.0-CHECKSUM'.format(
            beta_path,
            version,
            arch,
            artifact,
            version,
            arch,
            date)
    return url

def iot_compose_links(version, beta=False):
    beta_path = 'test/' if beta else ''
    BASEURL = 'https://download.fedoraproject.org/pub/alt/iot/' + beta_path + \
        str(version) + '/'
    try:
        json = requests.get(BASEURL + '/metadata/images.json').json()
    except Exception as e:
        print(e)
        return {}
    date = json['payload']['compose']['date']
    links = {}
    links['date'] = date[0:4] + '-' + date[4:6] + '-' + date[6:8]
    links['type'] = {}
    links['checksums'] = {}

    for arch, lst in json['payload']['images']['IoT'].items():
        links['checksums'][arch] = {}
        for img in lst:
            if img['arch'] == 'src':
                continue

            artifact = 'images' if img['format'] == 'raw.xz' else 'iso'

            if img['type'] not in links['type'].keys():
                links['type'][img['type']] = {}

            links['type'][img['type']][img['arch']] = BASEURL + img['path']
            links['checksums'][arch][artifact] = _iot_checksum_link(
                artifact,
                img['arch'],
                date,
                version,
                beta=beta)
    return links
