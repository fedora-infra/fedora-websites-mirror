#!/bin/bash
curl -s 'https://fedoramagazine.org/wp-json/wp/v2/posts?per_page=3' -o static/magazine.json
