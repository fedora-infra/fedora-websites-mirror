from flask import Flask, abort, render_template
from flask_babel import Babel
from flask_assets import Environment, Bundle
from flask_frozen import Freezer
from flask_htmlmin import HTMLMIN
import jinja2
import os.path

# TODO: Is there a nicer way to represent the data globalvar has?
import globalvar

app = Flask(__name__, static_folder='../static/', static_url_path='/static')
app.config['TEMPLATES_AUTO_RELOAD'] = True

babel = Babel(app)

assets = Environment(app)
assets.url_expire = True

freezer = Freezer(app)
app.config['FREEZER_STATIC_IGNORE'] += ['/css', '/js', '/vendor']

js = Bundle(
    '../static/js/bootstrap.min.js',
    '../static/js/bootstrap-rtl.js',
    '../static/js/jquery.min.js',
    filters='rjsmin',
    output='js/bundle.js')
assets.register('js_all', js)

css = Bundle(
    '../static/scss/fedora.scss',
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
    return dict(globalvar=globalvar)

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
        return render_template(template or path.strip('/') + '/index.html')
    r.__name__ = name
    app.route(path)(r)
    return r

export_route('index', '/')
export_route('workstation', '/workstation/')

if __name__ == '__main__':
    # Minification is good for production, but not for debugging.
    app.config['MINIFY_PAGE'] = True
    htmlmin = HTMLMIN(app)

    freezer.freeze()
