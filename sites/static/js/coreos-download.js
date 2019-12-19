// Adapted from https://github.com/jlebon/fedora-coreos-browser.
//
// PROD:
//const baseUrl = 'https://builds.coreos.fedoraproject.org/streams'
// DEVEL:
//const baseUrl = 'https://s3.amazonaws.com/fcos-builds/streams'
const baseUrl = 'https://builds.coreos.fedoraproject.org/streams'
// list of cloud image artifacts
const cloudImages = ['aws', 'azure', 'aliyun', 'digitalocean', 'gcp', 'openstack', 'packet']
// list of virtualized image artifacts
const virtualizedImages = ['openstack', 'qemu', 'virtualbox', 'vmware']
// dict of pretty names for platforms, indexed by platform.extension
const prettyPlatforms = {
  "aws": "AWS",
  "azure": "Azure",
  "gcp": "GCP",
  "digitalocean": "DigitalOcean",
  "packet": "Packet",
  "aliyun": "Alibaba Cloud",
  "metal": {
    "raw.xz": "Raw",
    "iso": "ISO",
    "pxe": "PXE",
    "installer.iso": "Installer (ISO)",
    "installer-pxe": "Installer (PXE)"
  },
  "qemu": "QEMU",
  "virtualbox": "VirtualBox",
  "vmware": "VMware",
  "openstack": "OpenStack"
}
var data = {
  // currently selected stream
  stream: 'testing',
  // currently selected architecture
  architecture: 'x86_64',
  // current url to dir for stream
  streamUrl: "",
  // fetched {stream, metadata, architectures, updates} object from stream.json
  streamData: null,
  loading: false,
  // loaded stream data to render
  streamDisplay: {
    cloudLaunchable: {},
    bareMetal: {},
    virtualized: {},
    cloud: {}
  },
  // innerText of tab button
  tabInnerText: {
    cloud_launchable: "Cloud Launchable",
    metal_virt: "Bare Metal & Virtualized",
    cloud_operator: "For Cloud Operators"
  }
}
function getMember(obj, member) {
  return (member in obj) ? obj[member] : null;
}
function getFilename(url) {
  return url.substring(url.lastIndexOf('/') + 1);
}
function getArtifactUrl(base, path) {
  return `${base}/${path}`;
}
function fetchStreamData(base, stream) {
  return fetch(`${base}/${stream}.json`)
    .then(response => response.ok ? response.json() : {});
}
function getPrettyPlatform(platform, extension) {
  prettyPlatform = getMember(prettyPlatforms, platform);
  if (prettyPlatform != null) {
    // XXX: just check if the platform is metal, since metal is the only
    // platform that has different prettyPlatforms for each extension. This
    // check should be more generic and apply to other platforms.
    if (platform == "metal" && extension != null) {
      prettyPlatformExtension = getMember(prettyPlatforms[platform], extension);
      if (prettyPlatformExtension != null) {
        return prettyPlatformExtension;
      }
    }
    return prettyPlatform;
  }
  // Fall back and return the machine-readable platform name.
  return platform;
}
function getDownloadsFromFormat(formatData, downloads) {
  for (var download in formatData) {
    downloadData = formatData[download];
    entry = {location: downloadData.location, signature: downloadData.signature, sha256: downloadData.sha256, showSignatureAndSha: false};
    downloads[download] = entry;
  }
}
var jumbotron_buttons = new Vue ({
  el: '#jumbotron-buttons',
  data: data,
  methods: {
    toggleHidden: function(e) {
      const id_list = ['cloud-launchable', 'metal-virt', 'cloud-operator'];
      switch(e.target.innerText) {
        case data.tabInnerText.cloud_launchable:
          show_id = 'cloud-launchable';
          id_list.map(id => document.getElementById(id).hidden = (id !== show_id));
          break;
        case data.tabInnerText.metal_virt:
          show_id = 'metal-virt';
          id_list.map(id => document.getElementById(id).hidden = (id !== show_id));
          break;
        case data.tabInnerText.cloud_operator:
          show_id = 'cloud-operator';
          id_list.map(id => document.getElementById(id).hidden = (id !== show_id));
          break;
      }
    },
    getNavbar: function(h) {
      cloud_icon = h('i', { class: "fas fa-cloud mr-2" })
      nav_cloud_launchable_btn = h('button', { class: "nav-link active col-12 h-100 overflow-hidden", attrs: { "data-toggle": "tab" }, on: { click: this.toggleHidden } }, [ cloud_icon, data.tabInnerText.cloud_launchable ]);
      nav_cloud_launchable = h('li', { class: "nav-item col-4" }, [ nav_cloud_launchable_btn ]);

      server_icon = h('i', { class: "fas fa-server mr-2" })
      nav_metal_virt_btn = h('button', { class: "nav-link col-12 h-100 overflow-hidden", attrs: { "data-toggle": "tab" }, on: { click: this.toggleHidden } }, [ server_icon, data.tabInnerText.metal_virt ]);
      nav_metal_virt = h('li', { class: "nav-item col-4" }, [ nav_metal_virt_btn ]);

      cloud_upload_icon = h('i', { class: "fas fa-cloud-upload-alt mr-2" })
      nav_cloud_operator_btn = h('button', { class: "nav-link col-12 h-100 overflow-hidden", attrs: { "data-toggle": "tab" }, on: { click: this.toggleHidden } }, [ cloud_upload_icon, data.tabInnerText.cloud_operator ]);
      nav_cloud_operator = h('li', { class: "nav-item col-4" }, [ nav_cloud_operator_btn ]);

      navbar = h('ul', { class: "nav nav-tabs" }, [ nav_cloud_launchable, nav_metal_virt, nav_cloud_operator ]);
      container = h('div', { class: "container" }, [ navbar ]);
      return container
    }
  },
  render: function(h) {
    navbar = this.getNavbar(h);
    return navbar
  }
})
var coreos_download_app = new Vue({
  el: '#coreos-download-app',
  created: function() { this.refreshStream() },
  data: data,
  watch: { 'data.stream': 'refreshStream' },
  methods: {
    getObjectUrl: function(path) {
      return getArtifactUrl(data.streamUrl, path);
    },
    isAws: function(platform) {
      return platform == "aws";
    },
    isVirtualizedImage: function(platform) {
      return virtualizedImages.includes(platform);
    },
    isCloudImage: function(platform) {
      return cloudImages.includes(platform);
    },
    isBareMetalImage: function(platform) {
      return platform == "metal";
    },
    // Load stream information to display. Note that `loadStreamDisplay` does
    // not deep-copy information from `streamData` or elsewhere into
    // `streamDisplay`.
    loadStreamDisplay: function() {
      data.streamDisplay = {
        cloudLaunchable: {},
        bareMetal: {},
        virtualized: {},
        cloud: {}
      };
      if (data.streamData == null) {
        return;
      }
      const architectures = getMember(data.streamData, "architectures");
      if (architectures == null) {
        return;
      }
      const architectureData = getMember(architectures, data.architecture);
      if (architectureData == null) {
        return;
      }
      const images = getMember(architectureData, "images");
      if (images == null) {
        return;
      }
      for (var platform in images) {
        const prettyPlatform = getPrettyPlatform(platform, null);
        if (this.isAws(platform)) {
          const regions = getMember(images[platform], "regions");
          displayEntries = [];
          if (regions) {
            for (var region in regions) {
              const release = getMember(regions[region], "release");
              const image = getMember(regions[region], "image");
              displayEntries.push({platform: prettyPlatform, region: region, release: release, image: image});
            }
          }
          Vue.set(data.streamDisplay.cloudLaunchable, platform, {list: displayEntries});
        }
        else {
          const image = getMember(images[platform], "image");
          Vue.set(data.streamDisplay.cloudLaunchable, platform, {platform: prettyPlatform, image: image});
        }
      }
      const artifacts = getMember(architectureData, "artifacts");
      if (artifacts == null) {
        return;
      }
      for (var platform in artifacts) {
        const release = getMember(artifacts[platform], "release");
        const formats = getMember(artifacts[platform], "formats");
        if (formats) {
          for (var format in formats) {
            const prettyPlatform = getPrettyPlatform(platform, format);
            // XXX: the conditions to display the extension here are quickly
            // hacked in; if adding any further conditions this should be
            // handled elsewhere in a better organized structure.
            const extension = (format == "pxe" || format == "installer-pxe") ? null : ((format != "installer.iso") ? format : ".iso");

            function addDisplayEntry(display, platform, format, formats, release, prettyPlatform, extension) {
              downloads = {};
              getDownloadsFromFormat(formats[format], downloads);
              displayEntry = {platform: prettyPlatform, release: release, downloads: downloads, extension: extension, showSignatureAndSha: false};
              Vue.set(display, platform + "-" + format, displayEntry);
            }
            if (this.isCloudImage(platform)) {
              addDisplayEntry(data.streamDisplay.cloud, platform, format, formats, release, prettyPlatform, extension);
            }
            if (this.isVirtualizedImage(platform)) {
              addDisplayEntry(data.streamDisplay.virtualized, platform, format, formats, release, prettyPlatform, extension);
            }
            if (this.isBareMetalImage(platform)) {
              addDisplayEntry(data.streamDisplay.bareMetal, platform, format, formats, release, prettyPlatform, extension);
            }
          }
        }
      }
    },
    refreshStream: function() {
      data.loading = true
      data.streamUrl = baseUrl
      fetchStreamData(data.streamUrl, data.stream).then(streamData => {
        data.loading = false;
        data.streamData = streamData;
        this.loadStreamDisplay();
      });
    },
    toggleShowSignatureAndSha: function(imageType, platformFormat, contentType) {
      if (!(platformFormat in data.streamDisplay[imageType])) {
        return;
      }
      const artifact = data.streamDisplay[imageType][platformFormat];
      if (!(contentType in artifact.downloads)) {
        return;
      }
      var prev = artifact.downloads[contentType].showSignatureAndSha;
      artifact.downloads[contentType].showSignatureAndSha = !prev;
    },
    showSignatureAndSha: function(imageType, platformFormat, contentType) {
      if (!(platformFormat in data.streamDisplay[imageType])) {
        return false;
      }
      const artifact = data.streamDisplay[imageType][platformFormat];
      if (!(contentType in artifact.downloads)) {
        return false;
      }
      return artifact.downloads[contentType].showSignatureAndSha;
    },
    // Adapted from https://stackoverflow.com/a/6109105
    timeSince: function(rfc3339_timestamp) {
      var current = Date.now();
      var timestamp = Date.parse(rfc3339_timestamp);
      var elapsed = current - timestamp;
      var msPerMinute = 60 * 1000;
      var msPerHour = msPerMinute * 60;
      var msPerDay = msPerHour * 24;
      var msPerMonth = msPerDay * 30;
      var msPerYear = msPerDay * 365;
      function stringize(n, s) {
        return n + ` ${s}` + (n == 1 ? "" : "s") + ' ago';
      };
      if (elapsed < msPerMinute) {
        return stringize(Math.floor(elapsed/1000), "second");
      } else if (elapsed < msPerHour) {
        return stringize(Math.floor(elapsed/msPerMinute), "minute");
      } else if (elapsed < msPerDay) {
        return stringize(Math.floor(elapsed/msPerHour), "hour");
      } else if (elapsed < msPerMonth) {
        return stringize(Math.floor(elapsed/msPerDay), "day");
      } else if (elapsed < msPerYear) {
        return stringize(Math.floor(elapsed/msPerMonth), "month");
      } else {
        return stringize(Math.floor(elapsed/msPerYear), "year");
      }
    }
  },
  render: function(h) {
    if (data.loading) {
      return h('div', {}, "Loading...");
    }
    else if (data.streamData) {
      streamName = h('p', {}, [
        "Stream: ",
        h('span', { "class":"font-weight-bold" }, data.streamData.stream),
        " (",
        h('span', {}, [
          h('a', { attrs: { href: this.getObjectUrl(data.streamData.stream + '.json') } }, "JSON")
        ]),
        ")",
        "—",
        h('span', {}, this.timeSince(data.streamData.metadata['last-modified']))
      ]);

      cloudLaunchableTitle = h('h3', { class:"font-weight-light" }, "Cloud Launchable");
      cloudLaunchableSection = {};
      cloudLaunchable = {};
      virtualizedTitle = h('h3', { class:"font-weight-light" }, "Virtualized");
      virtualizedSection = {};
      virtualized = {};
      bareMetalTitle = h('h3', { class:"font-weight-light" }, "Bare Metal");
      bareMetalSection = {};
      bareMetal = {};
      cloudTitle = h('h3', { class:"font-weight-light" }, "For Cloud Operators");
      cloudSection = {};
      cloud = {};

      if (data.streamDisplay.cloudLaunchable) {
        cloudLaunchableSection = h('div', {}, Object.entries(data.streamDisplay.cloudLaunchable).map(function(entry) {
          platform = entry[0];
          displayInfo = entry[1];
          if (coreos_download_app.isAws(platform)) {
            if (displayInfo.list) {
              return h('div', {}, displayInfo.list.map(function(amiInfo) {
                return h('div', { class: "p-2 m-2" }, [
                  amiInfo.platform ? h('div', { class: "font-weight-bold" }, amiInfo.platform) : null,
                  amiInfo.region ? h('div', {}, [ "(", amiInfo.region, ")" ]) : null,
                  amiInfo.release ? h('div', { class: "ml-2" }, [
                    h('span', {}, [ amiInfo.release, " " ]),
                    h('span', { class: "text-secondary" }, data.streamData.stream)
                  ]) : null,
                  amiInfo.image ? h('div', { class: "ml-2" }, [
                    h('a', {
                      attrs: {
                        href: "https://console.aws.amazon.com/ec2/home?region=" + amiInfo.region + "#launchAmi=" + amiInfo.image
                      }
                    }, amiInfo.image)
                  ]) : null
                ])
              }));
            }
          }
          else {
            return h('div', {}, [
              displayInfo.platform ? h('div', { class: "font-weight-bold" }, displayInfo.platform) : null,
              displayInfo.image ? h('div', { class: "ml-2" }, displayInfo.image) : null
            ]);
          }
        }));
      }
      else {
        cloudLaunchableSection = h('div', {}, "No cloud launchable images found.");
      }
      cloudLaunchable = h('div', { class: "col-12 py-2 my-2" }, [ cloudLaunchableSection ]);

      function createDownloadsSubSection(displayDownloads, contentType, showTitle, imageType) {
        return displayDownloads ? h('div', { class: "pb-2" }, [
          showTitle ? h('span', {}, contentType + ": ") : null,
          displayDownloads.location ? h('span', {}, [
            h('a', { attrs: { href: displayDownloads.location } }, "Download")
          ]) : null,
          h('div', {}, [
            h('button', {
              on: {
                click: function(e) {
                  if (e.target !== e.currentTarget) {
                    return;
                  }
                  else {
                    coreos_download_app.toggleShowSignatureAndSha(imageType,e.target.attributes.platformFormat.value, contentType);
                    e.stopPropagation();
                    e.preventDefault();
                  }
                }
              },
              class: "btn btn-sm btn-outline-fedora-magenta mt-2",
              attrs: {
                platformFormat: platformFormat
              }
            }, "Verify signature & SHA256")
          ]),
          coreos_download_app.showSignatureAndSha(imageType, platformFormat, contentType) ? h('div', { class: "bg-gray-100 p-2 my-2" }, [ h('p', {}, [
              displayDownloads.sha256 ? h('div', { class: "overflow-auto" }, [
                "SHA256: ",
                displayDownloads.sha256
              ]) : null,
              displayDownloads.sha256 ? h('div', {}, [
                h('a', {
                  attrs: {
                    href: "data:text/plain;charset=utf-8," + encodeURIComponent("SHA256 (" + getFilename(displayDownloads.location) + ") = " + displayDownloads.sha256),
                    download: getFilename(displayDownloads.location) + "-CHECKSUM"
                  }
                }, "Checksum file")
              ]) : null,
              displayDownloads.signature ? h('div', {}, [
                h('a', {
                  attrs: {
                    href: displayDownloads.signature
                  }
                }, "Signature")
              ]) : null
            ]),
            h('div', {}, [
              h('p', {}, "To verify your download:"),
              h('ol', {}, [
                h('li', {}, [
                  h('p', {}, "Import Fedora's GPG keys"),
                  h('pre', {}, [ h('code', {}, "curl https://getfedora.org/static/fedora.gpg | gpg --import") ])
                ]),
                h('li', {}, [
                  h('p', {}, "Verify the signature is valid"),
                  h('pre', {}, [ h('code', {}, "gpg --verify " + getFilename(displayDownloads.signature) + " " + getFilename(displayDownloads.location)) ])
                ]),
                h('li', {}, [
                  h('p', {}, "Verify the checksum matches"),
                  h('pre', {}, [ h('code', {}, "sha256sum -c " + getFilename(displayDownloads.location) + "-CHECKSUM") ])
                ])
              ])
            ])
          ]) : null
        ]) : null
      }
      function createArtifactsSection(displayArtifacts, imageType) {
        return h('div', {}, Object.entries(displayArtifacts).map(function(entry) {
          platformFormat = entry[0];
          displayInfo = entry[1];
          return h('div', { class: "p-2 m-2" }, [
            displayInfo.platform ? h('div', { class: "font-weight-bold" }, displayInfo.platform) : null,
            displayInfo.extension ? h('div', {}, [ "(", displayInfo.extension, ")" ]) : null,
            displayInfo.release ? h('div', { class: "ml-2" }, [
              h('span', {}, [ displayInfo.release, " " ]),
              h('span', { class: "text-secondary" }, data.streamData.stream)
            ]) : null,
            displayInfo.downloads ? h('div', { class: "ml-2" }, [
              createDownloadsSubSection(displayInfo.downloads.disk, 'disk', false, imageType),
              createDownloadsSubSection(displayInfo.downloads.kernel, 'kernel', true, imageType),
              createDownloadsSubSection(displayInfo.downloads.initramfs, 'initramfs', true, imageType)
            ]) : null
          ]);
        }));
      }
      if (data.streamDisplay.bareMetal) {
        bareMetalSection = createArtifactsSection(data.streamDisplay.bareMetal, 'bareMetal');
      }
      else {
        bareMetalSection = h('div', {}, "No bare metal images found.");
      }
      bareMetal = h('div', { class: "col-12 py-2 my-2" }, [ bareMetalSection ]);

      if (data.streamDisplay.virtualized) {
        virtualizedSection = createArtifactsSection(data.streamDisplay.virtualized, 'virtualized');
      }
      else {
        virtualizedSection = h('div', {}, "No virtualized images found.");
      }
      virtualized = h('div', { class: "col-12 py-2 my-2" }, [ virtualizedSection ]);

      if (data.streamDisplay.cloud) {
        cloudSection = createArtifactsSection(data.streamDisplay.cloud, 'cloud');
      }
      else {
        cloudSection = h('div', {}, "No cloud images found.");
      }
      cloud = h('div', { class: "col-12 py-2 my-2" }, [ cloudSection ]);

      verifyBlurb = h('div', {}, [
        h('div', { class:"font-weight-light" }, [
          "Verify your download using the detached signature after importing ",
          h('a', { attrs: { href: "https://getfedora.org/security/" } }, "Fedora's GPG signing keys"),
          ". The detached signature is for the released artifact itself. If there is a good signature from one of the Fedora keys, and the SHA256 checksum matches, then the download is valid."
        ])
      ]);

      let bare_metal_container = h('div', { class: "col-6" }, [ bareMetalTitle, verifyBlurb, bareMetal ]);
      let virtualized_container = h('div', { class: "col-6" }, [ virtualizedTitle, verifyBlurb, virtualized ]);

      let cloud_launchable_container = h('div', { class: "col-12 py-2 my-2", attrs: { id: "cloud-launchable", hidden: false} }, [ cloudLaunchableTitle, streamName, cloudLaunchable ]);
      let metal_virt_container = h('div', { class: "row col-12 py-2 my-2", attrs: { id: "metal-virt", hidden: true } }, [ bare_metal_container, virtualized_container ]);
      let cloud_operators_container = h('div', { class: "col-12 py-2 my-2", attrs: { id: "cloud-operator", hidden: true } }, [ cloudTitle, verifyBlurb, cloud ]);

      return h('div', {}, [
        cloud_launchable_container,
        metal_virt_container,
        cloud_operators_container
      ]);
    }
    else {
      return h('div', {}, "No stream data found!");
    }
  }
})
