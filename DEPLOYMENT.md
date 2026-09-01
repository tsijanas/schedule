# Deploying Rota

There are two separate things to set up, and they're independent of each other:

1. **Hosting the website files** — this is what moves to your own servers. Covered below.
2. **The Firebase project** — this stays, regardless of where the files are hosted, unless a
   decision is made to replace it entirely (a much bigger separate project — see the note on
   that in the accompanying conversation/summary, not here).

## Part 1 — Hosting the files on your own servers

The app is packaged as a Docker container (see `Dockerfile`). Any server that can run Docker
containers can host this.

```
docker build -t rota .
docker run -p 80:80 rota
```

That's the whole thing — it's a static website behind nginx, nothing else running, no database
on this server, no server-side code to maintain. In production you'll want this behind whatever
your infrastructure normally uses for TLS/HTTPS and your actual domain name (a reverse proxy,
load balancer, or however your team normally terminates HTTPS) — that part follows your
existing standards, nothing specific to this app.

**One important follow-up step once you know the real domain:** see "Restrict the API key"
below — this needs updating to whatever domain the site ends up on.

## Part 2 — The Firebase project

This is a one-time setup (already done for the current `schedule-75592` project, listed here so
whoever owns it going forward knows what's configured and why).

### Authentication

Firebase Console → Authentication → Sign-in method → **Email/Password must be enabled.** This
is how people log in — there's no other auth method wired up.

### Firestore database

Firebase Console → Firestore Database → the database itself needs to exist (created once).
After that, all the actual access rules live in `firestore.rules` in this repo, deployed with:

```
firebase deploy --only firestore:rules
```

(Requires the Firebase CLI: `npm install -g firebase-tools`, then `firebase login` once.)

**This step matters a lot** — the rules file is what actually decides who can read or write
what. If it's ever out of date compared to what's in this repo, re-run the command above.

### Restrict the API key

Google Cloud Console → APIs & Services → Credentials → find the Firebase API key → **Application
restrictions → HTTP referrers** → add the real domain(s) this ends up hosted on. This stops
someone from copying the API key out of the page source and using it to talk to your Firestore
project from a different, unrelated website. It does **not** need to include `localhost` unless
your team plans to develop against the live database locally (usually not recommended).

### Why the API key can be public in the first place

If your security team asks about this: the Firebase config object (API key, project ID, etc.)
visible in `index.html` is meant to be public — Google's own documentation is explicit about
this. It identifies *which* Firebase project a request is for, the same way a URL identifies
which website you're visiting. It is not a secret and does not grant access to anything by
itself. The actual access control is `firestore.rules` plus the domain restriction above — those
are the real gates, not keeping the config hidden.

## What does NOT move if you self-host the files

- The database (Firestore) — still Google-hosted, unless a separate decision is made to
  replace it (see the note in Part 2 of the main explanation — that's a different, larger
  project, not a hosting change).
- Login (Firebase Authentication) — same as above.

Self-hosting the files changes *where the HTML/CSS/JS come from*. It does not change *where the
data lives* or *how people log in* — those stay on Firebase unless that's explicitly the next
project.
