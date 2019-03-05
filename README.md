# websites

`dnf install python-flask python-frozen-flask python-flask-assets python-rjsmin python-cssmin python-flask-babel`

The sites can be run in two ways:

* Dynamically with `export FLASK_APP=main.py; flask run --reload --debugger`
* Statically with `python main.py` and loading the 'build' directory.

To test the static generation and make sure it does what you expect, build it as per above, and then from the new `build` directory, run `python -mSimpleHTTPServer` and go to localhost:8000 in a browser.
