FROM registry.fedoraproject.org/fedora:34

WORKDIR /opt/sites/getfedora.org/

RUN dnf -y install \
    git \
    python3-flask \
    python3-frozen-flask \
    python3-flask-assets \
    python3-rjsmin \
    python3-cssmin \
    python3-flask-babel \
    python3-flask-htmlmin \
    python3-cssutils \
    rubygem-sass \
    babel \
    python3-jinja2 \
    python3-pyyaml \
    python3-dateutil \
    python3-dogpile-cache \
    python3-requests \
    python3-gnupg \
    python3-fedfind && \
      dnf clean all

ENV FLASK_APP main.py

EXPOSE 5000
