// There are three layers of async fetch calls
//  - builds.json
//  - meta.json
//  - commitmeta.json

// Originally the `loading` variable is set to false after builds.json
// has been fetched, but since we are using runtime only build and not using
// Vue templates, watching the builds list and re-render each time a metadata
// has been fetched seems to be a large overhead.
// Therefore, in this implementation, only render the page after fetching all
// of the three json files in the first place, and re-render if the user changes
// stream.

// NOTE: set the `initialBuildsShown` to 5 means only 5 builds will be rendered,
// which means the overhead for waiting for fetching 5 builds might not be large
// (~40ms for fetching all jsons).

const baseUrl = 'https://builds.coreos.fedoraproject.org/streams'
const baseProdUrl = 'https://builds.coreos.fedoraproject.org/prod/streams'
const baseDevelUrl = 'https://builds.coreos.fedoraproject.org/devel/streams'

const initialBuildsShown = 5;

// pkgdiff enum to str
const diffType = ["added", "removed", "upgraded", "downgraded"];
const importantPkgs = ["kernel", "systemd", "rpm-ostree", "ignition", "podman"];

function timestampToPrettyString(date) {
  date = new Date(date);
  const year = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(date);
  const month = new Intl.DateTimeFormat('en', { month: 'short' }).format(date);
  const day = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(date);

  return `${month} ${day}, ${year}`;
}

function getBaseUrl(stream, developer) {
    return stream != "developer"
        ? `${baseProdUrl}/${stream}`
        : `${baseDevelUrl}/${developer}`;
}

// function fetchStreamData(base, stream) {
//     return fetch(`${base}/${stream}.json`)
//       .then(response => response.ok ? response.json() : {});
// }

// function isEmptyObj(obj) {
//     return Object.entries(obj).length === 0 && obj.constructor === Object;
// }

function sortPkgDiff(meta) {
  if ("pkgdiff" in meta) {
      var newdiff = {};
      diffType.forEach(t => newdiff[t] = []);
      meta["pkgdiff"].forEach(d => newdiff[diffType[d[1]]].push(d));
      meta["pkgdiff"] = newdiff;
  }
}

function findImportantPkgs(commitmeta) {
  var r = [];
  commitmeta["rpmostree.rpmdb.pkglist"].forEach(pkg => {
      if (importantPkgs.includes(pkg[0])) {
          r.push(pkg);
      }
  });
  return r;
}

function fetchBuilds(base) {
    return fetch(`${base}/builds.json`)
        .then(response => response.ok ? response.json() : {"builds": []})
        .then(data => {
            if (!('schema-version' in data) || data["schema-version"] != "1.0.0") {
                // in legacy mode, just assume we only built x86_64
                return [true, data.builds.map(id => ({'id': id, 'arches': ['x86_64'], 'meta': null, 'commitmeta': null}))];
            } else {
                return [false, data.builds.map(build => ({'id': build.id, 'arches': build.arches, 'meta': null, 'commitmeta': null}))];
            }
        });
}

function fetchBuild(base, build, legacy) {
    return fetchBuildMeta(base, build, legacy).then(result => {
        [basearch, meta] = result;
        sortPkgDiff(meta);
        // show the build metadata
        build.meta = meta;
        // and fetch extra commit metadata in async
        return fetchBuildCommitMeta(base, build, basearch, legacy).then(commitmeta => {
            commitmeta["importantPkgs"] = findImportantPkgs(commitmeta);
            commitmeta["showImportantPkgsOnly"] = true;
            build.commitmeta = commitmeta;
        });
    });
}

function fetchBuildMeta(base, build, legacy) {
  if (legacy) {
      return fetch(`${base}/${build.id}/meta.json`)
          .then(response => Promise.all([build.arches[0], response.ok ? response.json() : {}]));
  }
  // XXX: just fetch the meta for the first arch right now
  return fetch(`${base}/${build.id}/${build.arches[0]}/meta.json`)
      .then(response => Promise.all([build.arches[0], response.ok ? response.json() : {}]));

  // return Promise.all(build.arches.map(arch => {
  //     fetch(`${base}/${build.id}/${arch}/meta.json`)
  //         .then(response => Promise.all([arch, response.ok ? response.json() : {}]));
  // }));
}

function fetchBuildCommitMeta(base, build, basearch, legacy) {
  if (legacy) {
      return fetch(`${base}/${build.id}/commitmeta.json`)
          .then(response => response.ok ? response.json() : {});
  }
  return fetch(`${base}/${build.id}/${basearch}/commitmeta.json`)
      .then(response => response.ok ? response.json() : {});
}

var coreos_release_notes = new Vue({
  el: '#coreos-release-notes',
  created: function() { this.refreshBuilds() },
  data: {
    // source of truth for streams
    streamList: ['stable', 'testing', 'next'],
    // currently selected stream
    stream: 'stable',
    // if current stream is "developer", currently entered developer
    developer: "",
    // current url to builds/ dir for stream
    buildsUrl: "",
    // whether the currently selected stream has a legacy layout
    // https://github.com/coreos/coreos-assembler/pull/580
    legacy: false,
    // list of {id, arches, meta, commitmeta} build objects
    // XXX: in non-legacy mode, meta and commitmeta are those
    // of the first arch, but in the future these would be e.g.
    // meta[arch] and commitmeta[arch]
    builds: [],
    // list of unshown {id, arches, meta, commitmeta} build objects
    unshown_builds: [],
    // toggles "Loading..."
    loading: true
  },
  watch: {
    stream: function() {
      this.refreshBuilds();
    }
  },
  methods: {
    getPkgNevra: function(tuple) {
      return `${tuple[0]}-${tuple[1]}.${tuple[2]}`;
    },
    getPkgNevraFull: function(tuple) {
        if (tuple[1] != 0) {
            return `${tuple[0]}-${tuple[1]}:${tuple[2]}-${tuple[3]}.${tuple[4]}`;
        }
        return `${tuple[0]}-${tuple[2]}-${tuple[3]}.${tuple[4]}`;
    },
    getPkgEvra: function(tuple) {
        return `${tuple[1]}.${tuple[2]}`;
    },
    getNavbar: function(h) {
      const self = this;
      const changeStream = e => {
        if (e.target.innerText === "Stable Stream") {
            self.stream = "stable"
        }
        if (e.target.innerText === "Testing Stream") {
            self.stream = "testing"
        }
        if (e.target.innerText === "Next Stream") {
            self.stream = "next"
        }
      }
      let shieldIcon = h('i', { class: "fas fa-shield-alt mr-2" })
      let navStableBtn = h('button', { class: "nav-link col-12 h-100 overflow-hidden".concat(this.stream === "stable" ? " active" : ""), attrs: { "data-toggle": "tab" }, on: { click: changeStream } }, [ shieldIcon, "Stable Stream" ]);
      let navStable = h('li', { class: "nav-item col-12 col-sm-4" }, [ navStableBtn ]);

      let flaskIcon = h('i', { class: "fas fa-flask mr-2" })
      let navTestingBtn = h('button', { class: "nav-link col-12 h-100 overflow-hidden".concat(this.stream === "testing" ? " active" : ""), attrs: { "data-toggle": "tab" }, on: { click: changeStream } }, [ flaskIcon, "Testing Stream" ]);
      let navTesting = h('li', { class: "nav-item col-12 col-sm-4" }, [ navTestingBtn ]);

      let layerIcon = h('i', { class: "fas fa-layer-group mr-2" })
      let navNextBtn = h('button', { class: "nav-link col-12 h-100 overflow-hidden".concat(this.stream === "next" ? " active" : ""), attrs: { "data-toggle": "tab" }, on: { click: changeStream } }, [ layerIcon, "Next Stream" ]);
      let navNext = h('li', { class: "nav-item col-12 col-sm-4" }, [ navNextBtn ]);

      let navbar = h('ul', { class: "nav nav-tabs" }, [ navStable, navTesting, navNext ]);
      return navbar;
    },
    getReleaseNoteCards: function(h) {
      const self = this;
      // check if all build metadata has been fetched
      if (self.loading) {
        return
      }

      rows = [];
      self.builds.forEach((build, idx) => {
        // Left pane consists of Build ID and Arch info
        let headingListArches = [];
        let headingBuildId = h('h5', { class: "font-weight-bold" }, build.id);
        build.arches.forEach((arch, _) => {
          headingListArches.push(h('h6', {}, arch));
        });
        let leftPane = h('div', { class: "col-lg-2" }, [ headingBuildId, headingListArches ]);

        // Right pane consists of detailed package information
        let date = h('p', {}, `Release Date: ${timestampToPrettyString(build.meta['coreos-assembler.build-timestamp'])}`);
        // List of important packages and versions
        let importantPkgsElements = [];
        build.commitmeta.importantPkgs.forEach((pkg, _) => {
          importantPkgsElements.push(pkg[0]);
          importantPkgsElements.push(h('span', { class: "mr-2 badge badge-pill badge-light" }, pkg[2]));
        });

        // Added package list
        let addedPkgsElementsList = [];
        let addedPkgsHeading = [];
        if (build.meta.pkgdiff != null && build.meta.pkgdiff.added.length > 0) {
          build.meta.pkgdiff.added.forEach((pkg, _) => {
            addedPkgsElementsList.push(h('li', {}, self.getPkgNevra(pkg[2]["NewPackage"])));
          });
          addedPkgsHeading = h('p', { class: "mt-3" }, "Added:")
        }
        let addedPkgsElements = h('div', {}, [ addedPkgsHeading, h('ul', {}, addedPkgsElementsList) ]);

        // Removed package list
        let removedPkgsElementsList = [];
        let removedPkgsHeading = [];
        if (build.meta.pkgdiff != null && build.meta.pkgdiff.removed.length > 0) {
          build.meta.pkgdiff.removed.forEach((pkg, _) => {
            removedPkgsElementsList.push(h('li', {}, self.getPkgNevra(pkg[2]["PreviousPackage"])));
          });
          removedPkgsHeading = h('p', {}, "Removed:");
        }
        let removedPkgsElements = h('div', {}, [ removedPkgsHeading, h('ul', {}, removedPkgsElementsList) ]);

        // Upgraded package list
        let upgradedPkgsElementsList = [];
        let upgradedPkgsHeading = [];
        if (build.meta.pkgdiff != null && build.meta.pkgdiff.upgraded.length > 0) {
          build.meta.pkgdiff.upgraded.forEach((pkg, _) => {
            upgradedPkgsElementsList.push(h('li', {}, `${pkg[2]["PreviousPackage"][0]} ${self.getPkgEvra(pkg[2]["PreviousPackage"])} → ${self.getPkgEvra(pkg[2]["NewPackage"])}`));
          });
          upgradedPkgsHeading = h('p', {}, "Upgraded:");
        }
        let upgradedPkgsElements = h('div', {}, [ upgradedPkgsHeading, h('ul', {}, upgradedPkgsElementsList) ]);

        // Downgraded package list
        let downgradedPkgsElementsList = [];
        let downgradedPkgsHeading = [];
        if (build.meta.pkgdiff != null && build.meta.pkgdiff.downgraded.length > 0) {
          build.meta.pkgdiff.downgraded.forEach((pkg, _) => {
            downgradedPkgsElementsList.push(h('li', {}, `${pkg[2]["PreviousPackage"][0]} ${self.getPkgEvra(pkg[2]["PreviousPackage"])} → ${self.getPkgEvra(pkg[2]["NewPackage"])}`));
          });
          downgradedPkgsHeading = h('p', {}, "Downgraded:");
        }
        let downgradedPkgsElements = h('div', {}, [ downgradedPkgsHeading, h('ul', {}, downgradedPkgsElementsList) ]);

        let rightPane = h('div', { class: "col-lg-10 border-bottom mb-5 pb-3" }, [ date, importantPkgsElements, addedPkgsElements, removedPkgsElements, upgradedPkgsElements, downgradedPkgsElements ]);
        let row = h('div', { class: "row" }, [ leftPane, rightPane ]);
        rows.push(row);
      })
      return h('div', { class: "my-5" }, rows);
    },
    refreshBuilds: function() {
        this.loading = true
        this.buildsUrl = getBaseUrl(this.stream, this.developer) + "/builds"
        fetchBuilds(this.buildsUrl).then(result => {
            [legacy, builds] = result;
            // first populate and show the build list
            this.legacy = legacy;
            this.builds = [];
            this.unshown_builds = [];
            let counter = 0;

            // and now fetch each build info async
            builds.forEach((build, idx) => {
                if (idx < initialBuildsShown) {
                    this.builds.push(build);
                    fetchBuild(this.buildsUrl, build, this.legacy)
                    .then(() => {
                      counter++;
                      if (counter === builds.length) {
                        // fetched all metadata
                        this.loading = false;
                      }
                    })
                } else {
                    this.unshown_builds.push(build);
                    counter++;
                    if (counter === builds.length) {
                      // fetched all metadata
                      this.loading = false;
                    }
                }
            })
        });
    }
  },
  render: function(h) {
    let navBar = this.getNavbar(h);

    if (this.loading) {
      let loadingDiv = h('div', { class: "bg-white pb-5" }, [ h('div', { class: "container font-weight-light" }, "Loading...") ]);
      return h('div', {}, [ navBar, loadingDiv ]);
    } else {
      let releaseNoteCards = this.getReleaseNoteCards(h);
      return h('div', {}, [ navBar, releaseNoteCards ]);
    }
  }
});
