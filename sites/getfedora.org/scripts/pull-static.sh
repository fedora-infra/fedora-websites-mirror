#!/usr/bin/env bash
python $(dirname $0)/pull-magazine.py

# In production, we want to build the current-ec2-amis.json ourselves
# and use it.
#
# In development builds, we just want to pull from the production one.
#
# This is because getting this list requires AWS API access.
if [[ "$FEDORA_DESCRIBE_IMAGES_AWS_KEY_ID" != ""
    && "$FEDORA_DESCRIBE_IMAGES_AWS_KEY_SECRET" != "" ]]; then
    tmp="$(mktemp)"
    python "$(dirname "$0")/ec2-images-json.py" > "$tmp" && mv "$tmp" "$(dirname "$0")/../static/current-ec2-amis.json"
else
    curl -o "$(dirname "$0")/../static/current-ec2-amis.json" https://getfedora.org/static/current-ec2-amis.json
fi
