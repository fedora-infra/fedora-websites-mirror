#!/usr/bin/env bash
pybabel extract -F ../babel.cfg -o getfedora.org.pot . ../partials/
echo
echo
echo 'If you have a valid ~/.config/zanata.ini, you may now run:'
echo '   zanata push getfedora.org.pot'
