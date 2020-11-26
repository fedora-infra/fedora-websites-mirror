#!/usr/bin/env bash
#pybabel extract -F ../babel.cfg -o getfedora.org.pot . ../partials/
pybabel extract -F ../../babel.cfg -o getfedora.org.pot ../../partials ../../getfedora.org/site ../../getfedora.org/partials
echo
echo
echo 'If you have write access to https://pagure.io/fedora-web/translations, you may now run:'
echo './scripts/push-pot.sh'
