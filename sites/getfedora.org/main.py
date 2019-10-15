# -*- coding: utf-8 -*-

from flask import Blueprint, Flask, abort, g, render_template, redirect, request, Response, send_from_directory, url_for
from flask_babel import Babel
from flask_assets import Environment, Bundle
from flask_frozen import Freezer
from flask_htmlmin import HTMLMIN
import jinja2
import os
import yaml

# TODO: Is there a nicer way to represent the data globalvar has?
import globalvar

#FEDORA_LANGUAGES = { 'en' : 'English' , 'de': 'Deutsch'}

# List of langs from old getfedora.org
FEDORA_LANGUAGES_FULL = { 'en' : u'English',
                          'af': u'Afrikaans',
                          'ar': u'عربي',
                          'as': u'অসমীয়া',
                          'ast': u'Asturianu',
                          'bal': u'بلوچی',
                          'bg': u'български език',
                          'bn': u'বাংলা',
                          'bn_IN': u'বাংলা (ভারত)',
                          'br': u'Brezhoneg',
                          'ca': u'Català',
                          'cs': u'česky',
                          'da': u'dansk',
                          'de': u'Deutsch',
                          'el': u'Ελληνικά',
                          'en': u'English',
                          'en_GB': u'English (UK)',
                          'eo': u'Esperanto',
                          'es': u'Español',
                          'eu': u'euskera',
                          'fa': u'پارسی',
                          'fi': u'suomi',
                          'fr': u'Français',
                          'fur': u'Friulian',
                          'gl': u'galego',
                          'gu': u'ગુજરાતી',
                          'he': u'עברית',
                          'hi': u'हिन्दी',
                          'hu': u'Magyar',
                          'ia': u'Interlingua',
                          'id': u'Indonesia',
                          'is': u'Íslenska',
                          'it': u'Italiano',
                          'ja': u'日本語',
                          'ka': u'ქართული',
                          'kn': u'ಕನ್ನಡ',
                          'ko': u'한국어',
                          'lv': u'latviešu',
                          'ml': u'മലയാളം',
                          'mr': u'मराठी',
                          'nb': u'Norsk bokmål',
                          'nl': u'Nederlands',
                          'or': u'ଓଡ଼ିଆ',
                          'pa': u'ਪੰਜਾਬੀ',
                          'pl': u'polski',
                          'pt': u'Português',
                          'pt_BR': u'Português brasileiro',
                          'ro': u'română',
                          'ru': u'Pусский',
                          'sk': u'slovenčina',
                          'sq': u'Shqip',
                          'sr': u'српски',
                          'sv': u'svenska',
                          'ta': u'தமிழ்',
                          'te': u'తెలుగు',
                          'tg': u'тоҷикӣ',
                          'th': u'ไทย',
                          'tr': u'Tϋrkçe',
                          'uk': u'українська',
                          'vi': u'Tiếng Việt',
                          'zh_CN': u'简体中文',
                          'zh_TW': u'正體中文'}

FEDORA_LANGUAGE_DEFAULT = 'en'

# Only include translations which actually have a translations file
FEDORA_LANGUAGES = {k: v for k, v in FEDORA_LANGUAGES_FULL.items() if k in os.listdir('translations') or k == FEDORA_LANGUAGE_DEFAULT}

# Set this early so we can base routing logic on it.
if __name__ == '__main__':
    freezing = True
else:
    freezing = False

app = Flask(__name__, static_folder='../static/', static_url_path='/static')
app.config['TEMPLATES_AUTO_RELOAD'] = True

app.config['BABEL_DEFAULT_LOCALE'] = FEDORA_LANGUAGE_DEFAULT
app.jinja_options = {'extensions': ['jinja2.ext.with_', 'jinja2.ext.i18n']}
babel = Babel(app)

assets = Environment(app)
assets.url_expire = True

freezer = Freezer(app)
app.config['FREEZER_STATIC_IGNORE'] += ['/css', '/js', '/vendor']

js = Bundle(
    '../static/vendor/jquery-3.3.1/jquery-3.3.1.min.js',
    '../static/vendor/bootstrap-4.3.1/dist/js/bootstrap.bundle.js',
    '../static/js/popover.js',
    '../static/js/magazine.js',
    filters='rjsmin',
    output='js/bundle.js')
assets.register('js_all', js)

css = Bundle(
    '../static/scss/fedora.scss',
    '../static/css/font-awesome.css',
    filters='scss',
    output='css/bundle.css')
assets.register('css_all', css)

loader = jinja2.FileSystemLoader(
    [ './site/'
    , './partials/'      
    , '../partials/templates/'
    , '../templates'
    ])
app.jinja_loader = loader

dl_links = set()
checksum_links = set()

@app.context_processor
def inject_globalvars():
    r = {}
    with open('release.yaml') as data:
        r = yaml.safe_load(data)
    def download_link(override, link):
        global dl_links
        if override != 'default':
            link = override
        dl_links.add(link)
        return link
    def checksum_link(link):
        global checksum_links
        checksum_links.add(link)
        return url_for('checksums.static', filename=link)
    return dict(
        dl=download_link,
        checksum=checksum_link,
        globalvar=globalvar,
        releaseinfo=r,
        lang_code=g.current_lang if hasattr(g, 'current_lang') else app.config['BABEL_DEFAULT_LOCALE'],
        languages=FEDORA_LANGUAGES,
        endpoint=request.endpoint.replace('_i18n', ''))

@app.before_request
def handle_language_code():
    if request.view_args and 'lang_code' in request.view_args:
        g.current_lang = request.view_args.get('lang_code')
        if g.current_lang not in FEDORA_LANGUAGES:
            return abort(404)
        else:
            request.view_args.pop('lang_code')

@babel.localeselector
def get_locale():
    translations = [str(translation) for translation in babel.list_translations()]
    return g.get('current_lang', app.config['BABEL_DEFAULT_LOCALE'])

# We register these as blueprints so that everything in these folders gets
# frozen. This is slightly hacky, but not too bad.
keys = Blueprint('keys', __name__, static_folder='static/keys', static_url_path='/static/keys')
app.register_blueprint(keys)

checksums = Blueprint('checksums', __name__, static_folder='static/checksums', static_url_path='/static/checksums')
app.register_blueprint(checksums)

# This is a more manual attempt at still having some automation.
freeze_indexes = set()
def export_route(name, path, template=None):
    global freeze_indexes
    freeze_indexes.add(name)
    def r():
        return render_template(template or path.strip('/') + '/index.html')
    r.__name__ = name
    if freezing:
        # This is a bit hacky, but we want to generate index.html.langcode files
        # while tricking url_for into generating links that are prettier than
        # that. So we generate two routes, one for the pretty url, and one for
        # the i18n-specific index.html.langcode URL.
        # We tell the freezer to include the _i18n one, but everything else
        # refers to the pretty one.
        app.route('/<lang_code>' + path, endpoint=name)(r)
        app.route(path + 'index.html.<lang_code>', endpoint=name+'_i18n')(r)
    else:
        app.route('/<lang_code>' + path, endpoint=name)(r)
    return r

if not freezing:
    @app.route('/')
    def index_redirect():
        return redirect('/' + app.config['BABEL_DEFAULT_LOCALE'] + '/', code=302)

export_route('index', '/')

# export_route(identifier
export_route('workstation', '/workstation/')
export_route('workstation_download', '/workstation/download/')
export_route('server', '/server/')
export_route('server_download', '/server/download/')
export_route('coreos', '/coreos/')
export_route('coreos_download', '/coreos/download/')
export_route('silverblue', '/silverblue/')
export_route('silverblue_download', '/silverblue/download/')
export_route('iot', '/iot/')
export_route('iot_download', '/iot/download/')
export_route('security', '/security/')
export_route('sponsors', '/sponsors/')

# This is manually updated for now by calling:
# python scripts/releases-json.py > static/releases.json
@app.route('/releases.json')
def releases_json():
    return send_from_directory('static', 'releases.json')


@app.route('/magazine.json')
def magazine_json():
    return send_from_directory('static', 'magazine.json')

@app.route('/static/fedora.gpg')
def gpgkey():
    return send_from_directory('static', 'fedora.gpg')

@freezer.register_generator
def index():
    for lang in FEDORA_LANGUAGES:
        #yield {'lang_code': lang}
        for name in freeze_indexes:
            yield (name + '_i18n'), {'lang_code': lang}

if __name__ == '__main__':
    # Minification is good for production, but not for debugging.
    app.config['MINIFY_PAGE'] = True
    htmlmin = HTMLMIN(app)

    freezer.freeze()

    print("")
    print("Download links:")
    for link in dl_links:
        print(link)

    print("")
    print("Checksum links:")
    for link in checksum_links:
        print(link)
