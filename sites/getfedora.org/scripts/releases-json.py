#!/usr/bin/env python
import fedfind.release
import fedfind.helpers
import json
import os
import yaml

r = {}
output = []
IOT_URL = "https://download.fedoraproject.org/pub/alt/iot"
IOT_BETA_URL = "https://download.fedoraproject.org/pub/alt/iot/test"

with open(os.path.join(os.path.dirname(__file__), '..', 'release.yaml')) as data:
    r = yaml.safe_load(data)


def hashify(version, milestone, arch, link, variant, subvariant):
    return { 'version': version
           , 'arch': arch
           , 'link': link
           , 'variant': variant
           , 'subvariant': subvariant
           }


releases_to_report = []
for release in r.get('fmw', {}).get('releases_json', []):
    version = release.get('version')
    if version is None:
        raise Exception(
            'Malformed yaml section: fmw.releases_json, each entry must at ' +
            'least have a "version" field.')
    milestone = release.get('milestone', 'final')
    releases_to_report.append(
        fedfind.release.get_release(
            int(version),
            milestone=milestone))
    
    # IoT hack-ish special case
    iot = None
    if milestone == 'final':
        iot = fedfind.release.get_release(url="/".join((IOT_URL, str(version))))
        iot._version = str(version)
    else:
        iot = fedfind.release.get_release(url="/".join((IOT_BETA_URL, str(version))))
        iot._version = f"{version} {milestone}"
    iot.__class__ = fedfind.release.Pungi4Mirror
    releases_to_report.append(iot)


for rel in releases_to_report:
    for img in rel.all_images:
        location = img['url']
        h = hashify(
                rel.version,
                rel.milestone,
                img['arch'],
                location,
                img['variant'],
                img['subvariant'])

        if 'checksums' in img and 'sha256' in img['checksums']:
            h['sha256'] = str(img['checksums']['sha256'])

        if 'size' in img:
            h['size'] = str(img['size'])

        output.append(h)

print (json.dumps(output))
