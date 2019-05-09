#!/usr/bin/env bash
zanata pull --transdir translations
for file in translations/*.po; do
  mkdir -p $(echo $file | sed 's/\.po//')/LC_MESSAGES
  mv $file $(echo $file | sed 's/\.po//')/LC_MESSAGES/messages.po
done
pybabel compile -d translations
