# Schedule

A team task-rotation tool that plans itself and keeps everyone in the loop automatically. Tell
it who's on the team, what needs covering, and who's qualified for what — it builds a fair
week, spreading tasks so no one gets stuck with the same thing every time. When someone's out,
it finds and reassigns coverage on its own, and tells whoever picked it up immediately. New
hires get a working account the moment they register — no manual approval step waiting on
anyone. Built as an internal tool for one org, not a commercial product.

## What it actually does

**Scheduling**
- Weekly task assignment across one or more teams, generated automatically from eligibility,
  per-task requirements, and how recently each person has done each task (fairness balancing)
- Three ways to (re)build a week: **Generate** (rebuild from scratch), **Fill in** (only add
  where something's still short, leave everything else untouched), **Update** (re-validate
  every existing assignment against current rules — drop anyone no longer eligible or now on
  holiday, then fill whatever's left short)
- Per-task requirements can be a simple daily headcount, or broken down by level (e.g. "at
  least 1 IC1 and 1 IC2") — the generator fills each level's minimum specifically, not just a
  total
- Tasks can require the same person to cover every day they're needed that week, instead of
  being picked fresh each day
- Manual editing: click anyone's name directly to swap them for one assignment, or search for
  someone and replace them across everything they're on that week in one pass
- Team-colored schedule bars, birthdays shown next to the date, bank holiday awareness

**Multiple teams and departments**
- Teams can be grouped into departments; a "Grand" version of Schedule, Requirement, Balance,
  and Registry combines every team in a department into one view
- Department-wide requirements (including per-level breakdowns) can be set once and split
  proportionally across teams, weighted by how many people (or how many people *at that level*)
  each team actually has
- Tasks can be linked across teams — editing name, levels, or visibility on one propagates to
  every team sharing it, with an explicit unlink option if a team needs to diverge
- Search-and-replace, notifications, and schedule generation all work the same way whether
  triggered from a single team's own tab or the department-wide Grand view

**Access and registration**
- Invite-only: an admin creates a spot for someone (team, level, role) before they ever sign
  up; the invite link can be personal (email pre-filled and locked) or shared across a group
- Registering with the invited email links automatically — no approval queue, no waiting
  screen. An email that was never invited gets told plainly, not queued for review
- Three roles: **Admin** (full access everywhere), **Manager** (full access within their own
  department), **Viewer** (their own team's schedule, read-only, plus self-service holidays)

**Notifications**
- Batched: manager-made schedule changes get diffed and summarized, sent in one message per
  person when the manager clicks Send — not on every single edit
- Instant: marking someone out-of-office automatically finds and reassigns their coverage, and
  notifies whoever just picked it up right away
- A Dock/taskbar badge (Chrome/Edge, while the tab is open) reflects unread count without
  needing to check the app

**Setup and data**
- Roster import: paste a spreadsheet (name, level, team, email, per-task eligibility columns)
  to set up teams, tasks, people, and eligibility all at once
- Holiday tracking, self-service for viewers, with automatic coverage reassignment
- A lightweight test suite (`tests.js`) covers the generator and parsers directly against the
  real extracted logic — see "Testing" below

## How it's built

There's no build step — `index.html` and `login.html` are plain HTML/CSS/JavaScript, no
npm/webpack/React. The browser loads them directly and talks to **Firebase** (Google's hosted
backend) for two things:

- **Firebase Authentication** — handles sign-up/sign-in (email + password)
- **Firestore** — the database (people, teams, schedules, holidays, notifications, etc.)

Everything about *who's allowed to do what* is enforced by `firestore.rules` — that file is the
real security boundary for this app, not the JavaScript. See `DEPLOYMENT.md` for what that
means in practice and what needs to be configured in the Firebase project.

`index.html` cannot be opened directly from disk (`file://`) — it uses ES modules, which
browsers block from loading over the file protocol for security reasons. It needs to be served
over `http(s)://`, even just `localhost`, which is what the Docker setup below is for.

## Files

| File | What it is |
|---|---|
| `index.html` | The app itself — schedule, teams, tasks, holidays, notifications, everything after login |
| `login.html` | Sign-in / registration page |
| `firestore.rules` | Database security rules — deployed to Firebase separately from the site itself |
| `firebase.json`, `.firebaserc` | Config so the Firebase CLI knows which project to deploy rules to |
| `Dockerfile`, `nginx.conf` | Packages the static files behind a small web server, for self-hosting |
| `docker-compose.yml` | Local one-command way to run the container and check it works |
| `tests.js` | Standalone test suite for the generator and parsers — see Testing below |
| `manifest.json`, `icon-*.png`, `favicon*` | PWA manifest and icons, for installing as an app |

## Running it locally

```
docker compose up --build
```

Then open `http://localhost:8080`. This serves the exact same files that would run in
production — there's no separate "dev mode."

## Deploying

See `DEPLOYMENT.md` — there are two parts to deploying this: hosting the files (what the
Docker setup here is for) and configuring the Firebase project (separate, one-time regardless
of where the files end up hosted). **`firestore.rules` deploys separately, via the Firebase
Console or CLI — publishing the site files alone does not update it.** Several real bugs in
this project's history came specifically from that step being missed.

## Testing

```
node tests.js
```

Runs a set of assertions against the actual scheduling and parsing logic, extracted directly
from `index.html` (not reimplemented separately) — so a passing run reflects the real code, not
a description of what it's supposed to do. Covers: the generator in all three modes (Generate,
Fill in, Update), per-level requirement breakdowns, bank holiday handling, the invite and roster
paste parsers, and the name-collision logic used to shorten display names. Safe to rerun any
time after future changes to catch a regression before it reaches anyone.

This is not a substitute for testing against a real, live Firebase project — it covers the
pure logic only, not authentication, permissions, or anything that touches the database.

## Known limitations

Worth knowing about rather than discovering:

- **Notifications are poll-based, not push** — someone already looking at the app won't see
  something new arrive until they reload or switch tabs
- **The Dock badge only works in Chrome/Edge**, and only while the tab is open somewhere
- **Task links propagate name, levels, same-week setting, and visibility** — notes and
  "cannot combine with" deliberately stay local to each team
- **Manager access is UI-scoped, not enforced at the Firestore rules level** — a Manager's
  department boundary is respected by the app's own logic, not by the database security rules
  themselves. Worth hardening if this ever needs to resist a malicious or compromised client,
  not just guide a well-behaved one
