<template>
  <div id="app">
    <div v-if="loading">
      Loading...
    </div>
    <div v-else-if="streamData">
      <p>Stream: <span class="font-weight-bold">{{ streamData.stream }}</span>
        (<a v-bind:href="getObjectUrl(streamData.stream + '.json')">JSON</a>)
        <span v-if="streamData.metadata" v-bind:title="streamData.metadata['last-modified']">
          — {{ timeSince(streamData.metadata['last-modified']) }}
        </span>
      </p>

      <div v-if="streamData.architectures[architecture]">
        <div class="px-1 py-2 my-2">
          <h3 class="font-weight-light">Cloud Launchable</h3>
          <div class="col">
            <div v-if="streamData.architectures[architecture].images">
              <div v-for="(image, provider) in streamData.architectures[architecture].images"  v-bind:key="image">
                <div class="py-2">
                  <div v-if="isAws(provider)" class="ml-2">
                    <div v-if="image.regions">
                      <div v-for="(region, regionName) in image.regions"  v-bind:key="region">
                        <div class="font-weight-bold">{{ displayPrettyProvider(provider, null) }}</div>
                        <div>({{ regionName }})</div>
                        <div v-if="region.release" class="ml-2">{{ region.release }} {{ streamData.stream }}</div>
                        <div v-if="region.image" class="ml-2">image: {{ region.image }}</div>
                      </div>
                    </div>
                  </div>
                  <div v-else class="ml-2">
                    <div class="font-weight-bold">{{ displayPrettyProvider(provider, extension) }}</div>
                    <div v-if="image.image" class="ml-2">image: {{ image.image }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <hr>
        <div class="py-2">
          <h3 class="font-weight-light">Bare Metal & Virtualized</h3>
          <div class="container">
            <div class="row">
              <div class="col-lg-6">
                <div v-if="streamData.architectures[architecture].artifacts.metal.formats" class="ml-2">
                  <h4 class="font-weight-light">Bare Metal</h4>
                  <div v-for="(format, extension) in streamData.architectures[architecture].artifacts.metal.formats"  v-bind:key="format">
                    <div class="py-2">
                      <div class="font-weight-bold">{{ displayPrettyProvider('metal', extension) }}</div>
                      <!-- XXX: the conditions to display the extension here are quickly hacked in; if adding any further conditions this should be handled elsewhere in a better organized structure. -->
                      <div v-if="extension != 'installer-pxe' && extension != 'pxe'">({{ (extension != 'installer.iso') ? extension : ".iso" }})</div>
                      <div v-if="streamData.architectures[architecture].artifacts.metal.release" class="ml-2">
                          {{ streamData.architectures[architecture].artifacts.metal.release }} {{ streamData.stream }}
                      </div>
                      <div v-if="format.disk" class="ml-2">
                        <span v-if="format.disk.location">
                          <a v-bind:href="format.disk.location">Download</a>
                        </span>
                        <div><button v-on:click="toggleShowSignatureAndSha('bareMetal', 'metal', extension, 'disk')" class="btn btn-sm btn-outline-fedora-magenta mt-2">Verify signature & sha256</button></div>
                        <div v-if="showSignatureAndSha('bareMetal', 'metal', extension, 'disk')" class="coreos-signature-box bg-gray-100 p-1 my-2">
                          <div v-if="format.disk.signature">
                            <span>signature: </span><span><a v-bind:href="format.disk.signature">Download</a></span>
                          </div>
                          <div v-if="format.disk.sha256">
                            <span>sha256: </span><span>{{ format.disk.sha256 }}</span>
                          </div>
                        </div>
                      </div>
                      <div v-if="format.kernel" class="ml-2">
                        <span>kernel:</span>
                        <span v-if="format.kernel.location">
                          <a v-bind:href="format.kernel.location">Download</a>
                        </span>
                        <div><button v-on:click="toggleShowSignatureAndSha('bareMetal', 'metal', extension, 'kernel')" class="btn btn-sm btn-outline-fedora-magenta mt-2">Verify signature & sha256</button></div>
                        <div v-if="showSignatureAndSha('bareMetal', 'metal', extension, 'kernel')" class="coreos-signature-box bg-gray-100 p-1 my-2">
                          <div v-if="format.kernel.signature">
                            <span>signature: </span><span><a v-bind:href="format.kernel.signature">Download</a></span>
                          </div>
                          <div v-if="format.kernel.sha256">
                            <span>sha256: </span><span>{{ format.kernel.sha256 }}</span>
                          </div>
                        </div>
                      </div>
                      <div v-if="format.initramfs" class="ml-2">
                        <span>initramfs:</span>
                        <span v-if="format.initramfs.location">
                          <a v-bind:href="format.initramfs.location">Download</a>
                        </span>
                        <div><button v-on:click="toggleShowSignatureAndSha('bareMetal', 'metal', extension, 'initramfs')" class="btn btn-sm btn-outline-fedora-magenta mt-2">Verify signature & sha256</button></div>
                        <div v-if="showSignatureAndSha('bareMetal', 'metal', extension, 'initramfs')" class="coreos-signature-box bg-gray-100 p-1 my-2">
                          <div v-if="format.initramfs.signature">
                            <span>signature: </span><span><a v-bind:href="format.initramfs.signature">Download</a></span>
                          </div>
                          <div v-if="format.initramfs.sha256">
                            <span>sha256: </span><span>{{ format.initramfs.sha256 }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="col-lg-6">
                <div class="ml-2">
                  <h4 class="font-weight-light">Virtualized</h4>
                  <div v-if="streamData.architectures[architecture].artifacts">
                    <div v-for="(artifact, provider) in streamData.architectures[architecture].artifacts"  v-bind:key="artifact">
                        <div v-if="isVirtualizedImage(provider) && artifact.formats" class="ml-2">
                          <div class="py-2">
                          <div v-for="(format, extension) in artifact.formats"  v-bind:key="format">
                            <div class="font-weight-bold">{{ displayPrettyProvider(provider, extension) }}</div>
                            <div>({{ extension }})</div>
                            <div v-if="artifact.release" class="ml-2">
                              {{ artifact.release }} {{ streamData.stream }} 
                            </div>
                            <div v-if="format.disk" class="ml-2">
                              <span v-if="format.disk.location">
                                <a v-bind:href="format.disk.location">Download</a>
                              </span>
                              <div><button v-on:click="toggleShowSignatureAndSha('virtualized', provider, extension, 'disk')" class="btn btn-sm btn-outline-fedora-magenta mt-2">Verify signature & sha256</button></div>
                              <div v-if="showSignatureAndSha('virtualized', provider, extension, 'disk')" class="coreos-signature-box bg-gray-100 p-1 my-2">
                                <div v-if="format.disk.signature">
                                  <span>signature: </span><span><a v-bind:href="format.disk.signature">Download</a></span>
                                </div>
                                <div v-if="format.disk.sha256">
                                  <span>sha256: </span><span>{{ format.disk.sha256 }}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <hr>
        <div class="px-1 py-2 my-2">
          <h3 class="font-weight-light">For Cloud Operators</h3>
          <div class="col">
            <div v-if="streamData.architectures[architecture].artifacts">
              <div v-for="(artifact, provider) in streamData.architectures[architecture].artifacts" v-bind:key="artifact">
                <div v-if="isCloudImage(provider) && artifact.formats" class="ml-2">
                  <div class="py-2">
                    <div v-for="(format, extension) in artifact.formats"  v-bind:key="format">
                      <div class="font-weight-bold">{{ displayPrettyProvider(provider, extension) }}</div>
                      <div>({{ extension }})</div>
                      <div v-if="artifact.release" class="ml-2">
                        {{ artifact.release }} {{ streamData.stream }}
                      </div>
                      <div v-if="format.disk" class="ml-2">
                        <span v-if="format.disk.location">
                          <a v-bind:href="format.disk.location">Download</a>
                        </span>
                        <div><button v-on:click="toggleShowSignatureAndSha('cloud', provider, extension, 'disk')" class="btn btn-sm btn-outline-fedora-magenta mt-2">Verify signature & sha256</button></div>
                        <div v-if="showSignatureAndSha('cloud', provider, extension, 'disk')" class="coreos-signature-box bg-gray-100 p-1 my-2">
                          <div v-if="format.disk.signature">
                            <span>signature: </span><span><a v-bind:href="format.disk.signature">Download</a></span>
                          </div>
                          <div v-if="format.disk.sha256">
                            <span>sha256: </span><span>{{ format.disk.sha256 }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div> <!-- end streamData-->
    <div v-else>
      No stream data found!
    </div>
  </div>
</template>

<script>

export default {
  el: '#app',
  data () {
    return {
      // PROD:
      //const baseUrl = 'https://builds.coreos.fedoraproject.org/streams'
      // DEVEL:
      //const baseUrl = 'https://s3.amazonaws.com/fcos-builds/streams'
      baseUrl: 'https://builds.coreos.fedoraproject.org/streams',
      // list of cloud image artifacts
      cloudImages: ['aws', 'azure', 'digitalocean', 'gcp', 'openstack', 'packet'],
      // list of virtualized image artifacts
      virtualizedImages: ['openstack', 'qemu', 'virtualbox', 'vmware'],
      // dict of pretty names for providers, indexed by provider.extension
      prettyProviders: {
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
      },
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
    }
  },
  created: function() { this.refreshStream() },
  watch: { stream: 'refreshStream' },
  methods: {
    getMember: function(obj, member) {
      return (member in obj) ? obj[member] : null;
    },
    getArtifactUrl: function(base, path)  {
      return `${base}/${path}`;
    },
    fetchStreamData: function(base, stream) {
      return fetch(`${base}/${stream}.json`)
        .then(response => response.ok ? response.json() : {});
    },
    copyToClipboard: function(text) {
      navigator.clipboard.writeText(text);
    },
    getPrettyProvider: function(provider, extension) {
      var prettyProvider = this.getMember(this.prettyProviders, provider);
      if (prettyProvider != null) {
        // XXX: just check if the provider is metal. This check should be more generic and apply to other providers.
        if (provider == "metal" && extension != null) {
          var prettyProviderExtension = this.getMember(this.prettyProviders[provider], extension);
          if (prettyProviderExtension != null) {
            return prettyProviderExtension;
          }
        }
        return prettyProvider;
      }
      // Fall back and return the machine-readable provider name.
      return provider;
    },
    refreshStream: function() {
      this.loading = true
      this.streamUrl = this.baseUrl
      this.fetchStreamData(this.streamUrl, this.stream).then(streamData => {
        this.loading = false;
        this.streamData = streamData;
      });
    },
    getObjectUrl: function(path) {
      return this.getArtifactUrl(this.streamUrl, path);
    },
    isAws(provider) {
      return provider == "aws";
    },
    isVirtualizedImage: function(provider) {
      return this.virtualizedImages.includes(provider);
    },
    isCloudImage: function(provider) {
      return this.cloudImages.includes(provider);
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
      return this.getPrettyProvider(provider, extension);
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
      }
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
}
</script>

<style>
#app {
  
}
</style>
