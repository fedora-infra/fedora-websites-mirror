
# -*- coding: UTF-8 -*-

from flask import Flask, abort, g, render_template, redirect, request
from flask_babel import Babel
from flask_assets import Environment, Bundle
from flask_frozen import Freezer
from flask_htmlmin import HTMLMIN
import jinja2
import os.path
import yaml

# TODO: Is there a nicer way to represent the data globalvar has?
import globalvar

FEDORA_LANGUAGES = { 'en' : 'English' , 'de': 'Deutsch'}

# List of langs from old getfedora.org
#FEDORA_LANGUAGES = { 'en' : 'English' , 'af': 'Afrikaans', 'ar': 'عربي', 'as': 'অসমীয়া', 'ast': 'Asturianu', 'bal': 'بلوچی', 'bg': 'български език', 'bn': 'বাংলা', 'bn_IN': 'বাংলা (ভারত)', 'br': 'Brezhoneg', 'ca': 'Català', 'cs': 'česky', 'da': 'dansk', 'de': 'Deutsch', 'el': 'Ελληνικά', 'en': 'English', 'en_GB': 'English (UK)', 'es': 'Español', 'eu': 'euskera', 'fa': 'پارسی', 'fi': 'suomi', 'fr': 'Français', 'fur': 'Friulian', 'gl': 'galego', 'gu': 'ગુજરાતી', 'he': 'עברית', 'hi': 'हिन्दी', 'hu': 'Magyar', 'ia': 'Interlingua', 'id': 'Indonesia', 'is': 'Íslenska', 'it': 'Italiano', 'ja': '日本語', 'ka': 'ქართული', 'kn': 'ಕನ್ನಡ', 'ko': '한국어', 'lv': 'latviešu', 'ml': 'മലയാളം', 'mr': 'मराठी', 'nb': 'Norsk bokmål', 'nl': 'Nederlands', 'or': 'ଓଡ଼ିଆ', 'pa': 'ਪੰਜਾਬੀ', 'pl': 'polski', 'pt': 'Português', 'pt_BR': 'Português brasileiro', 'ro': 'română', 'ru': 'Pусский', 'sk': 'slovenčina', 'sq': 'Shqip', 'sr': 'српски', 'sv': 'svenska', 'ta': 'தமிழ்', 'te': 'తెలుగు', 'tg': 'тоҷикӣ', 'th': 'ไทย', 'tr': 'Tϋrkçe', 'uk': 'українська', 'vi': 'Tiếng Việt', 'zh_CN': '简体中文', 'zh_TW': '正體中文'}

app = Flask(__name__, static_folder='../static/', static_url_path='/static')
app.config['TEMPLATES_AUTO_RELOAD'] = True

app.config['BABEL_DEFAULT_LOCALE'] = 'en'
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

@app.context_processor
def inject_globalvars():
    r = {}
    with open('release.yaml') as data:
        r = yaml.safe_load(data)
    return dict(
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

# TODO: This was an attempt at some template-url automation.
# The idea is to get around having to write a function for every page.
# However it feels a bit weird, and we'd have to write a URL generator for
# frozen-flask. So it might just be better to do the URLs manually.
#@app.route('/', defaults={'page': ''})
#@app.route('/<path:page>/')
#def index(page):
#    if os.path.isfile('./site/' + page + '/index.html'):
#        return render_template(page + '/index.html')
#    abort(404)

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

export_route('index', '/<lang_code>/')

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

@freezer.register_generator
def index():
    for lang in FEDORA_LANGUAGES:
        yield {'lang_code': lang}

if __name__ == '__main__':
    # Minification is good for production, but not for debugging.
    app.config['MINIFY_PAGE'] = True
    htmlmin = HTMLMIN(app)

    freezer.freeze()
