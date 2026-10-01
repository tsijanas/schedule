# Nightly backup to Google Drive

`backup-to-drive.gs` copies the whole Firestore database into a JSON file in a Google Drive
folder every night, and emails a link (or a FAILED notice). It only reads; it never changes
the database. Backups older than 60 days are deleted.

Do this once, signed in to the Google account that owns the Firebase project:

1. Go to https://script.google.com and click **New project**. Name it "Schedule backup".
2. Delete what's in the editor, paste the whole of `backup-to-drive.gs`, and press Cmd/Ctrl+S.
3. Click the gear (**Project Settings**) and tick **Show "appsscript.json" manifest file in editor**.
4. Back in the editor (**<>**), open `appsscript.json`, replace everything with the block below, save.
5. In the function dropdown at the top pick **setUpNightlyBackup** and click **Run**.
   Google asks for permission: **Review permissions** → choose the account → **Advanced** →
   **Go to Schedule backup (unsafe)** → **Allow**. ("Unsafe" only means the script is yours,
   not published by Google.)
6. Within a minute you get a "Schedule backup done" email, and a **Schedule backups** folder
   appears in Drive. From then on it runs every night around 2–3am.

```json
{
  "timeZone": "Europe/Vilnius",
  "runtimeVersion": "V8",
  "exceptionLogging": "STACKDRIVER",
  "oauthScopes": [
    "https://www.googleapis.com/auth/datastore",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/script.scriptapp",
    "https://www.googleapis.com/auth/script.send_mail",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/userinfo.email"
  ]
}
```

The backup contains names, emails and birthdays — keep the Drive folder private.

Restoring: this file is a full copy, not the app's Data → Export format, so don't paste it
into Data → Import. To bring back one thing (like the team list), open the backup, find the
document (e.g. `rota_kv` → `teams`), and copy its `value` into the same place in the
Firebase console.
