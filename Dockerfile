FROM fedora:29

WORKDIR /opt/sites/getfedora.org/

RUN dnf -y install \
    python-flask \
    python-frozen-flask \
    python-flask-assets \
    python-rjsmin \
    python-cssmin \
    python-flask-babel \
    python-flask-htmlmin \
    python-cssutils \
    rubygem-sass \
    babel \
    python3-jinja2 \
    python-pyyaml \
    python-dateutil \
    python-dogpile-cache \
    python-requests \
    python-zanata-client && \
      dnf clean all

ENV FLASK_APP main.py

EXPOSE 5000
