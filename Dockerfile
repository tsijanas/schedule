# Rota — static site container
#
# This app has no build step (no npm install, no bundler) — it's plain HTML/CSS/JS files
# that talk to Firebase directly from the browser. This Dockerfile just packages those files
# behind a small, production-grade web server (nginx) so any server that can run a container
# can host it.
FROM nginx:1.27-alpine

# Remove nginx's default sample page
RUN rm -rf /usr/share/nginx/html/*

# Copy the app's static files in
COPY index.html /usr/share/nginx/html/index.html
COPY login.html /usr/share/nginx/html/login.html

# The web app manifest and the icons. Without these the install prompt has no icon to use and
# the browser falls back to drawing the first letter of the name on a plain square — which is
# what "add to home screen" produced for as long as only the two HTML files were copied in.
# Which build this image is. The deploy pipeline has failed in ways that left an older image
# serving while the repo looked up to date, and the only way to tell was to read a response
# header in DevTools. Opening /version.txt answers it in one look. It is a hand-maintained
# label rather than a commit hash, because a file cannot contain the hash of the commit that
# adds it — bump it whenever a change needs to be seen as deployed.
COPY version.txt /usr/share/nginx/html/version.txt
COPY manifest.json /usr/share/nginx/html/manifest.json
COPY favicon.ico favicon.svg favicon-16x16.png favicon-32x32.png favicon-48.png \
     apple-touch-icon.png \
     icon-192.png icon-512.png icon-maskable-192.png icon-maskable-512.png \
     /usr/share/nginx/html/

# Custom nginx config: sensible caching + basic security headers
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

# nginx's official image already runs the server as its entrypoint — nothing else to do.
