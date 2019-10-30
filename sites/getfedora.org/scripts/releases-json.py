#!/usr/bin/env python
import fedfind.release
import fedfind.helpers
import json
output = []
def hashify(version, milestone, arch, link, variant, subvariant):
    return { 'version': version
           , 'arch': arch
           , 'link': link
           , 'variant': variant
           , 'subvariant': subvariant
           }
releases_to_report = [
      fedfind.release.get_release(30),
      fedfind.release.get_release(29),
      fedfind.release.get_release(28)
    ]
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

        if rel.version == "26":
            h['releaseDate'] = '2017-07-11'
        elif rel.version == "27" and img['variant'] != "Server":
            h['releaseDate'] = '2017-11-14'

        if 'size' in img:
            h['size'] = str(img['size'])

        output.append(h)
print (json.dumps(output))
