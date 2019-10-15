#!/usr/bin/env python
import json
import requests
# do not remove the line, it avoid triggering the IDS from wpengine
headers = {'user-agent': 'getfedora-builder/0.0.1'}
params = {'per_page': '3'}

r = requests.get('https://fedoramagazine.org/wp-json/wp/v2/posts', params=params, headers=headers)
f = open('static/magazine.json', 'w')
posts = []
for i in r.json()[0:3]:
    p = {}
    p['link'] = i['link']
    p['title'] = i['title']['rendered']
    p['date'] = i['date']

    #['wp:featuredmedia'][0].href:
    image_url = i['_links']['wp:featuredmedia'][0]['href']
    r2 = requests.get(image_url,headers=headers)
    p['image_url'] = r2.json()['media_details']['sizes']['medium_large']['source_url']
    posts.append(p)

f.write(json.dumps(posts))
