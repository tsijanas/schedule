# Changelog

What shipped, newest first. Each round ends with the commit it finished on, so the next round
starts from there: `git log <that commit>..HEAD --oneline` lists everything added since.

## Next round — starts after `0fb2952` (22 Sep 2026)

- **A mark that says "schedule"** — the icon is now a week with one day marked in gold, drawn
  in the brand slide template's expressive icon style: one stroke weight, round caps, a wide
  corner radius and a single solid dot as the only filled detail. Same deep teal and mint the
  template's icon page uses (`#004654`, `#EDFFE9`), which the app was already built on. Below
  48px the calendar's two hangers come off and the strokes thicken, because at 16px they close
  into a smudge — the template's own advice for small sizes. New `icon-mac-1024.png` is a
  rounded tile inset in transparency, so an installed app sits in the macOS Dock at the shape
  and size everything else there is, rather than as a full-bleed square. `tools/make-icons.mjs`
  now also packs `favicon.ico` itself, so all eleven files come from the one description of the
  mark, and `tools/icon-proof.png` shows every size, a tab strip and a Dock at true scale.

- **App icon** — installing the tool now shows the app's own mark (the sidebar's wave and dot,
  on teal) instead of a letter on a grey square. The icons and `manifest.json` existed in the
  repo but were never copied into the container, so the deployed site served none of them; the
  sign-in page had no manifest link at all. Both fixed, with sizes for browser tabs, iOS and
  Android, including maskable ones so a launcher's crop doesn't cut the mark.

---

## Round 2 — Coverage, dated requirements, layout, history

Ends at `0fb2952`. Starts after `02e1cc7`.

- **Coverage tracking** — a week at a glance: how many people are on each task each day against
  what the requirement asks for, with a weekly average and an all-task total. In Grand Insights
  for departments that combine their teams, Team Insights for those that don't.
- **Dated requirements** — change a requirement once and it applies from that week onwards.
  Past weeks keep the numbers they actually ran with, and can't be rewritten.
- **Availability per task** — each task says how many people can work it that week, and warns
  when the requirement asks for more than the thinnest day can cover. Open the level breakdown
  and it splits by level (IC1 / IC2 / IC3). Shown at both team and department level.
- **Rearrange the schedule** — drag task rows into the order you want, or use the arrows. That
  order then applies everywhere tasks are listed: Requirement, People, Coverage, Rotation
  Balance, Tasks and everyone's own view. A department that combines its teams can set the
  order for all of them at once.
- **Schedule history** — a per-department record of who changed what: "Akvilė took Rugilė off
  Chargeback — Wed 24", whole-week generates, fills, clears, out-of-office covers and undos.
  Newest first, filterable, paged. Managers and admins only.
- **Fixes** — the availability chip is shorter ("8 available") and no longer wraps; the level
  breakdown's numbers are no longer clipped in their boxes; notification dates show the weekday
  again ("Wed, Sep 24").

## Round 1 — Accounts, names, colours, merged cells

Ends at `02e1cc7`.

- **Signing in** — people confirm their account with their email alone; names with Lithuanian
  characters no longer fail, and nobody is asked for their name twice.
- **Names everywhere** — anyone still without a name shows the name from their email address
  instead of "(name pending)", including for viewers.
- **Colours** — per-team colours where a department combines its teams, per-person colours
  where it doesn't. More colours, on one line, and changing one repaints the schedules already
  on screen.
- **Merged cells and split days** — a person working a task all week reads as one bar, and a
  menu takes them off a single day mid-week without breaking the rest.
- **Security fix** — a person's own name is escaped everywhere it's drawn, so markup in a name
  can no longer inject anything into a schedule.

## Deploying

`index.html` is the whole app — replace it and hard-refresh. `firestore.rules` is deployed
separately with `firebase deploy --only firestore:rules`, and only when it has actually
changed.
