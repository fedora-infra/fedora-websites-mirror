# Websites

This repository hosts static generator home of https://getfedora.org, and hopefully eventually the
other Fedora Project websites.

### Contributing

Documentation for getting started with using it can be found here:

 * https://docs.fedoraproject.org/en-US/websites/ - general info
 * https://docs.fedoraproject.org/en-US/websites/engg/setup-modern/ - development setup
 * https://docs.fedoraproject.org/en-US/websites/engg/new-fedora-release/ - how it works

Translations are handled by the Fedora [localization team](https://fedoraproject.org/wiki/L10N) on [Fedora Weblate](https://translate.fedoraproject.org/projects/fedora-websites/).

[![Translation status](https://translate.fedoraproject.org/widgets/fedora-websites/-/287x66-white.png)](https://translate.fedoraproject.org/engage/fedora-websites/?utm_source=widget)

### Building Locally

Podman is the recommended way of building fedora-websites.

From the root of the repository, run the following commands to build the necessary components:

```
podman build -t fedora-websites .
podman run -it --rm -v "$(pwd):/opt/:z" fedora-websites ./scripts/pull-translations.sh
podman run -it --rm -v "$(pwd):/opt/:z" fedora-websites python3 ./scripts/pull-magazine.py
podman run -it --rm -v "$(pwd):/opt/:z" fedora-websites python3 main.py
```

Now we are ready to run the development server:

```
podman run -it --rm -v "$(pwd):/opt/:z" -p 5000:5000 fedora-websites flask run --reload --host 0.0.0.0
```

You may now go to <http://localhost:5000/> in your browser of choice.
