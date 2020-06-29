# Websites

This repository is the home of getfedora.org, and hopefully eventually the
other Fedora Project websites.

### Contributing

Documentation for getting started with using it can be found here:
https://docs.fedoraproject.org/en-US/websites/

Translations are handled by the Fedora [localization team](https://fedoraproject.org/wiki/L10N) on [Fedora Weblate](https://translate.stg.fedoraproject.org/projects/fedora-websites/).

[![Translation status](https://translate.stg.fedoraproject.org/widgets/fedora-websites/-/287x66-white.png)](https://translate.stg.fedoraproject.org/engage/fedora-websites/?utm_source=widget)

### Building Locally

Podman is the recommended way of building fedora-websites.

From the root of the repository, run the following commands to start a local server:

```
podman build -t fedora-websites .
podman run -it --rm -v "$(pwd):/opt/:z" fedora-websites ./scripts/pull-translations.sh
podman run -it --rm -v "$(pwd):/opt/:z" fedora-websites python ./scripts/pull-magazine.py
podman run -it --rm -v "$(pwd):/opt/:z" fedora-websites python main.py
```
