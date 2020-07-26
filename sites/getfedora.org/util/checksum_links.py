import requests
import sys

def checksum_links_iot(version):
  BASEURL = 'https://dl.fedoraproject.org/pub/alt/iot/' + str(version) + '/'
  json = requests.get(BASEURL + '/metadata/images.json').json()
  date = json['payload']['compose']['date']
  links = {}

  for arch,lst in json['payload']['images']['IoT'].items():
    links[arch] = {}
    links[arch]['ISO'] = 'https://dl.fedoraproject.org/pub/alt/iot/' + str(version) + '/IoT/' + arch + '/iso/Fedora-IoT-IoT-' + str(version) + '-' + arch + '-' + date + '.0-CHECKSUM'
    if(arch!= 'armhfp'):
      links[arch]['Raw Image'] = 'https://dl.fedoraproject.org/pub/alt/iot/' + str(version) + '/IoT/' + arch + '/images/Fedora-IoT-IoT-' + str(version) + '-' + arch + '-' + date + '.0-CHECKSUM'
  return links