/**
 * Nightly backup of the whole Schedule database to Google Drive, with an email when it's done.
 *
 * Runs in Google Apps Script (script.google.com) under the Google account that owns the
 * Firebase project. It reads Firestore directly with that account's access, so it sees every
 * document regardless of the app's security rules, and it never writes to Firestore.
 *
 * Each run saves one JSON file, schedule-backup-YYYY-MM-DD.json, into the Drive folder named
 * below, and deletes backups older than KEEP_DAYS. Setup steps are in tools/BACKUP.md.
 *
 * Who receives it is set in the app (Data -> Automatic backup, Admins only), stored in
 * settings/backup. Those addresses get the email with the file attached, and the Drive folder
 * is shared with them. With nothing set, it goes to the account running this script.
 */

const PROJECT_ID = 'schedule-75592';
const FOLDER_NAME = 'Schedule backups';
const KEEP_DAYS = 60;
// Gmail caps attachments at 25MB; above this the email carries the Drive link only.
const MAX_ATTACH_BYTES = 20 * 1024 * 1024;

const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents';

function backupNow() {
  const me = Session.getEffectiveUser().getEmail();
  let recipients = [me];
  try {
    recipients = backupRecipients_() || [me];
    const data = { exportedAt: new Date().toISOString(), projectId: PROJECT_ID, collections: {} };
    let total = 0;

    for (const col of listRootCollections_()) {
      const docs = listDocuments_(BASE + '/' + encodeURIComponent(col));
      data.collections[col] = docs;
      total += docs.length;
    }
    // Notifications live one level down (notifications/{person}/items/{id}); fetch every
    // "items" collection in one query rather than walking each person.
    const items = collectionGroup_('items');
    data.collections['notifications/*/items'] = items;
    total += items.length;

    const folder = getFolder_();
    const name = 'schedule-backup-' + Utilities.formatDate(new Date(), 'Etc/UTC', 'yyyy-MM-dd') + '.json';
    const json = JSON.stringify(data);
    const file = folder.createFile(name, json, 'application/json');
    removeOldBackups_(folder);
    shareFolder_(folder, recipients.filter(r => r !== me));

    const teams = data.collections['rota_kv'].find(d => d.id === 'teams');
    let teamCount = '?';
    try { teamCount = JSON.parse(teams.fields.value).length; } catch (e) {}

    const attach = json.length <= MAX_ATTACH_BYTES;
    MailApp.sendEmail({
      to: recipients.join(','),
      subject: 'Schedule backup done (' + teamCount + ' teams, ' + total + ' records)',
      body: 'Tonight\'s backup is ' + (attach ? 'attached, and also ' : '') + 'saved in Google Drive:\n' + file.getUrl() +
        '\nAll backups (last ' + KEEP_DAYS + ' days): ' + folder.getUrl() +
        '\n\nTeams in the team list: ' + teamCount +
        '\nRecords saved: ' + total +
        '\n\nIf the number of teams looks wrong, the backup from an earlier night is in the same folder.' +
        '\nThis contains personal data (names, emails, birthdays) - do not forward it.',
      attachments: attach ? [Utilities.newBlob(json, 'application/json', name)] : [],
    });
  } catch (e) {
    MailApp.sendEmail(recipients.join(','), 'Schedule backup FAILED', 'The nightly backup did not complete:\n\n' + (e && e.stack || e));
    throw e;
  }
}

/** Run once by hand: schedules backupNow() every night between 2 and 3am. */
function setUpNightlyBackup() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'backupNow')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('backupNow').timeBased().everyDays(1).atHour(2).create();
  backupNow(); // and take the first one straight away, so you can see it works
}

// ---------------------------------------------------------------------------------------------

function call_(method, url, body) {
  const res = UrlFetchApp.fetch(url, {
    method: method,
    contentType: 'application/json',
    payload: body ? JSON.stringify(body) : undefined,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('Firestore returned ' + res.getResponseCode() + ' for ' + url + ': ' + res.getContentText().slice(0, 500));
  }
  return JSON.parse(res.getContentText());
}

function listRootCollections_() {
  const ids = [];
  let token = '';
  do {
    const r = call_('post', BASE + ':listCollectionIds', { pageSize: 100, pageToken: token || undefined });
    (r.collectionIds || []).forEach(id => ids.push(id));
    token = r.nextPageToken || '';
  } while (token);
  return ids;
}

function listDocuments_(collectionUrl) {
  const out = [];
  let token = '';
  do {
    const r = call_('get', collectionUrl + '?pageSize=300' + (token ? '&pageToken=' + encodeURIComponent(token) : ''));
    (r.documents || []).forEach(d => out.push(simplify_(d)));
    token = r.nextPageToken || '';
  } while (token);
  return out;
}

function collectionGroup_(collectionId) {
  const r = call_('post', BASE + ':runQuery', {
    structuredQuery: { from: [{ collectionId: collectionId, allDescendants: true }] },
  });
  return r.filter(x => x.document).map(x => simplify_(x.document));
}

/** Firestore's REST format wraps every value in its type; unwrap to plain JSON. */
function simplify_(doc) {
  const path = doc.name.split('/documents/')[1];
  return { id: path.split('/').pop(), path: path, fields: unwrapFields_(doc.fields || {}) };
}
function unwrapFields_(fields) {
  const o = {};
  Object.keys(fields).forEach(k => { o[k] = unwrap_(fields[k]); });
  return o;
}
function unwrap_(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('referenceValue' in v) return v.referenceValue;
  if ('geoPointValue' in v) return v.geoPointValue;
  if ('bytesValue' in v) return v.bytesValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(unwrap_);
  if ('mapValue' in v) return unwrapFields_(v.mapValue.fields || {});
  return v;
}

/** Addresses set in the app under Data -> Automatic backup, or null when none are set. */
function backupRecipients_() {
  const res = UrlFetchApp.fetch(BASE + '/settings/backup', {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() === 404) return null;
  if (res.getResponseCode() !== 200) throw new Error('Could not read backup settings: ' + res.getContentText().slice(0, 300));
  const emails = (simplify_(JSON.parse(res.getContentText())).fields.emails || [])
    .filter(e => typeof e === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  return emails.length ? emails : null;
}

/** Give each recipient view access to the backups folder (only once; Drive ignores repeats). */
function shareFolder_(folder, emails) {
  const already = folder.getViewers().concat(folder.getEditors()).map(u => u.getEmail().toLowerCase());
  emails.filter(e => already.indexOf(e.toLowerCase()) === -1).forEach(e => {
    try { folder.addViewer(e); } catch (err) { console.warn('Could not share the folder with ' + e + ': ' + err); }
  });
}

function getFolder_() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

function removeOldBackups_(folder) {
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    if (/^schedule-backup-.*\.json$/.test(f.getName()) && f.getDateCreated().getTime() < cutoff) f.setTrashed(true);
  }
}
