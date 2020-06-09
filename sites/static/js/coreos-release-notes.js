// There are four layers of async fetch calls
//  - releases.json
//  - builds.json
//  - meta.json
//  - commitmeta.json

// In this implementation, only render the page after fetching all
// of the four json files in the first place, and re-render if the user changes
// stream.
// NOTE: set the `initialBuildsShown` to 5 means only 5 releases will be rendered,
// which means the overhead for waiting for fetching 5 releases might not be large
// (~600ms for fetching all jsons and ~300ms for consecutive reloads).

const baseProdUrl = 'https://builds.coreos.fedoraproject.org/prod/streams'
const baseDevelUrl = 'https://builds.coreos.fedoraproject.org/devel/streams'

const initialBuildsShown = 5;

// pkgdiff enum to str
const diffType = ["added", "removed", "upgraded", "downgraded"];
const importantPkgs = ["kernel", "systemd", "rpm-ostree", "ignition", "podman", "moby-engine"];

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

// The actual fetch function for `releases.json`
function fetchReleases(base) {
  return fetch(`${base}/releases.json`)
      .then(response => response.ok ? response.json() : {"releases": []})
      .then(data => {
          return data.releases.map(release => release.version);
      });
}

// The actual fetch function for `builds.json`
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

// Gather a metadata list of builds between releases
// Pre-condition: currentReleaseIdx <= targetReleaseIdx
function gatherMetadataBtwReleases(currentReleaseIdx, targetReleaseIdx, config) {
  ({ builds, base, legacy } = config);
  let metaPromiseList = [];

  // no need to fetch the older release each time, since pkgdiff's are accumulated among
  // changes after and not including older release.
  // in the case of oldest release, however, we need to fetch the metadata for current / older / oldest
  // release, since they are pointing to the same release.
  if (currentReleaseIdx == targetReleaseIdx) {
    let metaPromise = fetchBuildMeta(base, builds[currentReleaseIdx], legacy);
    metaPromiseList.push(metaPromise);
    return Promise.all(metaPromiseList);
  }

  // check if `parent-pkgdiff` field is present, if present there's no need to manually
  // calculate pkgdiff here, use the field directly
  // xref: https://github.com/coreos/fedora-coreos-pipeline/pull/247#event-3413080221
  let metaPromise = fetchBuildMeta(base, builds[currentReleaseIdx], legacy);
  metaPromiseList.push(metaPromise);
  return Promise.all(metaPromiseList)
    .then(metaList => {
      if (metaList[0][1]['parent-pkgdiff'] == null) {
        for (let i = currentReleaseIdx + 1; i < targetReleaseIdx; i++) {
          let metaPromise = fetchBuildMeta(base, builds[i], legacy);
          metaPromiseList.push(metaPromise);
        }
      }
      return Promise.all(metaPromiseList);
    });
}

// Get an accumulated pkgdiff given a list of metadata
// e.g. given a list of build metadata fetched between two consecutive releases
// we can compute the overall accumulated pkgdiff between two releases
function getPkgDiffFromMetaList (metaList) {
  function getPkgDiffReducer(pkgDiffAcc, currentMeta) {
    // NOTE: pkgDiffAcc is the most recent diff accumulated, and currentMeta has the older pkgdiff
    if (! ("pkgdiff" in currentMeta[1])) {
      return pkgDiffAcc;
    }
    currentMeta[1].pkgdiff.map(d => {
      const pkgName = d[0];
      const diffType = d[1];
      const pkgInfo = d[2];
      let pkgNamesAcc = pkgDiffAcc.map(dAcc => dAcc[0]);
      // if the pkgdiff is first encountered, add it to accumulator
      if (pkgNamesAcc.indexOf(pkgName) < 0) {
        pkgDiffAcc.push(d);
        return;
      }

      // added pkgdiff type
      if (diffType == 0) {
        let pkgDiffAccCpy = [...pkgDiffAcc];
        for (let i = 0; i < pkgDiffAccCpy.length; i++) {
          const dAcc = pkgDiffAccCpy[i];
          // added first then later removed
          if (dAcc[0] == pkgName && dAcc[1] == 1) {
            // replace with empty list and remove later
            pkgDiffAccCpy[i] = [];
            break;
          }
          // added first then later upgraded
          if (dAcc[0] == pkgName && dAcc[1] == 2) {
            pkgDiffAccCpy[i] = d;
            pkgDiffAccCpy[i][2].NewPackage[1] = dAcc[2].NewPackage[1];
            break;
          }
          // added first then later downgraded
          if (dAcc[0] == pkgName && dAcc[1] == 3) {
            pkgDiffAccCpy[i] = d;
            pkgDiffAccCpy[i][2].NewPackage[1] = dAcc[2].NewPackage[1];
            break;
          }
        }
        pkgDiffAccCpy = pkgDiffAccCpy.filter(dAcc => dAcc.length != 0);
        pkgDiffAcc = [...pkgDiffAccCpy];
      }

      // removed pkgdiff type
      if (diffType == 1) {
        let pkgDiffAccCpy = [...pkgDiffAcc];
        for (let i = 0; i < pkgDiffAccCpy.length; i++) {
          const dAcc = pkgDiffAccCpy[i];
          // removed first then later added
          if (dAcc[0] == pkgName && dAcc[1] == 0) {
            // replace with empty list and remove later
            pkgDiffAccCpy[i] = [];
            break;
          }
        }
        pkgDiffAccCpy = pkgDiffAccCpy.filter(dAcc => dAcc.length != 0);
        pkgDiffAcc = [...pkgDiffAccCpy];
      }

      // upgraded pkgdiff type
      if (diffType == 2) {
        let pkgDiffAccCpy = [...pkgDiffAcc];
        for (let i = 0; i < pkgDiffAccCpy.length; i++) {
          const dAcc = pkgDiffAccCpy[i];
          // upgraded first then later removed
          if (dAcc[0] == pkgName && dAcc[1] == 1) {
            // should be removing the previous version
            pkgDiffAccCpy[i][2].PreviousPackage[1] = pkgInfo.PreviousPackage[1];
            break;
          }
          // upgraded first then later upgraded again
          if (dAcc[0] == pkgName && dAcc[1] == 2) {
            pkgDiffAccCpy[i] = d;
            pkgDiffAccCpy[i][2].NewPackage[1] = dAcc[2].NewPackage[1];
            break;
          }
          // upgraded first then later downgraded
          if (dAcc[0] == pkgName && dAcc[1] == 3) {
            // checks if versions have changed
            let strcmp = (s1, s2) => s1.localeCompare(s2);
            if (strcmp(pkgDiffAccCpy[i][2].NewPackage[1], pkgInfo.PreviousPackage[1]) == 0) {
              pkgDiffAccCpy[i] = [];
            } else if (strcmp(pkgDiffAccCpy[i][2].NewPackage[1], pkgInfo.PreviousPackage[1]) > 0) {
              // overall, an upgrade
              pkgDiffAccCpyp[i] = d;
              pkgDiffAccCpy[i][2].NewPackage[1] = dAcc[2].NewPackage[1];
            } else {
              // overall, a downgrade
              pkgDiffAccCpy[i][2].PreviousPackage[1] = pkgInfo.PreviousPackage[1];
            }
            break;
          }
        }
        pkgDiffAccCpy = pkgDiffAccCpy.filter(dAcc => dAcc.length != 0);
        pkgDiffAcc = [...pkgDiffAccCpy];
      }

      // downgraded pkgdiff type
      if (diffType == 3) {
        let pkgDiffAccCpy = [...pkgDiffAcc];
        for (let i = 0; i < pkgDiffAccCpy.length; i++) {
          const dAcc = pkgDiffAccCpy[i];
          // downgraded first then later removed
          if (dAcc[0] == pkgName && dAcc[1] == 1) {
            // should be removing the previous version
            pkgDiffAccCpy[i][2].PreviousPackage[1] = pkgInfo.PreviousPackage[1];
            break;
          }
          // downgraded first then later upgraded
          if (dAcc[0] == pkgName && dAcc[1] == 2) {
            // checks if versions have changed
            let strcmp = (s1, s2) => s1.localeCompare(s2);
            if (strcmp(pkgDiffAccCpy[i][2].NewPackage[1], pkgInfo.PreviousPackage[1]) == 0) {
              pkgDiffAccCpy[i] = [];
            } else if (strcmp(pkgDiffAccCpy[i][2].NewPackage[1], pkgInfo.PreviousPackage[1]) > 0) {
              // overall, an upgrade
              pkgDiffAccCpy[i][2].PreviousPackage[1] = pkgInfo.PreviousPackage[1];
            } else {
              // overall, a downgrade
              pkgDiffAccCpyp[i] = d;
              pkgDiffAccCpy[i][2].NewPackage[1] = dAcc[2].NewPackage[1];
            }
            break;
          }
          // upgraded first then later downgraded
          if (dAcc[0] == pkgName && dAcc[1] == 3) {
            pkgDiffAccCpy[i] = d;
            pkgDiffAccCpy[i][2].NewPackage[1] = dAcc[2].NewPackage[1];
            break;
          }
        }
        pkgDiffAccCpy = pkgDiffAccCpy.filter(dAcc => dAcc.length != 0);
        pkgDiffAcc = [...pkgDiffAccCpy];
      }

    })

    return pkgDiffAcc;

  }

  let pkgdiff = metaList.reduce(getPkgDiffReducer, []);
  return pkgdiff;
}

// Fetch the metadata of the release `builds[fromIdx]`
// and also calculate the accumulated pkgdiff between the last release `builds[toIdx]`
// Note: meta.json is used for pkgdiff and commitmeta.json contains pkglist
function fetchBuild(base, legacy, builds, fromIdx, toIdx) {
  let config = { builds, base, legacy };
  return gatherMetadataBtwReleases(fromIdx, toIdx, config).then(metaList => {
    let build = builds[fromIdx];
    let [basearch, meta] = metaList[0];
    // check if `parent-pkgdiff` field is present, if present there's no need to manually
    // calculate pkgdiff here, use the field directly
    // xref: https://github.com/coreos/fedora-coreos-pipeline/pull/247#event-3413080221
    meta.pkgdiff = meta['parent-pkgdiff'] == null ? getPkgDiffFromMetaList(metaList) : meta['parent-pkgdiff'];
    sortPkgDiff(meta);
    build.meta = meta;
    // and fetch extra commit metadata in async
    return fetchBuildCommitMeta(base, build, basearch, legacy).then(commitmeta => {
      commitmeta["importantPkgs"] = findImportantPkgs(commitmeta);
      commitmeta["showImportantPkgsOnly"] = true;
      build.commitmeta = commitmeta;
      builds[fromIdx] = build;
    });
  });
}

// The actual fetch function for `meta.json`
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

// The actual fetch function for `commitmeta.json`
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
    releases: [],
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
        const overviewPageUrl = window.location.href.match(/^.*\/coreos/)[0];
        history.replaceState(null, null, `${overviewPageUrl}?stream=${self.stream}`);
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
      // check if all release metadata has been fetched
      if (self.loading) {
        return;
      }

      rows = [];
      self.releases.forEach((build, idx) => {
        // checked if build metadata has been fetched
        if (build.arches.length == 0 || build.meta == null || build.commitmeta == null) {
          return;
        }

        // Left pane consists of Build ID and Arch info
        let headingListArches = [];
        let headingBuildId = h('h5', { class: "font-weight-normal" }, build.id);
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

        // Summary of pkglist and pkgdiffs with expand buttons
        let pkgSummaryElements = []
          .concat(`${build.commitmeta['rpmostree.rpmdb.pkglist'].length} packages (`)
          .concat(
            h('a', {
              attrs: {
                href: "#"
              },
              on: {
                click: function(e) {
                  e.preventDefault();
                  let totalPkgListElement = e.target.parentElement.nextSibling;
                  if (totalPkgListElement.hidden == true) {
                    totalPkgListElement.hidden = false;
                    e.target.innerText = 'collapse';
                  } else {
                    totalPkgListElement.hidden = true;
                    e.target.innerText = 'expand';
                  }
                }
              }
            }, 'expand')
          )
          .concat('); ')
        // Next, append the pkgdiffs summary
        // `added` summary and expand button
        if (build.meta.pkgdiff != {} && build.meta.pkgdiff.added.length > 0) {
          pkgSummaryElements = pkgSummaryElements.concat(
            `${build.meta.pkgdiff.added.length} added (`
          )
          .concat(
            h('a', {
              attrs: {
                href: "#"
              },
              on: {
                click: function(e) {
                  e.preventDefault();
                  let totalPkgListElement = e.target.parentElement
                                             .nextSibling
                                             .nextSibling;
                  if (totalPkgListElement.hidden == true) {
                    totalPkgListElement.hidden = false;
                    e.target.innerText = 'collapse';
                  } else {
                    totalPkgListElement.hidden = true;
                    e.target.innerText = 'expand';
                  }
                }
              }
            }, 'expand')
          )
          .concat('); ');
        }

        // `removed` summary and expand button
        if (build.meta.pkgdiff != {} && build.meta.pkgdiff.removed.length > 0) {
          pkgSummaryElements = pkgSummaryElements.concat(
            `${build.meta.pkgdiff.removed.length} removed (`
          )
          .concat(
            h('a', {
              attrs: {
                href: "#"
              },
              on: {
                click: function(e) {
                  e.preventDefault();
                  let totalPkgListElement = e.target.parentElement
                                             .nextSibling
                                             .nextSibling
                                             .nextSibling;
                  if (totalPkgListElement.hidden == true) {
                    totalPkgListElement.hidden = false;
                    e.target.innerText = 'collapse';
                  } else {
                    totalPkgListElement.hidden = true;
                    e.target.innerText = 'expand';
                  }
                }
              }
            }, 'expand')
          )
          .concat('); ');
        }

        // `upgraded` summary and expand button
        if (build.meta.pkgdiff != {} && build.meta.pkgdiff.upgraded.length > 0) {
          pkgSummaryElements = pkgSummaryElements.concat(
            `${build.meta.pkgdiff.upgraded.length} upgraded (`
          )
          .concat(
            h('a', {
              attrs: {
                href: "#"
              },
              on: {
                click: function(e) {
                  e.preventDefault();
                  let totalPkgListElement = e.target.parentElement
                                             .nextSibling
                                             .nextSibling
                                             .nextSibling
                                             .nextSibling;
                  if (totalPkgListElement.hidden == true) {
                    totalPkgListElement.hidden = false;
                    e.target.innerText = 'collapse';
                  } else {
                    totalPkgListElement.hidden = true;
                    e.target.innerText = 'expand';
                  }
                }
              }
            }, 'expand')
          )
          .concat('); ');
        }

        // `downgraded` summary and expand button
        if (build.meta.pkgdiff != {} && build.meta.pkgdiff.downgraded.length > 0) {
          pkgSummaryElements = pkgSummaryElements.concat(
            `${build.meta.pkgdiff.downgraded.length} downgraded (`
          )
          .concat(
            h('a', {
              attrs: {
                href: "#"
              },
              on: {
                click: function(e) {
                  e.preventDefault();
                  let totalPkgListElement = e.target.parentElement
                                             .nextSibling
                                             .nextSibling
                                             .nextSibling
                                             .nextSibling
                                             .nextSibling;
                  if (totalPkgListElement.hidden == true) {
                    totalPkgListElement.hidden = false;
                    e.target.innerText = 'collapse';
                  } else {
                    totalPkgListElement.hidden = true;
                    e.target.innerText = 'expand';
                  }
                }
              }
            }, 'expand')
          )
          .concat('); ');
        }

        let pkgSummaryDiv = h('div', { class: "mt-3" }, pkgSummaryElements);

        // Package list
        let totalPkgsElementsList = [];
        let totalPkgsHeading = [];
        if (build.commitmeta['rpmostree.rpmdb.pkglist'].length > 0) {
          build.commitmeta['rpmostree.rpmdb.pkglist'].forEach((pkg, _) => {
            totalPkgsElementsList.push(h('li', {}, self.getPkgNevraFull(pkg)));
          });
          totalPkgsHeading = h('p', { class: "mt-3" }, "Package List:")
        }
        let totalPkgsElements = h('div', { attrs: { hidden: true } }, [ totalPkgsHeading, h('ul', {}, totalPkgsElementsList) ]);

        // Added package list
        let addedPkgsElementsList = [];
        let addedPkgsHeading = [];
        if (build.meta.pkgdiff != {} && build.meta.pkgdiff.added.length > 0) {
          build.meta.pkgdiff.added.forEach((pkg, _) => {
            addedPkgsElementsList.push(h('li', {}, self.getPkgNevra(pkg[2]["NewPackage"])));
          });
          addedPkgsHeading = h('p', { class: "mt-3" }, "Added:")
        }
        let addedPkgsElements = h('div', { attrs: { hidden: true } }, [ addedPkgsHeading, h('ul', {}, addedPkgsElementsList) ]);

        // Removed package list
        let removedPkgsElementsList = [];
        let removedPkgsHeading = [];
        if (build.meta.pkgdiff != {} && build.meta.pkgdiff.removed.length > 0) {
          build.meta.pkgdiff.removed.forEach((pkg, _) => {
            removedPkgsElementsList.push(h('li', {}, self.getPkgNevra(pkg[2]["PreviousPackage"])));
          });
          removedPkgsHeading = h('p', { class: "mt-3" }, "Removed:");
        }
        let removedPkgsElements = h('div', { attrs: { hidden: true } }, [ removedPkgsHeading, h('ul', {}, removedPkgsElementsList) ]);

        // Upgraded package list
        let upgradedPkgsElementsList = [];
        let upgradedPkgsHeading = [];
        if (build.meta.pkgdiff != {} && build.meta.pkgdiff.upgraded.length > 0) {
          build.meta.pkgdiff.upgraded.forEach((pkg, _) => {
            upgradedPkgsElementsList.push(h('li', {}, `${pkg[2]["PreviousPackage"][0]} ${self.getPkgEvra(pkg[2]["PreviousPackage"])} → ${self.getPkgEvra(pkg[2]["NewPackage"])}`));
          });
          upgradedPkgsHeading = h('p', { class: "mt-3" }, "Upgraded:");
        }
        let upgradedPkgsElements = h('div', { attrs: { hidden: true } }, [ upgradedPkgsHeading, h('ul', {}, upgradedPkgsElementsList) ]);

        // Downgraded package list
        let downgradedPkgsElementsList = [];
        let downgradedPkgsHeading = [];
        if (build.meta.pkgdiff != {} && build.meta.pkgdiff.downgraded.length > 0) {
          build.meta.pkgdiff.downgraded.forEach((pkg, _) => {
            downgradedPkgsElementsList.push(h('li', {}, `${pkg[2]["PreviousPackage"][0]} ${self.getPkgEvra(pkg[2]["PreviousPackage"])} → ${self.getPkgEvra(pkg[2]["NewPackage"])}`));
          });
          downgradedPkgsHeading = h('p', { class: "mt-3" }, "Downgraded:");
        }
        let downgradedPkgsElements = h('div', { attrs: { hidden: true } }, [ downgradedPkgsHeading, h('ul', {}, downgradedPkgsElementsList) ]);

        let rightPane = h('div', { class: "col-lg-10 border-bottom mb-5 pb-4" }, [ date, importantPkgsElements, pkgSummaryDiv, totalPkgsElements, addedPkgsElements, removedPkgsElements, upgradedPkgsElements, downgradedPkgsElements ]);
        let row = h('div', { class: "row" }, [ leftPane, rightPane ]);
        rows.push(row);
      })
      return h('div', { class: "my-5" }, rows);
    },
    refreshBuilds: function() {
        this.loading = true
        this.releasesUrl = getBaseUrl(this.stream, this.developer);
        this.buildsUrl = getBaseUrl(this.stream, this.developer) + "/builds";
        fetchReleases(this.releasesUrl).then(releaseVersions => {
          fetchBuilds(this.buildsUrl).then(result => {
            [legacy, builds] = result;
            // first populate and show the build list
            this.legacy = legacy;
            this.releases = [];
            this.unshown_builds = [];
            // counter for the number of release metadata fetched since fetch is asnyc operation
            let counter = 0;

            // get the index list of release builds in the build list
            const releaseIdxList = builds.map((build, idx) => releaseVersions.includes(build.id) ? idx : -1).filter(idx => idx != -1);
            const numReleases = releaseIdxList.length;

            // fetch the metadata and compute the pkgdiff for subsequent releases
            // since the oldest release does not have a pkgdiff, the pkgdiff for oldest release is an empty array
            for (let i = 0; i < numReleases; i++) {
              const releaseIdx = releaseIdxList[i];
              // in case of oldest release, there's no older release
              const nextReleaseIdx = releaseIdxList[i + 1] == null ? releaseIdxList[i] : releaseIdxList[i + 1];
              if (i < initialBuildsShown) {
                // NOTE: here only the `builds` array have the actual values, all other variables are pointers to the elements of this array
                this.releases.push(builds[releaseIdx]);
                // fetchBuild mutates the `builds` array
                fetchBuild(this.buildsUrl, this.legacy, builds, releaseIdx, nextReleaseIdx)
                .then(() => {
                  counter++;
                  if (counter === numReleases) {
                    // fetched all metadata
                    this.loading = false;
                  }
                });
              } else {
                // XXX: unshown/unprocessed releases, could be handled later according to needs
                this.unshown_builds.push(builds[releaseIdx]);
                counter++;
                if (counter === numReleases) {
                  // fetched all metadata
                  this.loading = false;
                }
              }
            }
          });
        });
    }
  },
  render: function(h) {
    // Duplicate logic from coreos-download.js
    // URL paramters checking and setting default values
    if(window.location.href.match(/^.*\/coreos/) == null) {
      return
    }
    const overviewPageUrl = window.location.href.match(/^.*\/coreos/)[0];
    searchParams = new URLSearchParams(window.location.search);
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
    history.replaceState(null, null, `${overviewPageUrl}?${searchParams.toString()}`);

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
