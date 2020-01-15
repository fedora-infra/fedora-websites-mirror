#!/usr/bin/env bash
TRANS_TMP=$(mktemp -d)

git clone ssh://git@pagure.io/fedora-web/translations.git "$TRANS_TMP"
mkdir -p translations/
cp -R "$TRANS_TMP"/getfedora.org-redesign/* translations/
rm -rf "$TRANS_TMP"

pybabel compile -d translations
