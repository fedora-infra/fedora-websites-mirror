FROM fedora:latest as builder

COPY sites /sites
WORKDIR /sites

RUN dnf -y install python-flask python-frozen-flask python-flask-assets python-rjsmin python-cssmin python-flask-babel python-flask-htmlmin python-cssutils rubygem-sass babel python3-jinja2 python-pyyaml python-zanata-client \
    && dnf clean all \
    && mkdir /built \
    && cd getfedora.org && ./scripts/pull-translations.sh \
    && python main.py && mv build /built/getfedora.org
#    && cd getfedora.org && python main.py && mv build /built/getfedora.org
#     ...

FROM fedora:latest

COPY --from=builder /built/ /var/www/html/
COPY container/conf.d/*.conf /etc/httpd/conf.d/
COPY container/httpd.conf /etc/httpd/conf/httpd.conf

RUN dnf -y install httpd \
    && dnf clean all \
    && chown apache:0 /etc/httpd/conf/httpd.conf \
    && chmod g+r /etc/httpd/conf/httpd.conf \
    && chown apache:0 /var/log/httpd  \
    && chmod g+rwX /var/log/httpd \
    && chown apache:0 /var/run/httpd \
    && chmod g+rwX /var/run/httpd\
    && chown -R apache:0 /var/www/html \
    && chmod -R g+rwX /var/www/html

EXPOSE 8080
USER apache
ENTRYPOINT httpd -DFOREGROUND -DNO_DETACH
