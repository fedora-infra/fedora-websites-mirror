# -*- coding: utf-8 -*-

from flask import Blueprint, Flask, abort, g, render_template, redirect, request, send_from_directory, url_for
from flask_babel import Babel
from flask_assets import Environment, Bundle
from flask_frozen import Freezer
from flask_htmlmin import HTMLMIN
import jinja2
import os.path
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
        return url_for('checksums', filename=link)
    return dict(
        dl=download_link,
        checksum=checksum_link,
        globalvar=globalvar,
        releaseinfo=r,
        lang_code=g.current_lang if g.current_lang else app.config['BABEL_DEFAULT_LOCALE'],
        languages=FEDORA_LANGUAGES,
        endpoint=request.endpoint)

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

# This is a more manual attempt at still having some automation.
def export_route(name, path, template=None):
    def r():
        return render_template(template or path.strip('/').replace('<lang_code>', '') + '/index.html')
    r.__name__ = name
    app.route(path)(r)
    return r

# This will freeze, sadly, but we probably shouldn't use it in production.
# We want Apache or whatever in production to just always redirect to
# /<lang_code>/ for us. But for now it makes it easier to test things using the
# flask reload server.
@app.route('/')
def index_redirect():
    return redirect('/' + app.config['BABEL_DEFAULT_LOCALE'] + '/', code=302)

export_route('index', '/index.html.<lang_code>', 'index.html')
export_route('index_lang', '/<lang_code>/')

export_route('workstation', '/<lang_code>/workstation/')
export_route('workstation_download', '/<lang_code>/workstation/download/')
export_route('server', '/<lang_code>/server/')
export_route('server_download', '/<lang_code>/server/download/')
export_route('coreos', '/<lang_code>/coreos/')
export_route('coreos_download', '/<lang_code>/coreos/download/')
export_route('silverblue', '/<lang_code>/silverblue/')
export_route('silverblue_download', '/<lang_code>/silverblue/download/')
export_route('iot', '/<lang_code>/iot/')
export_route('iot_download', '/<lang_code>/iot/download/')
export_route('security', '/<lang_code>/security/')

@app.route('/static/checksums/<path:filename>')
def checksums(filename):
    return send_from_directory('static/checksums', filename)    

@freezer.register_generator
def index():
    for lang in FEDORA_LANGUAGES:
        yield {'lang_code': lang}

blueprint = Blueprint(
    'site',
    __name__,
    static_folder='./static',
    static_url_path='/static/')
app.register_blueprint(blueprint)

if __name__ == '__main__':
    # Minification is good for production, but not for debugging.
    app.config['MINIFY_PAGE'] = True
    htmlmin = HTMLMIN(app)

    freezer.freeze()

    print("")
    print("Download links:")
    for link in dl_links:
        print link

    print("")
    print("Checksum links:")
    for link in checksum_links:
        print link
