// Adapted from https://github.com/jlebon/fedora-coreos-browser.
//
// PROD:
//const baseUrl = 'https://builds.coreos.fedoraproject.org/streams'
// DEVEL:
//const baseUrl = 'https://s3.amazonaws.com/fcos-builds/streams'
const baseUrl = 'https://builds.coreos.fedoraproject.org/streams'
// list of cloud image artifacts
const cloudImages = ['aws', 'azure', 'azurestack', 'aliyun', 'digitalocean', 'exoscale', 'gcp', 'ibmcloud', 'nutanix', 'openstack', 'packet', 'vultr']
// list of virtualized image artifacts
const virtualizedImages = ['qemu', 'virtualbox', 'vmware']
// dict of pretty names for platforms, indexed by platform.extension
const prettyPlatforms = {
  "aliyun": "Alibaba Cloud",
  "aws": "AWS",
  "azure": "Azure",
  "azurestack": "Azure Stack",
  "digitalocean": "DigitalOcean",
  "exoscale": "Exoscale",
  "gcp": "GCP",
  "ibmcloud": "IBM Cloud",
  "metal": {
    "raw.xz": "Raw",
    "4k.raw.xz": "Raw (4k Native)",
    "iso": "ISO",
    "pxe": "PXE"
  },
  "nutanix": "Nutanix",
  "openstack": "OpenStack",
  "packet": "Packet",
  "qemu": "QEMU",
  "virtualbox": "VirtualBox",
  "vmware": "VMware",
  "vultr": "Vultr"
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
function isEmptyObj(obj) {
  return Object.entries(obj).length === 0 && obj.constructor === Object;
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
    entry = { location: downloadData.location, signature: downloadData.signature, sha256: downloadData.sha256 };
    downloads[download] = entry;
  }
}
var coreos_download_app = new Vue({
  el: '#coreos-download-app',
  created: function () { this.refreshStream() },
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
    // fetched {stream, metadata, architectures, updates} object from stream.json for all streams
    streamDataAll: { stable: {}, testing: {}, next: {} },
    loading: false,
    // loaded stream data to render
    streamDisplay: {
      cloudLaunchable: {},
      bareMetal: {},
      virtualized: {},
      cloud: {}
    },
  },
  watch: {
    stream: function () {
      this.refreshStream();
    },
    loading: function () {
      // Scrolls the view to navigation bar after user has clicked one of the download button
      // This needs to watch loading variable since the whole page is re-rendered
      Vue.nextTick(function () {
        // Code that will run only after the
        // entire view has been re-rendered
        let navPlatforms = document.getElementById("stream-title");
        if (coreos_download_app.loading || navPlatforms == null || coreos_download_app.scrollToNavbar != true) return;
        navPlatforms.scrollIntoView();
        coreos_download_app.scrollToNavbar = false;
      });
    },
    // watching nested data: https://stackoverflow.com/a/46331968
    "streamDataAll.stable": function (newVal, oldVal) {
      if (isEmptyObj(this.streamDataAll.stable)) {
        return
      }

      stableReleaseVersion = "v " + this.streamDataAll.stable.architectures.x86_64.artifacts.metal.release;
      $("#stable-version").text(stableReleaseVersion);

      $("#stable-json").empty();
      $("#stable-json").append(`<a class="text-gray-600" href="${baseUrl}/stable.json">JSON</a>`);
      $("#stable-json").append(` — <span>${this.timeSince(this.streamDataAll.stable.metadata['last-modified'])}</span>`);
    },
    "streamDataAll.testing": function (newVal, oldVal) {
      if (isEmptyObj(this.streamDataAll.testing)) {
        return
      }

      testingReleaseVersion = isEmptyObj(this.streamDataAll.testing) ? "" : "v " + this.streamDataAll.testing.architectures.x86_64.artifacts.metal.release;
      $("#testing-version").text(testingReleaseVersion);

      $("#testing-json").empty();
      $("#testing-json").append(`<a class="text-gray-600" href="${baseUrl}/testing.json">JSON</a>`);
      $("#testing-json").append(` — <span>${this.timeSince(this.streamDataAll.testing.metadata['last-modified'])}</span>`);
    },
    "streamDataAll.next": function (newVal, oldVal) {
      if (isEmptyObj(this.streamDataAll.next)) {
        return
      }

      nextReleaseVersion = isEmptyObj(this.streamDataAll.next) ? "" : "v " + this.streamDataAll.next.architectures.x86_64.artifacts.metal.release;
      $("#next-version").text(nextReleaseVersion);

      $("#next-json").empty();
      $("#next-json").append(`<a class="text-gray-600" href="${baseUrl}/next.json">JSON</a>`);
      $("#next-json").append(` — <span>${this.timeSince(this.streamDataAll.next.metadata['last-modified'])}</span>`);
    }
  },
  methods: {
    getObjectUrl: function (path) {
      return getArtifactUrl(this.streamUrl, path);
    },
    // Adapted from https://stackoverflow.com/a/6109105
    timeSince: function (rfc3339_timestamp) {
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
        return stringize(Math.floor(elapsed / 1000), "second");
      } else if (elapsed < msPerHour) {
        return stringize(Math.floor(elapsed / msPerMinute), "minute");
      } else if (elapsed < msPerDay) {
        return stringize(Math.floor(elapsed / msPerHour), "hour");
      } else if (elapsed < msPerMonth) {
        return stringize(Math.floor(elapsed / msPerDay), "day");
      } else if (elapsed < msPerYear) {
        return stringize(Math.floor(elapsed / msPerMonth), "month");
      } else {
        return stringize(Math.floor(elapsed / msPerYear), "year");
      }
    },
    // Callback function for the navigation bar
    // Effects:
    // - hides the other tabs other than the clicked one
    // - replace the current URL parameter with the clicked one
    toggleHidden: function (e) {
      const idList = Object.values(IdPool);
      Object.entries(tabInnerText).map(pair => {
        const key = pair[0];
        const val = pair[1];
        if (val === e.target.innerText) {
          const downloadPageUrl = window.location.href.match(/^.*\/coreos\/download/)[0];
          history.replaceState(null, null, `${downloadPageUrl}?tab=${key}&stream=${coreos_download_app.stream}&arch=${coreos_download_app.architecture}`);
          const showId = IdPool[key];
          idList.map(id => document.getElementById(id).hidden = (id !== showId));
          this.shownId = showId;
        }
      });
    },
    // Handle the dropdown for architectures
    toggleArch: function (e) {
      e.preventDefault();
      coreos_download_app.architecture = e.target.text
      const currentShownKey = Object.keys(IdPool).find(key => IdPool[key] === coreos_download_app.shownId);
      const downloadPageUrl = window.location.href.match(/^.*\/coreos\/download/)[0];
      history.replaceState(null, null, `${downloadPageUrl}?tab=${currentShownKey}&stream=${coreos_download_app.stream}&arch=${coreos_download_app.architecture}`);
      this.loadStreamDisplay();
    },
    // Render a navbar section
    getNavbar: function (h) {
      cloudIcon = h('i', { class: "fas fa-cloud mr-2" })
      navCloudLaunchableBtn = h('button', { class: "nav-link col-12 h-100 overflow-hidden".concat(this.shownId === IdPool.cloud_launchable ? " active" : ""), attrs: { "data-toggle": "tab" }, on: { click: this.toggleHidden } }, [cloudIcon, tabInnerText.cloud_launchable]);
      navCloudLaunchable = h('li', { class: "nav-item col-12 col-sm-4" }, [navCloudLaunchableBtn]);

      serverIcon = h('i', { class: "fas fa-server mr-2" })
      navMetalVirtBtn = h('button', { class: "nav-link col-12 h-100 overflow-hidden".concat(this.shownId === IdPool.metal_virtualized ? " active" : ""), attrs: { "data-toggle": "tab" }, on: { click: this.toggleHidden } }, [serverIcon, tabInnerText.metal_virtualized]);
      navMetalVirt = h('li', { class: "nav-item col-12 col-sm-4" }, [navMetalVirtBtn]);

      cloudUploadIcon = h('i', { class: "fas fa-cloud-upload-alt mr-2" })
      navCloudOperatorsBtn = h('button', { class: "nav-link col-12 h-100 overflow-hidden".concat(this.shownId === IdPool.cloud_operators ? " active" : ""), attrs: { "data-toggle": "tab" }, on: { click: this.toggleHidden } }, [cloudUploadIcon, tabInnerText.cloud_operators]);
      navCloudOperators = h('li', { class: "nav-item col-12 col-sm-4" }, [navCloudOperatorsBtn]);

      navbar = h('ul', { class: "nav nav-tabs mt-3" }, [navCloudLaunchable, navMetalVirt, navCloudOperators]);
      return navbar;
    },
    // Introduction section for streams, the section above the navigation bar for platforms
    getStreamIntro: function (h) {

      function onClick(e) {
        e.preventDefault();

        if (coreos_download_app.stream == e.target.id) {
          let navPlatforms = document.getElementById("stream-title");
          navPlatforms.scrollIntoView();
          return;
        }

        coreos_download_app.scrollToNavbar = true;
        const downloadPageUrl = window.location.href.match(/^.*\/coreos\/download/)[0];
        const currentShownKey = Object.keys(IdPool).find(key => IdPool[key] === coreos_download_app.shownId);
        coreos_download_app.stream = e.target.id;
        history.replaceState(null, null, `${downloadPageUrl}?tab=${currentShownKey}&stream=${coreos_download_app.stream}&arch=${coreos_download_app.architecture}`);
      }

      const overviewPageUrl = window.location.href.match(/^.*\/coreos/)[0];
      title = h('h2', { class: "font-weight-light text-center mb-5 pt-5" }, "Fedora CoreOS is available across 3 different release streams:");

      if (this.loading) {
        return title;
      }

      // Release info section with three tabs: stable, testing, next
      // NOTE: in order for the button line up at the same horizontal level, use a fixed height `9em` for <p> elements of stream summaries.
      stableIcon = h("i", {
        class: "fas fa-shield-alt fa-2x rounded-circle bg-fedora-blue text-white p-3 ml-4",
      }, "");
      stableHeading = h("h3", { class: "font-weight-light" }, "Stable");
      stableReleaseVersion = h("h6", { class: "text-gray-500 mb-0", attrs: { id: "stable-version" } }, isEmptyObj(this.streamDataAll.stable) ? "" : "v " + this.streamDataAll.stable.architectures.x86_64.artifacts.metal.release);
      stableJSON = h('p', { class: "text-gray-500", attrs: { id: "stable-json" } }, [
        h('span', {}, [
          h('a', { class: "font-weight-bold text-gray-500", attrs: { href: `${baseUrl}/stable.json` } }, "JSON")
        ]),
        (isEmptyObj(this.streamDataAll.stable)) ? null : " — ",
        (isEmptyObj(this.streamDataAll.stable)) ? null : h('span', { class: "font-weight-normal" }, this.timeSince(this.streamDataAll.stable.metadata['last-modified']))
      ]);
      stableIconContainer = h("div", { class: "col-4" }, [stableIcon])
      stableReleaseJSONContainer = h("div", { class: "col-8" }, [stableHeading, stableReleaseVersion, stableJSON])
      stableHeadingContainer = h("div", { class: "row" }, [stableIconContainer, stableReleaseJSONContainer])

      stableIntroText = h("p", { class: "pl-3 pr-2", style: { height: "9em" } }, "The Stable stream is the most reliable version of Fedora CoreOS. Releases are battle-tested within the Testing stream before being promoted.");
      stableReleaseLink = h('button',
        {
          class: "d-block mx-auto mb-4 py-1 px-3 btn btn-sm btn-fedora-blue",
          attrs: { id: "stable" },
          on: {
            click: onClick
          }
        }, "Show Downloads");

      // then Testing stream
      testingIcon = h("i", {
        class: "fas fa-flask fa-2x rounded-circle bg-fedora-green text-white p-3 ml-4",
      }, "");
      testingHeading = h("h3", { class: "font-weight-light" }, "Testing");
      testingReleaseVersion = h("h6", { class: "text-gray-500 mb-0", attrs: { id: "testing-version" } }, isEmptyObj(this.streamDataAll.testing) ? "" : "v " + this.streamDataAll.testing.architectures.x86_64.artifacts.metal.release);
      testingJSON = h('p', { class: "text-gray-500", attrs: { id: "testing-json" } }, [
        h('span', {}, [
          h('a', { class: "font-weight-bold text-gray-500", attrs: { href: `${baseUrl}/testing.json` } }, "JSON")
        ]),
        (isEmptyObj(this.streamDataAll.testing)) ? null : " — ",
        (isEmptyObj(this.streamDataAll.testing)) ? null : h('span', { class: "font-weight-normal" }, this.timeSince(this.streamDataAll.testing.metadata['last-modified']))
      ]);
      testingIconContainer = h("div", { class: "col-4" }, [testingIcon])
      testingReleaseJSONContainer = h("div", { class: "col-8" }, [testingHeading, testingReleaseVersion, testingJSON])
      testingHeadingContainer = h("div", { class: "row" }, [testingIconContainer, testingReleaseJSONContainer])

      testingIntroText = h("p", { class: "pl-3 pr-2", style: { height: "9em" } }, "The Testing stream contains the next Stable release. Mix a few Testing machines into your cluster to catch any bugs specific to your hardware or configuration.");
      testingReleaseLink = h('button',
        {
          class: "d-block mx-auto mb-4 py-1 px-3 btn btn-sm btn-fedora-green",
          attrs: { id: "testing" },
          on: {
            click: onClick
          }
        }, "Show Downloads");

      // then Next stream
      nextIcon = h("i", {
        class: "fas fa-layer-group fa-2x rounded-circle bg-fedora-orange text-white p-3 ml-4",
      }, "");
      nextHeading = h("h3", { class: "font-weight-light" }, "Next");
      nextReleaseVersion = h("h6", { class: "text-gray-500 mb-0", attrs: { id: "next-version" } }, isEmptyObj(this.streamDataAll.next) ? "" : "v " + this.streamDataAll.next.architectures.x86_64.artifacts.metal.release);
      nextJSON = h('p', { class: "text-gray-500", attrs: { id: "next-json" } }, [
        h('span', {}, [
          h('a', { class: "font-weight-bold text-gray-500", attrs: { href: `${baseUrl}/next.json` } }, "JSON")
        ]),
        (isEmptyObj(this.streamDataAll.next)) ? null : " — ",
        (isEmptyObj(this.streamDataAll.next)) ? null : h('span', { class: "font-weight-normal" }, this.timeSince(this.streamDataAll.next.metadata['last-modified']))
      ]);
      nextIconContainer = h("div", { class: "col-4" }, [nextIcon])
      nextReleaseJSONContainer = h("div", { class: "col-8" }, [nextHeading, nextReleaseVersion, nextJSON])
      nextHeadingContainer = h("div", { class: "row" }, [nextIconContainer, nextReleaseJSONContainer])

      nextIntroText = h("p", { class: "pl-3 pr-2", style: { height: "9em" } }, "The Next stream represents the future. It provides early access to new features and to the next major version of Fedora. Run a few Next machines in your cluster, or in staging, to help find problems.");
      nextReleaseLink = h('button',
        {
          class: "d-block mx-auto mb-4 py-1 px-3 btn btn-sm btn-fedora-orange",
          attrs: { id: "next" },
          on: {
            click: onClick
          }
        }, "Show Downloads");

      stableDiv = h('div', {
        class: "col-12 col-lg-4 border-left border-fedora-blue pt-3",
        style: {
          "border-width": "10px !important",
        }
      }, [stableHeadingContainer, stableIntroText, stableReleaseLink])
      testingDiv = h('div', {
        class: "col-12 col-lg-4 border-left border-fedora-green pt-3",
        style: {
          "border-width": "10px !important",
        }
      }, [testingHeadingContainer, testingIntroText, testingReleaseLink])
      nextDiv = h('div', {
        class: "col-12 col-lg-4 border-left border-fedora-orange pt-3",
        style: {
          "border-width": "10px !important",
        }
      }, [nextHeadingContainer, nextIntroText, nextReleaseLink])

      streamsIntroDiv = h('div', { class: "row my-3" }, [stableDiv, testingDiv, nextDiv]);

      // Text color map for the streams for easy access
      const textColorMap = {
        "stable": "text-fedora-blue",
        "testing": "text-fedora-green",
        "next": "text-fedora-orange"
      };

      //Getting the list of all the architectures
      const architectures = getMember(this.streamData, "architectures");
      let architectureList = Object.keys(architectures);
      
      archDropdown = h('div', {attrs: {style: "text-align: right;" }}, [
        `Architecture: `,
          h('a', {
            class: "dropdown-toggle",
            attrs: {
              "href": "#",
              "role": "button",
              "data-toggle": "dropdown",
              "aria-haspopup": true,
              "aria-expanded": false
            },
            on: {
              click: function (e) {
                e.preventDefault();
              }
            }
          }, this.architecture),
          h('div', { class: "dropdown-menu" }, [
            h('div', { class: "container" }, [
                h('div', { class: "col-12 px-0" }, [
                  Object.entries(architectureList).map(pair => {
                    let arch = pair[1];
                    return h('a', {
                      class: "dropdown-item",
                      attrs: {
                        href: "#",
                      },
                      on: {
                        click: this.toggleArch
                      }
                    },
                      arch);
                  })
                ])
            ])
          ]),
      ]);
      
      displayedStreamTitle = h('div', { class: "font-weight-light text-left pt-5", attrs: { id: "stream-title"} }, [
        h('div', {attrs: {style: "width: 70%; float: left;" } }, [
        `Currently displayed stream:`,
        // https://stackoverflow.com/a/1026087 for making the first letter uppercase
        h('span', { class: `${textColorMap[this.stream]} mx-2` }, this.stream.charAt(0).toUpperCase() + this.stream.slice(1)),
        `(`,
        h('a', {
          class: "font-weight-bold text-gray-500",
          attrs: {
            href: `${overviewPageUrl}?stream=${coreos_download_app.stream}`
          }
        }, `View Releases`),
        `)`])      
      ]);

      wrapperDiv = h('div', {}, [title, streamsIntroDiv, displayedStreamTitle, archDropdown]);
      return wrapperDiv;
    },
    isAws: function (platform) {
      return platform == "aws";
    },
    isGcp: function (platform) {
      return platform == "gcp";
    },
    isVirtualizedImage: function (platform) {
      return virtualizedImages.includes(platform);
    },
    isCloudImage: function (platform) {
      return cloudImages.includes(platform);
    },
    isBareMetalImage: function (platform) {
      return platform == "metal";
    },
    // Load stream information to display. Note that `loadStreamDisplay` does
    // not deep-copy information from `streamData` or elsewhere into
    // `streamDisplay`.
    loadStreamDisplay: function () {
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
              displayEntries.push({ platform: prettyPlatform, region: region, release: release, image: image });
            }
            // put 'us', 'eu', and 'ap' first since those are the cheapest and
            // most popular; then everything else
            const continentOrdering = ["us", "eu", "ap"];
            displayEntries = displayEntries.sort(function (a, b) {
              const aIdx = continentOrdering.indexOf(a.region.slice(0, 2));
              const bIdx = continentOrdering.indexOf(b.region.slice(0, 2));
              if (aIdx == bIdx) {
                return a.region.localeCompare(b.region);
              } else if (aIdx == -1) {
                return 1;
              } else if (bIdx == -1) {
                return -1;
              } else {
                return aIdx - bIdx;
              }
            });
          }
          Vue.set(this.streamDisplay.cloudLaunchable, platform, { list: displayEntries });
        }
        else if (this.isGcp(platform)) {
          const name = getMember(images[platform], "name");
          const family = getMember(images[platform], "family");
          const project = getMember(images[platform], "project");
          Vue.set(this.streamDisplay.cloudLaunchable, platform, { platform: prettyPlatform, name, family, project });
        }
        else {
          const image = getMember(images[platform], "image");
          Vue.set(this.streamDisplay.cloudLaunchable, platform, { platform: prettyPlatform, image: image });
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
            prettyFormats.push({ format: format, pretty: pretty });
          }
          prettyFormats.sort(function (a, b) { return a.pretty.localeCompare(b.pretty); });
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
              displayEntry = { platform: prettyPlatform, release: release, downloads: downloads, extension: extension };
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
    // Load all stream metadata for rendering
    refreshStream: function () {
      const self = this;
      self.loading = true
      self.streamUrl = baseUrl
      fetchStreamData(baseUrl, "stable")
        .then(streamData => {
          self.streamDataAll.stable = streamData;
          return fetchStreamData(baseUrl, "testing");
        })
        .then(streamData => {
          self.streamDataAll.testing = streamData;
          return fetchStreamData(baseUrl, "next");
        })
        .then(streamData => {
          self.streamDataAll.next = streamData;
          return;
        })
        .then(() => {
          const streamData = self.streamDataAll[self.stream];
          self.loading = false;
          self.streamData = isEmptyObj(streamData) ? null : streamData;
          self.loadStreamDisplay();
        })
    },
    // Render the `Verify signature & SHA256` modal template
    getSignatureAndShaModal: function (h) {
      return h('div', { class: "modal", attrs: { id: "signatureAndShaModal", tabindex: "-1", role: "dialog", "aria-labelledby": "signatureAndShaModalLabel", "aria-hidden": "true" } }, [
        h('div', { class: "modal-dialog modal-lg modal-dialog-centered", attrs: { role: "document" } }, [
          h('div', { class: "modal-content" }, [
            h('div', { class: "modal-header" }, [
              h('h5', { class: "modal-title", attrs: { id: "signatureAndShaModalTitle" } }, [
                "Verify signature & SHA256"
              ]),
              h('button', { class: "close", attrs: { type: "button", "data-dismiss": "modal", "aria-label": "Close" } }, [
                h('span', { attrs: { "aria-hidden": "true" } }, ["×"])
              ])
            ]),
            h('div', { class: "modal-body", attrs: { id: "modal-body" } }, ["Loading..."]),
            h('div', { class: "modal-footer" }, [
              h('button', { class: "btn btn-secondary", attrs: { type: "button", "data-dismiss": "modal" } }, [
                "Close"
              ])
            ])
          ])
        ])
      ])
    }
  },
  render: function (h) {
    if (window.location.href.match(/^.*\/coreos\/download/) == null) {
      return
    }
    const downloadPageUrl = window.location.href.match(/^.*\/coreos\/download/)[0];
    searchParams = new URLSearchParams(window.location.search);
    // switch to specified tab if `tab` parameter is set
    if (searchParams.has('tab')) {
      switch (searchParams.get('tab')) {
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
      switch (searchParams.get('stream')) {
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
    // switch to specified arch if `arch` parameter is set
    if (searchParams.has('arch') && this.streamData) {
      const architectures = getMember(this.streamData, "architectures");
      let architectureList = Object.keys(architectures);
      // Checking if the value of arch is in the list of arches from streamData
      if (architectureList.includes(searchParams.get('arch')))
        this.architecture = searchParams.get('arch');
      else
        this.architecture = "x86_64";
    } else {
      searchParams.set('arch', 'x86_64');
    }  
    // Update the url with the parameters
    history.replaceState(null, null, `${downloadPageUrl}?${searchParams.toString()}`);

    var signatureSha256VerificationModal = this.getSignatureAndShaModal(h);
    h1Title = h('h1', { class: "font-weight-light text-center my-5" }, "Download Fedora CoreOS");
    streamSelectContainer = h('div', { class: "pb-0 mb-3" }, [this.getStreamIntro(h), this.getNavbar(h)]);
    if (this.loading) {
      streamInfoDiv = h('div', { class: "bg-light" }, [h('div', { class: "container font-weight-light" }, [streamSelectContainer])]);
      downloadDiv = h('div', { class: "bg-white pb-5" }, [h('div', { class: "container font-weight-light" }, "Loading...")]);
      return h('div', {}, [h1Title, streamInfoDiv, downloadDiv]);
    }
    else if (this.streamData) {
      cloudLaunchableSection = {};
      cloudLaunchable = {};
      virtualizedTitle = h('h3', { class: "font-weight-light" }, "Virtualized");
      virtualizedSection = {};
      virtualized = {};
      bareMetalTitle = h('h3', { class: "font-weight-light" }, "Bare Metal");
      bareMetalSection = {};
      bareMetal = {};
      cloudSection = {};
      cloud = {};

      if (this.streamDisplay.cloudLaunchable) {
        cloudLaunchableSection = Object.entries(this.streamDisplay.cloudLaunchable).map(function (entry) {
          platform = entry[0];
          displayInfo = entry[1];
          if (coreos_download_app.isAws(platform)) {
            if (displayInfo.list) {
              const toggleRegion = function (e) {
                e.preventDefault();
                let awsCloudLaunchableDiv = document.getElementById("aws-cloud-launchables");
                awsCloudLaunchableDiv.childNodes.forEach(childNode => {
                  if (childNode.id == null || childNode.id.length == 0) return;
                  if (childNode.id == e.target.innerText) {
                    childNode.hidden = false;
                  } else {
                    childNode.hidden = true;
                  }
                });
              };
              return h('div', { class: "col-12 col-lg-6", attrs: { id: "aws-cloud-launchables" } }, [
                h('div', { class: "px-2 mx-2 pt-2 mt-2 pb-0 mb-0" }, [
                  h('div', { class: "font-weight-bold" }, getPrettyPlatform(platform, null)),
                  h('span', { class: "text-secondary" }, [
                    coreos_download_app.streamData.stream,
                    h('div', { class: "dropdown" }, [
                      h('a', {
                        class: "dropdown-toggle",
                        attrs: {
                          "href": "#",
                          "role": "button",
                          "data-toggle": "dropdown",
                          "aria-haspopup": true,
                          "aria-expanded": false
                        },
                        on: {
                          click: function (e) {
                            e.preventDefault();
                          }
                        }
                      }, "Regions"),
                      h('div', { class: "dropdown-menu" }, [
                        h('div', { class: "container" }, [
                          h('div', { class: "row" }, [
                            // display region list in two columns
                            h('div', { class: "col-12 col-sm-6 border-right px-0" }, [
                              displayInfo.list.slice(0, Math.ceil(displayInfo.list.length / 2)).map(amiInfo => {
                                if (amiInfo.region == null || amiInfo.region.length == 0) return;
                                return h('a', {
                                  class: "dropdown-item",
                                  attrs: {
                                    href: "#",
                                  },
                                  on: {
                                    click: toggleRegion
                                  }
                                },
                                  amiInfo.region);
                              })
                            ]),
                            h('div', { class: "col-12 col-sm-6 px-0" }, [
                              displayInfo.list.slice(Math.ceil(displayInfo.list.length / 2), displayInfo.list.length).map(amiInfo => {
                                if (amiInfo.region == null || amiInfo.region.length == 0) return;
                                return h('a', {
                                  class: "dropdown-item",
                                  attrs: {
                                    href: "#",
                                  },
                                  on: {
                                    click: toggleRegion
                                  }
                                },
                                  amiInfo.region);
                              })
                            ])
                          ])
                        ])
                      ]),
                    ]),
                  ])
                ]),
                displayInfo.list.map(function (amiInfo) {
                  // by default, only show us-east-1
                  return h('div', { class: "px-2 mx-2 pb-2 mb-2 pt-0 mt-0", attrs: { id: amiInfo.region, hidden: amiInfo.region != "us-east-1" } }, [
                    amiInfo.region ? h('div', {}, ["- Region: ", amiInfo.region]) : null,
                    amiInfo.release ? h('div', { class: "ml-2" }, [
                      h('span', {}, ["Release: ", amiInfo.release])
                    ]) : null,
                    amiInfo.image ? h('div', { class: "ml-2" }, [
                      "Image: ",
                      h('a', {
                        attrs: {
                          href: "https://console.aws.amazon.com/ec2/home?region=" + amiInfo.region + "#launchAmi=" + amiInfo.image
                        }
                      }, amiInfo.image)
                    ]) : null
                  ])
                })
              ]);
            }
          }
          if (coreos_download_app.isGcp(platform)) {
            return h('div', { class: "col-12 col-lg-6" }, [
              h('div', { class: "p-2 m-2" }, [
                displayInfo.platform ? h('div', { class: "font-weight-bold" }, displayInfo.platform) : null,
                coreos_download_app.streamData.stream ? h('span', { class: "text-secondary" }, coreos_download_app.streamData.stream) : null,
                displayInfo.project ? h('div', { class: "ml-2" }, ["Project: ", displayInfo.project]) : null,
                displayInfo.family ? h('div', { class: "ml-2" }, [
                  "Family: ",
                  h('a', {
                    attrs: {
                      href: `https://console.cloud.google.com/marketplace/details/fedora-coreos-cloud/fedora-coreos-${coreos_download_app.streamData.stream}`
                    }
                  }, displayInfo.family),
                  " (",
                  h('a', {
                    attrs: {
                      href: "#"
                    },
                    on: {
                      click: function (e) {
                        e.preventDefault();
                        let gcpNameElement = e.target.parentElement.nextSibling;
                        gcpNameElement.hidden = !gcpNameElement.hidden;
                      }
                    }
                  }, 'details'),
                  ")"]
                ) : null,
                displayInfo.name ? h('div', { class: "ml-2", attrs: { hidden: true } }, [
                  h('span', {}, [
                    `- The current latest image in the`,
                    h('span', { class: "font-weight-normal font-italic" }, ` ${displayInfo.family}`),
                    " image family is ",
                    h('span', { class: "font-weight-normal font-italic" }, displayInfo.name),
                    "."
                  ])
                ]) : null
              ])
            ]);
          }
          else {
            return h('div', {}, [
              displayInfo.platform ? h('div', { class: "font-weight-bold" }, displayInfo.platform) : null,
              displayInfo.image ? h('div', { class: "ml-2" }, displayInfo.image) : null
            ]);
          }
        });
      }
      else {
        cloudLaunchableSection = h('div', {}, "No cloud launchable images found.");
      }
      cloudLaunchable = h('div', { class: "row col-12 py-2 my-2" }, [cloudLaunchableSection]);

      function createDownloadsSubSection(displayDownloads, contentType, showTitle, imageType) {
        verifyBlurb =
          `<div class="mb-3">
          Verify your download using the detached signature after importing <a href="https://getfedora.org/security/">Fedora's GPG signing keys</a>.
          The detached signature is for the released artifact itself. If there is a good signature from one of the Fedora keys, and the SHA256 checksum matches, then the download is valid.
        </div>`
        return displayDownloads ? h('div', { class: "pb-2" }, [
          showTitle ? h('span', {}, contentType + ": ") : null,
          displayDownloads.location ? h('span', {}, [
            h('a', { attrs: { href: displayDownloads.location } }, "Download")
          ]) : null,
          h('div', {}, [
            h('button', {
              on: {
                click: function (e) {
                  // on click edit the content of popup modal
                  if (e.target !== e.currentTarget) {
                    return;
                  }
                  else {
                    $("#modal-body").empty();
                    let p = document.createElement('p');
                    let aChecksum = null;
                    let aSignature = null;
                    // Show SHA256 and initialize the <a> tags if data is available
                    if (displayDownloads.sha256) {
                      let d = document.createElement('div');
                      $(d).addClass("overflow-auto")
                        .html("SHA256: " + displayDownloads.sha256)
                        .appendTo(p);

                      aChecksum = document.createElement('a');
                      $(aChecksum).attr("href", "data:text/plain;charset=utf-8," + encodeURIComponent("SHA256 (" + getFilename(displayDownloads.location) + ") = " + displayDownloads.sha256))
                        .attr("download", getFilename(displayDownloads.location) + "-CHECKSUM")
                        .html("checksum file");
                    }
                    if (displayDownloads.signature) {
                      aSignature = document.createElement('a');
                      $(aSignature).attr("href", displayDownloads.signature)
                        .html("signature");
                    }
                    $(p).appendTo("#modal-body");
                    $(verifyBlurb).appendTo("#modal-body");

                    // Download the Checksum file and Signature
                    let ol = document.createElement('ol');
                    if (aChecksum || aSignature) {
                      let li = document.createElement('li');
                      p = document.createElement('p');
                      $(p).append("Download the ")
                        .append(aChecksum)
                        .append(aChecksum && aSignature ? " and " : "")
                        .append(aSignature);
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
        return h('div', { class: imageType == "cloud" ? "row" : "" }, Object.entries(displayArtifacts).map(function (entry) {
          platformFormat = entry[0];
          displayInfo = entry[1];
          return h('div', { class: imageType == "cloud" ? "py-2 my-2 col-12 col-lg-6" : "p-2 m-2" }, [
            displayInfo.platform ? h('div', { class: "font-weight-bold" }, displayInfo.platform) : null,
            displayInfo.extension ? h('div', {}, ["(", displayInfo.extension, ")"]) : null,
            displayInfo.release ? h('div', { class: "ml-2" }, [
              h('span', {}, [displayInfo.release, " "]),
              h('span', { class: "text-secondary" }, coreos_download_app.streamData.stream)
            ]) : null,
            displayInfo.downloads ? h('div', { class: "ml-2" }, [
              createDownloadsSubSection(displayInfo.downloads.disk, 'disk', false, imageType),
              createDownloadsSubSection(displayInfo.downloads.kernel, 'kernel', true, imageType),
              createDownloadsSubSection(displayInfo.downloads.initramfs, 'initramfs', true, imageType),
              createDownloadsSubSection(displayInfo.downloads.rootfs, 'rootfs', true, imageType)
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
      bareMetal = h('div', { class: "col-12" }, [bareMetalSection]);

      if (this.streamDisplay.virtualized) {
        virtualizedSection = createArtifactsSection(this.streamDisplay.virtualized, 'virtualized');
      }
      else {
        virtualizedSection = h('div', {}, "No virtualized images found.");
      }
      virtualized = h('div', { class: "col-12" }, [virtualizedSection]);

      if (this.streamDisplay.cloud) {
        cloudSection = createArtifactsSection(this.streamDisplay.cloud, 'cloud');
      }
      else {
        cloudSection = h('div', {}, "No cloud images found.");
      }
      cloud = h('div', { class: "col-12 py-2 my-2" }, [cloudSection]);

      let bareMetalContainer = h('div', { class: "col-lg-6 my-2 py-2" }, [bareMetalTitle, bareMetal]);
      let virtualizedContainer = h('div', { class: "col-lg-6 my-2 py-2" }, [virtualizedTitle, virtualized]);

      let cloudLaunchableContainer = h('div', { class: "col-12 py-2 my-2", attrs: { id: IdPool.cloud_launchable, hidden: this.shownId !== IdPool.cloud_launchable } }, [cloudLaunchable]);
      let metalVirtContainer = h('div', { class: "row col-12 py-2 my-2", attrs: { id: IdPool.metal_virtualized, hidden: this.shownId !== IdPool.metal_virtualized } }, [bareMetalContainer, virtualizedContainer]);
      let cloudOperatorsContainer = h('div', { class: "col-12 py-2 my-2", attrs: { id: IdPool.cloud_operators, hidden: this.shownId !== IdPool.cloud_operators } }, [cloud]);

      streamInfoDiv = h('div', { class: "bg-light" }, [h('div', { class: "container font-weight-light" }, [streamSelectContainer])]);
      downloadDiv = h('div', { class: "bg-white pb-5" }, [
        h('div', { class: "container font-weight-light" }, [
          signatureSha256VerificationModal,
          cloudLaunchableContainer,
          metalVirtContainer,
          cloudOperatorsContainer
        ])
      ])

      return h('div', {}, [h1Title, streamInfoDiv, downloadDiv]);
    }
    else {
      errorDiv = h('div', { class: "bg-transparent py-5" }, [h('div', { class: "container font-weight-light" }, "No stream data found!")]);
      return h('div', {}, [errorDiv]);
    }
  }
})
