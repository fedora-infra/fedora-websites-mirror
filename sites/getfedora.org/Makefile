devdeploy:
	rm -rf build
	python main.py
	rsync -Havzre ssh --delete build/* relrod@hosted.elrod.me:/srv/www/fedora.elrod.dev/webroot/
