#!/usr/bin/env python

import boto.ec2
from dataclasses import dataclass
import json
from multiprocessing import Pool
import os
import sys
import yaml

KEY_ID = os.environ.get('FEDORA_DESCRIBE_IMAGES_AWS_KEY_ID')
KEY_SECRET = os.environ.get('FEDORA_DESCRIBE_IMAGES_AWS_KEY_SECRET')

if not KEY_ID or not KEY_SECRET:
    print('Must set env vars AWS_KEY_ID and AWS_KEY_SECRET')
    sys.exit(1)

with open(os.path.join(os.path.dirname(__file__), '..', 'aws_regions.yaml')) as data:
    regions = yaml.safe_load(data)['aws_regions'].keys()

def get_images_for_region(region):
    conn = boto.ec2.connect_to_region(
        region,
        aws_access_key_id=KEY_ID,
        aws_secret_access_key=KEY_SECRET)

    return conn.get_all_images(owners=['self'])

def filter_images(images, region, version, rc, arch):
    gp2_wanted_name = 'Fedora-Cloud-Base-{0}-{1}.{2}-hvm-{3}-gp2-0'.format(
        version,
        rc,
        arch,
        region)

    standard_wanted_name = \
        'Fedora-Cloud-Base-{0}-{1}.{2}-hvm-{3}-standard-0'.format(
            version,
            rc,
            arch,
            region)

    gp2_images = list(filter(lambda img: img.name == gp2_wanted_name, images))
    standard_images = list(
        filter(
            lambda img: img.name == standard_wanted_name,
            images))

    ret = {}

    if len(gp2_images) > 0:
        ret['gp2'] = gp2_images[0].id
    if len(standard_images) > 0:
        ret['standard'] = standard_images[0].id

    return ret

if __name__ == '__main__':
    # Figure out which AMIs we need
    with open(os.path.join(os.path.dirname(__file__), '..', 'release.yaml')) as data:
        r = yaml.safe_load(data)

        current_version = r['ga']['alt']['cloud']['release_number']
        current_rc = r['ga']['alt']['cloud']['rc_version']
        current_arches = r['ga']['alt']['cloud']['ec2_arches']

        need_beta = r['beta']['show']
        if need_beta:
            beta_version = r['beta']['alt']['cloud']['release_number']
            beta_rc = r['beta']['alt']['cloud']['rc_version']
            beta_arches = r['beta']['alt']['cloud']['ec2_arches']

    pool = Pool()
    images_for_region = {}
    for region in regions:
        images_for_region[region] = \
            pool.apply_async(get_images_for_region, (region,))

    pool.close()
    pool.join()

    # Now for every region, images_for_region[region] will be an AsyncResult
    # which we can call .get() on to resolve to a list of images.
    # We can then do a bunch of filters on it to massage it into a JSON blob.
    #
    # The blob keys in the following way:
    # fedora version -> arch -> region -> storage type

    json_blob = {}
    json_blob[current_version] = {}
    if need_beta:
        json_blob[beta_version] = {}

    # This gets pretty ugly. :(
    # The upside is that it's just filtering lists and should be fast-ish
    # (the slow part - hitting the AWS API - is already done)
    for region, res in images_for_region.items():
        images = res.get()
        for arch in current_arches:
            if arch not in json_blob[current_version]:
                json_blob[current_version][arch] = {}
            json_blob[current_version][arch][region] = filter_images(
                images,
                region,
                current_version,
                current_rc,
                arch)

        # Do it all again -- we can probably de-dupe a bit here
        if need_beta:
            for arch in current_arches:
                if arch not in json_blob[current_version]:
                    json_blob[current_version][arch] = {}
                json_blob[current_version][arch][region] = filter_images(
                    images,
                    region,
                    current_version,
                    current_rc,
                    arch)

    print(json.dumps(json_blob))
