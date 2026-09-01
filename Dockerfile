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

# Custom nginx config: sensible caching + basic security headers
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

# nginx's official image already runs the server as its entrypoint — nothing else to do.
