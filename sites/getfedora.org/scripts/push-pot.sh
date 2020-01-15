#!/usr/bin/env bash

TRANS_TMP=$(mktemp -d)

git clone ssh://git@pagure.io/fedora-web/translations.git "$TRANS_TMP"

cp getfedora.org.pot "$TRANS_TMP"/getfedora.org-redesign/

pushd "$TRANS_TMP"

git add *.pot
git commit -m "update pot file for getfedora.org-redesign"
git push

popd

rm -rf "$TRANS_TMP"
