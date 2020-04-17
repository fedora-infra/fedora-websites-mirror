// Adapted from https://github.com/jlebon/fedora-coreos-browser.
//
// PROD:
//const baseUrl = 'https://builds.coreos.fedoraproject.org/streams'
// DEVEL:
//const baseUrl = 'https://s3.amazonaws.com/fcos-builds/streams'
const baseUrl = 'https://builds.coreos.fedoraproject.org/streams'
// list of cloud image artifacts
const cloudImages = ['aws', 'azure', 'aliyun', 'digitalocean', 'exoscale', 'gcp', 'openstack', 'packet']
// list of virtualized image artifacts
const virtualizedImages = ['openstack', 'qemu', 'virtualbox', 'vmware']
// dict of pretty names for platforms, indexed by platform.extension
const prettyPlatforms = {
  "aws": "AWS",
  "azure": "Azure",
  "gcp": "GCP",
  "digitalocean": "DigitalOcean",
  "exoscale": "Exoscale",
  "packet": "Packet",
  "aliyun": "Alibaba Cloud",
  "metal": {
    "raw.xz": "Raw",
    "4k.raw.xz": "Raw (4k Native)",
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
// innerText of tab button
const tabInnerText = {
  "cloud_launchable": "Cloud Launchable",
  "metal_virtualized": "Bare Metal & Virtualized",
  "cloud_operators": "For Cloud Operators"
}
// frequently used IDs
const IdPool = {
  "cloud_launchable": "cloud-launchable",
  "metal_virtualized": "metal-virtualized",
  "cloud_operators": "cloud-operators"
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
    entry = {location: downloadData.location, signature: downloadData.signature, sha256: downloadData.sha256};
    downloads[download] = entry;
  }
}
var coreos_download_app = new Vue({
  el: '#coreos-download-app',
  created: function() { this.refreshStream() },
  data: {
    // currently shown tab
    shownId: IdPool.cloud_launchable,
    // currently selected stream
    stream: 'stable',
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
  },
  watch: { stream: function() {
    this.refreshStream();
  } },
  methods: {
    getObjectUrl: function(path) {
      return getArtifactUrl(this.streamUrl, path);
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
    },
    toggleHidden: function(e) {
      const id_list = Object.values(IdPool);
      Object.entries(tabInnerText).map(pair => {
        const key = pair[0];
        const val = pair[1];
        if (val === e.target.innerText) {
          const downloadPageUrl = window.location.href.match(/^.*\/coreos\/download/)[0];
          history.pushState(null, null, `${downloadPageUrl}?tab=${key}&stream=${coreos_download_app.stream}`);
          const show_id = IdPool[key];
          id_list.map(id => document.getElementById(id).hidden = (id !== show_id));
          this.shownId = show_id;
        }
      });
    },
    getNavbar: function(h) {
      cloud_icon = h('i', { class: "fas fa-cloud mr-2" })
      nav_cloud_launchable_btn = h('button', { class: "nav-link col-12 h-100 overflow-hidden".concat(this.shownId === IdPool.cloud_launchable ? " active" : ""), attrs: { "data-toggle": "tab" }, on: { click: this.toggleHidden } }, [ cloud_icon, tabInnerText.cloud_launchable ]);
      nav_cloud_launchable = h('li', { class: "nav-item col-4" }, [ nav_cloud_launchable_btn ]);

      server_icon = h('i', { class: "fas fa-server mr-2" })
      nav_metal_virt_btn = h('button', { class: "nav-link col-12 h-100 overflow-hidden".concat(this.shownId === IdPool.metal_virtualized ? " active" : ""), attrs: { "data-toggle": "tab" }, on: { click: this.toggleHidden } }, [ server_icon, tabInnerText.metal_virtualized ]);
      nav_metal_virt = h('li', { class: "nav-item col-4" }, [ nav_metal_virt_btn ]);

      cloud_upload_icon = h('i', { class: "fas fa-cloud-upload-alt mr-2" })
      nav_cloud_operators_btn = h('button', { class: "nav-link col-12 h-100 overflow-hidden".concat(this.shownId === IdPool.cloud_operators ? " active" : ""), attrs: { "data-toggle": "tab" }, on: { click: this.toggleHidden } }, [ cloud_upload_icon, tabInnerText.cloud_operators ]);
      nav_cloud_operators = h('li', { class: "nav-item col-4" }, [ nav_cloud_operators_btn ]);

      navbar = h('ul', { class: "nav nav-tabs" }, [ nav_cloud_launchable, nav_metal_virt, nav_cloud_operators ]);
      return navbar;
    },
    // Add dropdown options of streams
    getStreamName: function(h) {
      const self = this;
      if (this.streamData === null) return;
      option_stable = h('option', { attrs: { value: "stable", selected: this.stream === "stable" ? "selected" : null }}, "stable");
      option_testing = h('option', { attrs: { value: "testing", selected: this.stream === "testing" ? "selected" : null }}, "testing");
      option_next = h('option', { attrs: { value: "next", selected: this.stream === "next" ? "selected" : null }}, "next");
      selectOptions = h('select', {
        class: "mx-1",
        on: {
          change: function(e) {
            const downloadPageUrl = window.location.href.match(/^.*\/coreos\/download/)[0];
            const currentShownKey = Object.keys(IdPool).find(key => IdPool[key] === self.shownId);
            coreos_download_app.stream = e.target.value;
            history.pushState(null, null, `${downloadPageUrl}?tab=${currentShownKey}&stream=${coreos_download_app.stream}`);
          }
        }
      }, [
        option_stable,
        option_testing,
        option_next
      ]);
      streamName = h('p', {}, [
        "Stream: ",
        selectOptions,
        " (",
        h('span', {}, [
          h('a', { attrs: { href: this.getObjectUrl(this.stream + '.json') } }, "JSON")
        ]),
        ")",
        (this.streamData.metadata) ? "—" : null,
        (this.streamData.metadata) ? h('span', {}, this.timeSince(this.streamData.metadata['last-modified'])) : null
      ]);
      return streamName;
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
      this.streamDisplay = {
        cloudLaunchable: {},
        bareMetal: {},
        virtualized: {},
        cloud: {}
      };
      if (this.streamData == null) {
        return;
      }
      const architectures = getMember(this.streamData, "architectures");
      if (architectures == null) {
        return;
      }
      const architectureData = getMember(architectures, this.architecture);
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
            // put 'us', 'eu', and 'ap' first since those are the cheapest and
            // most popular; then everything else
            const continentOrdering = ["us", "eu", "ap"];
            displayEntries = displayEntries.sort(function(a, b) {
                const aIdx = continentOrdering.indexOf(a.region.slice(0, 2));
                const bIdx = continentOrdering.indexOf(b.region.slice(0, 2));
                if (aIdx == bIdx) {
                    return a.region.localeCompare(b.region);
                } else if (aIdx == -1) {
                    return 1;
                } else if (bIdx == -1){
                    return -1;
                } else {
                    return aIdx - bIdx;
                }
            });
          }
          Vue.set(this.streamDisplay.cloudLaunchable, platform, {list: displayEntries});
        }
        else {
          const image = getMember(images[platform], "image");
          Vue.set(this.streamDisplay.cloudLaunchable, platform, {platform: prettyPlatform, image: image});
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
          prettyFormats = [];
          // in the case where each individual format has a separate pretty
          // name, we want the artifacts listed in alphabetical order
          for (var format in formats) {
              pretty = getPrettyPlatform(getPrettyPlatform(platform, format));
              prettyFormats.push({format: format, pretty: pretty});
          }
          prettyFormats.sort(function(a, b) { return a.pretty.localeCompare(b.pretty); });
          for (i = 0; i < prettyFormats.length; i++) {
            const format = prettyFormats[i].format;
            const prettyPlatform = prettyFormats[i].pretty;

            // XXX: the conditions to display the extension here are quickly
            // hacked in; if adding any further conditions this should be
            // handled elsewhere in a better organized structure.
            const extension = (format == "pxe" || format == "installer-pxe") ? null : ((format != "installer.iso") ? format : ".iso");

            function addDisplayEntry(display, platform, format, formats, release, prettyPlatform, extension) {
              downloads = {};
              getDownloadsFromFormat(formats[format], downloads);
              displayEntry = {platform: prettyPlatform, release: release, downloads: downloads, extension: extension};
              Vue.set(display, platform + "-" + format, displayEntry);
            }
            if (this.isCloudImage(platform)) {
              addDisplayEntry(this.streamDisplay.cloud, platform, format, formats, release, prettyPlatform, extension);
            }
            if (this.isVirtualizedImage(platform)) {
              addDisplayEntry(this.streamDisplay.virtualized, platform, format, formats, release, prettyPlatform, extension);
            }
            if (this.isBareMetalImage(platform)) {
              addDisplayEntry(this.streamDisplay.bareMetal, platform, format, formats, release, prettyPlatform, extension);
            }
          }
        }
      }
    },
    refreshStream: function() {
      this.loading = true
      this.streamUrl = baseUrl
      fetchStreamData(this.streamUrl, this.stream).then(streamData => {
        this.loading = false;
        this.streamData = Object.entries(streamData).length === 0 && streamData.constructor === Object ? null : streamData;
        this.loadStreamDisplay();
      });
    },
    getSignatureAndShaModal: function(h) {
      return h('div', { class: "modal", attrs: { id: "signatureAndShaModal", tabindex: "-1", role: "dialog", "aria-labelledby": "signatureAndShaModalLabel", "aria-hidden": "true" }}, [
        h('div', { class: "modal-dialog modal-lg modal-dialog-centered", attrs: { role: "document" }}, [
          h('div', { class: "modal-content" }, [
            h('div', { class: "modal-header" }, [
              h('h5', { class: "modal-title", attrs: { id: "signatureAndShaModalTitle" }}, [
                "Verify signature & SHA256"
              ]),
              h('button', { class: "close", attrs: { type: "button", "data-dismiss": "modal", "aria-label": "Close" }}, [
                h('span', { attrs: { "aria-hidden": "true" }}, [ "×" ])
              ])
            ]),
            h('div', { class: "modal-body", attrs: { id: "modal-body" }}, [ "Loading..." ]),
            h('div', { class: "modal-footer" }, [
              h('button', { class: "btn btn-secondary", attrs: { type: "button", "data-dismiss": "modal" }}, [
                "Close"
              ])
            ])
          ])
        ])
      ])
    }
  },
  render: function(h) {
    const downloadPageUrl = window.location.href.match(/^.*\/coreos\/download/)[0];
    searchParams = new URLSearchParams(window.location.search);
    // switch to specified tab if `tab` parameter is set
    if (searchParams.has('tab')) {
      switch(searchParams.get('tab')) {
        case 'cloud_launchable':
          this.shownId = IdPool.cloud_launchable;
          break;
        case 'metal_virtualized':
          this.shownId = IdPool.metal_virtualized;
          break;
        case 'cloud_operators':
          this.shownId = IdPool.cloud_operators;
          break;
        default:
          this.shownId = IdPool.cloud_launchable;
      }
    } else {
      searchParams.set('tab', 'cloud_launchable');
    }
    // switch to specified stream if `stream` parameter is set
    if (searchParams.has('stream')) {
      switch(searchParams.get('stream')) {
        case 'stable':
          this.stream = "stable";
          break;
        case 'testing':
          this.stream = "testing";
          break;
        case 'next':
          this.stream = "next";
          break;
        default:
          this.stream = "stable";
      }
    } else {
      searchParams.set('stream', 'stable');
    }
    // Update the url with the parameters
    history.pushState(null, null, `${downloadPageUrl}?${searchParams.toString()}`);

    var signature_sha256_verification_modal = this.getSignatureAndShaModal(h);
    var stream_select_container = h('div', { class: "pb-0 pt-3 mb-3" }, [ h('div', { class: "container" }, [ this.getStreamName(h), this.getNavbar(h) ]) ]);
    if (this.loading) {
      return h('div', {}, [ stream_select_container, "Loading..."] );
    }
    else if (this.streamData) {
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

      if (this.streamDisplay.cloudLaunchable) {
        cloudLaunchableSection = h('div', {}, Object.entries(this.streamDisplay.cloudLaunchable).map(function(entry) {
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
                    h('span', { class: "text-secondary" }, coreos_download_app.streamData.stream)
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
                  // on click edit the content of popup modal
                  if (e.target !== e.currentTarget) {
                    return;
                  }
                  else {
                    $("#modal-body").empty();
                    let p = document.createElement('p');
                    let a_checksum = null;
                    let a_signature = null;
                    // Show SHA256 and initialize the <a> tags if data is available
                    if(displayDownloads.sha256) {
                      let d = document.createElement('div');
                      $(d).addClass("overflow-auto")
                          .html("SHA256: " + displayDownloads.sha256)
                          .appendTo(p);

                      a_checksum = document.createElement('a');
                      $(a_checksum).attr("href", "data:text/plain;charset=utf-8," + encodeURIComponent("SHA256 (" + getFilename(displayDownloads.location) + ") = " + displayDownloads.sha256))
                                   .attr("download", getFilename(displayDownloads.location) + "-CHECKSUM")
                                   .html("checksum file");
                    }
                    if(displayDownloads.signature) {
                      a_signature = document.createElement('a');
                      $(a_signature).attr("href", displayDownloads.signature)
                                    .html("signature");
                    }
                    $(p).appendTo("#modal-body");

                    // Download the Checksum file and Signature
                    let ol = document.createElement('ol');
                    if (a_checksum || a_signature) {
                      let li = document.createElement('li');
                      p = document.createElement('p');
                      $(p).append("Download the ")
                          .append(a_checksum)
                          .append(a_checksum && a_signature ? " and " : "")
                          .append(a_signature);
                      $(p).appendTo(li);
                      $(li).appendTo(ol);
                    }

                    // Import Fedora's GPG keys
                    li = document.createElement('li');
                    p = document.createElement('p');
                    $(p).html("Import Fedora's GPG keys");
                    code = document.createElement('code');
                    pre = document.createElement('pre');
                    $(code).html("curl https://getfedora.org/static/fedora.gpg | gpg --import")
                           .appendTo(pre);
                    $(p).appendTo(li);
                    $(pre).appendTo(li);
                    $(li).appendTo(ol);

                    // Verify the signature is valid
                    li = document.createElement('li');
                    p = document.createElement('p');
                    $(p).html("Verify the signature is valid");
                    code = document.createElement('code');
                    pre = document.createElement('pre');
                    $(code).html("gpg --verify " + getFilename(displayDownloads.signature) + " " + getFilename(displayDownloads.location))
                           .appendTo(pre);
                    $(p).appendTo(li);
                    $(pre).appendTo(li);
                    $(li).appendTo(ol);

                    // Verify the checksum matches
                    li = document.createElement('li');
                    p = document.createElement('p');
                    $(p).html("Verify the checksum matches");
                    code = document.createElement('code');
                    pre = document.createElement('pre');
                    $(code).html("sha256sum -c " + getFilename(displayDownloads.location) + "-CHECKSUM")
                           .appendTo(pre);
                    $(p).appendTo(li);
                    $(pre).appendTo(li);
                    $(li).appendTo(ol);

                    $(ol).appendTo("#modal-body");
                  }
                }
              },
              class: "btn btn-sm btn-outline-fedora-magenta mt-2",
              attrs: {
                platformFormat: platformFormat,
                class: "btn btn-primary",
                "data-toggle": "modal",
                "data-target": "#signatureAndShaModal"
              }
            }, "Verify signature & SHA256")
          ]),
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
              h('span', { class: "text-secondary" }, coreos_download_app.streamData.stream)
            ]) : null,
            displayInfo.downloads ? h('div', { class: "ml-2" }, [
              createDownloadsSubSection(displayInfo.downloads.disk, 'disk', false, imageType),
              createDownloadsSubSection(displayInfo.downloads.kernel, 'kernel', true, imageType),
              createDownloadsSubSection(displayInfo.downloads.initramfs, 'initramfs', true, imageType)
            ]) : null
          ]);
        }));
      }
      if (this.streamDisplay.bareMetal) {
        bareMetalSection = createArtifactsSection(this.streamDisplay.bareMetal, 'bareMetal');
      }
      else {
        bareMetalSection = h('div', {}, "No bare metal images found.");
      }
      bareMetal = h('div', { class: "col-12 py-2 my-2" }, [ bareMetalSection ]);

      if (this.streamDisplay.virtualized) {
        virtualizedSection = createArtifactsSection(this.streamDisplay.virtualized, 'virtualized');
      }
      else {
        virtualizedSection = h('div', {}, "No virtualized images found.");
      }
      virtualized = h('div', { class: "col-12 py-2 my-2" }, [ virtualizedSection ]);

      if (this.streamDisplay.cloud) {
        cloudSection = createArtifactsSection(this.streamDisplay.cloud, 'cloud');
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

      let cloud_launchable_container = h('div', { class: "col-12 py-2 my-2", attrs: { id: IdPool.cloud_launchable, hidden: this.shownId !== IdPool.cloud_launchable } }, [ cloudLaunchableTitle, cloudLaunchable ]);
      let metal_virt_container = h('div', { class: "row col-12 py-2 my-2", attrs: { id: IdPool.metal_virtualized, hidden: this.shownId !== IdPool.metal_virtualized } }, [ bare_metal_container, virtualized_container ]);
      let cloud_operators_container = h('div', { class: "col-12 py-2 my-2", attrs: { id: IdPool.cloud_operators, hidden: this.shownId !== IdPool.cloud_operators } }, [ cloudTitle, verifyBlurb, cloud ]);

      return h('div', {}, [
        signature_sha256_verification_modal,
        stream_select_container,
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
