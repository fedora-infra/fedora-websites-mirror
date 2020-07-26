import requests
import sys

def iot_compose_links(version):
  BASEURL = 'https://dl.fedoraproject.org/pub/alt/iot/' + str(version) + '/'
  json = requests.get(BASEURL + '/metadata/images.json').json()
  date = json['payload']['compose']['date']
  links = {}
  links['date'] = date[0:4] + '-' + date[4:6] + '-' + date[6:8]
  links['type'] = {}

  for arch,lst in json['payload']['images']['IoT'].items():
    for img in lst:
      if img['type'] not in links['type'].keys():
          links['type'][img['type']] = {}
      links['type'][img['type']][img['arch']] = BASEURL + img['path']
  return links