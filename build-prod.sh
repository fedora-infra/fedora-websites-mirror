#!/bin/bash -e
PYBINARY="python"
SKIPTRANS="no"

while true
do
	case "$1" in
	--py3)
		PYBINARY="python3"
		shift
		;;
	--skip-trans)
		SKIPTRANS="yes"
		shift
		;;
	*)
		break 2
		;;
	esac
done

if [ ! "$#" -eq 1 -o ! -d "$1" ];
then
	echo "Usage: $0 [--py3] [--skip-trans] <output-dir>"
	exit 1
fi
OUTDIR="$1"

echo "Building with: ${PYBINARY}, skipping translations: ${SKIPTRANS}, into: ${OUTDIR}"

set -x
for site in getfedora.org
do
	echo "Building ${site}"
	(
		cd sites/${site}
		if [ "$SKIPTRANS" == "no" ];
		then
			./scripts/pull-translations.sh
		fi
		if [ -x ./scripts/pull-static.sh ];
		then
			./scripts/pull-static.sh
		fi

		${PYBINARY} main.py
		# This intermediate step is to make sure the final mv is atomic.
		# This means that syncs can happen at any point in time and they have a larger chance to be fine.
		rm -rf ${OUTDIR}/${site}.new
		mv build ${OUTDIR}/${site}.new
		rm -rf ${OUTDIR}/${site}.old
		mv --no-target-directory ${OUTDIR}/${site} ${OUTDIR}/${site}.old
		mv --no-target-directory ${OUTDIR}/${site}.new ${OUTDIR}/${site}
	)
done
