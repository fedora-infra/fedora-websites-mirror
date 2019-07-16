// PROD:
//const baseUrl = 'https://builds.coreos.fedoraproject.org/streams'
// DEVEL:
//const baseUrl = 'https://s3.amazonaws.com/fcos-builds/streams'
const baseUrl = 'https://builds.coreos.fedoraproject.org/streams'
// list of cloud image artifacts
const cloudImages = ['aws', 'azure', 'digitalocean', 'gcp', 'openstack', 'packet']
// list of virtualized image artifacts
const virtualizedImages = ['openstack', 'qemu', 'virtualbox', 'vmware']
// dict of pretty names for providers, indexed by provider.extension
const prettyProviders = {
  "aws": "AWS",
  "azure": "Azure",
  "gcp": "GCP",
  "digitalocean": "DigitalOcean",
  "packet": "Packet",
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
function getMember(obj, member) {
  return (member in obj) ? obj[member] : null;
}
function getArtifactUrl(base, path) {
  return `${base}/${path}`;
}
function fetchStreamData(base, stream) {
  return fetch(`${base}/${stream}.json`)
    .then(response => response.ok ? response.json() : {});
}
function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
}
function getPrettyProvider(provider, extension) {
  prettyProvider = getMember(prettyProviders, provider);
  if (prettyProvider != null) {
    // XXX: just check if the provider is metal. This check should be more generic and apply to other providers.
    if (provider == "metal" && extension != null) {
      prettyProviderExtension = getMember(prettyProviders[provider], extension);
      if (prettyProviderExtension != null) {
        return prettyProviderExtension;
      }
    }
    return prettyProvider;
  }
  // Fall back and return the machine-readable provider name.
  return provider;
}
var app = new Vue({
  el: '#app',
  data: {
    // currently selected stream
    stream: 'testing',
    // currently selected architecture
    architecture: 'x86_64',
    // current url to dir for stream
    streamUrl: "",
    // fetched {stream, metadata, architectures, updates} object from stream.json
    streamData: null,
    loading: false,
    // record of signature and sha to display
    signatureAndShaDisplay: {
      "bareMetal": {
        "metal": {
          "raw.xz": {
            "disk": false
          },
          // XXX: temporary measure for current testing.json; should be fixed in later versions of testing.json.
          "raw": {
            "disk": false
          },
          "iso": {
            "disk": false
          },
          "pxe": {
            "kernel": false,
            "initramfs": false
          },
          "installer.iso": {
            "disk": false
          },
          "installer-pxe": {
            "kernel": false,
            "initramfs": false
          }
        }
      },
      "virtualized": {
        "openstack": {
          "qcow2.xz": {
            "disk": false
          },
          // XXX: temporary measure for current testing.json; should be fixed in later versions of testing.json.
          "qcow2": {
            "disk": false
          },
          "qcow.xz": {
            "disk": false
          }
        },
        "qemu": {
          "qcow2.xz": {
            "disk": false
          },
          // XXX: temporary measure for current testing.json; should be fixed in later versions of testing.json.
          "qcow2": {
            "disk": false
          },
          "qcow.xz": {
            "disk": false
          }
        },
        "virtualbox": {
          "ova": {
            "disk": false
          }
        },
        "vmware": {
          "ova": {
            "disk": false
          }
        }
      },
      "cloud": {
        "aws": {
          "vmdk.xz": {
            "disk": false
          }
        },
        "azure": {
          "vdi.xz": {
            "disk": false
          }
        },
        "digitalocean": {
          "raw.xz": {
            "disk": false
          },
          // XXX: temporary measure for current testing.json; should be fixed in later versions of testing.json.
          "raw": {
            "disk": false
          }
        },
        "gcp": {
          "tar.gz": {
            "disk": false
          }
        },
        "openstack": {
          "qcow2.xz": {
            "disk": false
          },
          // XXX: temporary measure for current testing.json; should be fixed in later versions of testing.json.
          "qcow2": {
            "disk": false
          },
          "qcow.xz": {
            "disk": false
          }
        },
        "packet": {
          "raw.xz": {
            "disk": false
          },
          // XXX: temporary measure for current testing.json; should be fixed in later versions of testing.json.
          "raw": {
            "disk": false
          }
        }
      }
    }
  },
  created: function() { this.refreshStream() },
  watch: { stream: 'refreshStream' },
  methods: {
    refreshStream: function() {
      this.loading = true
      this.streamUrl = baseUrl
      fetchStreamData(this.streamUrl, this.stream).then(streamData => {
        this.loading = false;
        this.streamData = streamData;
      });
    },
    getObjectUrl: function(path) {
      return getArtifactUrl(this.streamUrl, path);
    },
    isAws(provider) {
      return provider == "aws";
    },
    isVirtualizedImage: function(provider) {
      return virtualizedImages.includes(provider);
    },
    isCloudImage: function(provider) {
      return cloudImages.includes(provider);
    },
    toggleShowSignatureAndSha: function(section, provider, extension, content) {
      // XXX: hack for now until better code structure is implemented
      if (!(section in this.signatureAndShaDisplay &&
            provider in this.signatureAndShaDisplay[section] &&
            extension in this.signatureAndShaDisplay[section][provider] &&
            content in this.signatureAndShaDisplay[section][provider][extension]))
        {
          return;
        }
      var prev = this.signatureAndShaDisplay[section][provider][extension][content];
      this.signatureAndShaDisplay[section][provider][extension][content] = !prev;
    },
    showSignatureAndSha: function(section, provider, extension, content) {
      // XXX: hack for now until better code structure is implemented
      if (!(section in this.signatureAndShaDisplay &&
            provider in this.signatureAndShaDisplay[section] &&
            extension in this.signatureAndShaDisplay[section][provider] &&
            content in this.signatureAndShaDisplay[section][provider][extension]))
        {
          return false;
        }
      return this.signatureAndShaDisplay[section][provider][extension][content];
    },
    displayPrettyProvider: function(provider, extension) {
      return getPrettyProvider(provider, extension);
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
  }
})
