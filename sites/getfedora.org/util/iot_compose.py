import requests

def _baseurl(version, beta, master=False):
    '''
    Generate the base URL for pulling metadata from and generating links from.
    'version' and 'beta' toggle the path to the directory.
    'master' toggles whether or not the URL should point to the master mirrors
    or to the general public mirrors.
    '''
    subdomain = 'dl' if master else 'download'
    beta_path = 'test/' if beta else ''
    fmt = 'https://{sub}.fedoraproject.org/pub/alt/iot/{beta_path}{version}/'
    return fmt.format(sub=subdomain, beta_path=beta_path, version=version)

def _iot_checksum_link(artifact, arch, date, version, beta=False):
    baseurl = _baseurl(version, beta)
    url = baseurl + \
        'IoT/{arch}/{artifact}/Fedora-IoT-IoT-{version}-{arch}-' + \
        '{date}.0-CHECKSUM'
    return url.format(
        version=version,
        arch=arch,
        artifact=artifact,
        date=date,
    )

def _get_metadata(version, fallback, beta=False):
    '''
    Attempt to retrieve metadata JSON for IOT composes.
    Returns 2-tuple of (metadata dict, version, is_beta)
    '''

    baseurls = [(version, beta)]
    if fallback:
        baseurls.append((fallback, False))

    for (version, is_beta) in baseurls:
        # Hit the master mirrors here, because they are more likely to be synced
        # quickly and have the metadata we need to generate links.
        baseurl = _baseurl(version, is_beta, master=True)
        md_link = baseurl + 'metadata/images.json'
        try:
            print('Trying {md_link}'.format(md_link=md_link))
            json = requests.get(md_link).json()
        except Exception as e:
            print(e)
            continue
        else:
            return (json, version, is_beta)

        return None


def iot_compose_links(version, fallback=None, beta=False):
    '''
    Generate a dict of IOT compose info from the metadata file in the compose.
    Handles a fallback to an older version in the event that the metadata file
    can't be loaded (usually because it isn't synced at release time).
    '''
    metadata = _get_metadata(version, fallback, beta)
    if metadata is None:
        return {}
    (json, md_version, md_beta) = metadata

    date = json['payload']['compose']['date']
    links = {}
    links['date'] = date[0:4] + '-' + date[4:6] + '-' + date[6:8]
    links['type'] = {}
    links['checksums'] = {}
    links['version'] = md_version
    links['beta'] = md_beta

    for arch, lst in json['payload']['images']['IoT'].items():
        links['checksums'][arch] = {}
        for img in lst:
            if img['arch'] == 'src':
                continue

            artifact = 'images' if img['format'] == 'raw.xz' else 'iso'

            if img['type'] not in links['type'].keys():
                links['type'][img['type']] = {}

            baseurl = _baseurl(md_version, md_beta)
            links['type'][img['type']][img['arch']] = baseurl + img['path']
            links['checksums'][arch][artifact] = _iot_checksum_link(
                artifact,
                img['arch'],
                date,
                md_version,
                beta=md_beta)
    return links

def iot_context(r):
    iot_ctx = {}
    iot_version = r['ga']['editions']['iot']['release_number']
    iot_fallback_version = r['ga']['editions']['iot']['fallback_release_number']

    iot_ctx['ga'] = iot_compose_links(iot_version, iot_fallback_version)

    if r['beta']['show']:
        iot_beta_version = r['beta']['editions']['iot']['release_number']

        # Best-effort attempt to show beta links. If beta.show and the metadata
        # file was able to be decoded, we add it. Otherwise we don't.
        iot_beta = iot_compose_links(
            iot_beta_version,
            beta=True)

        if iot_beta:
            iot_ctx['beta'] = iot_beta

    return iot_ctx
