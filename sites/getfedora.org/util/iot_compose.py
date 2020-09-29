import requests

def _iot_checksum_link(media_format, arch, date, version, beta=False):
    path = u'iso'
    if media_format == u'raw.xz':
        path = u'images'

    beta_path = 'test/' if beta else ''

    url = u'https://dl.fedoraproject.org/pub/alt/iot/{0}{1}/IoT/{2}/{3}/' \
        'Fedora-IoT-IoT-{4}-{5}-{6}.0-CHECKSUM'.format(
            beta_path,
            version,
            arch,
            path,
            version,
            arch,
            date)
    return url

def iot_compose_links(version, beta=False):
    beta_path = 'test/' if beta else ''
    BASEURL = 'https://dl.fedoraproject.org/pub/alt/iot/' + beta_path + \
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
            if img['type'] not in links['type'].keys():
                links['type'][img['type']] = {}
            links['type'][img['type']][img['arch']] = BASEURL + img['path']
            links['checksums'][arch][img['format']] = _iot_checksum_link(
                img['format'],
                img['arch'],
                date,
                version,
                beta=beta)
    return links
