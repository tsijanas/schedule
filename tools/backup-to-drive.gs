/**
 * Nightly backup of the whole Schedule database to Google Drive, with an email when it's done.
 *
 * Runs in Google Apps Script (script.google.com) under the Google account that owns the
 * Firebase project. It reads Firestore directly with that account's access, so it sees every
 * document regardless of the app's security rules, and it never writes to Firestore.
 *
 * Each run saves one JSON file, schedule-backup-YYYY-MM-DD.json, into the Drive folder named
 * below, and deletes backups older than KEEP_DAYS. Setup steps are in tools/BACKUP.md.
 */

const PROJECT_ID = 'schedule-75592';
const FOLDER_NAME = 'Schedule backups';
const KEEP_DAYS = 60;
// Who gets the "backup done" / "backup FAILED" email. Empty means the account running the script.
const NOTIFY_EMAIL = '';

const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents';

function backupNow() {
  const to = NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
  try {
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
    const file = folder.createFile(name, JSON.stringify(data), 'application/json');
    removeOldBackups_(folder);

    const teams = data.collections['rota_kv'].find(d => d.id === 'teams');
    let teamCount = '?';
    try { teamCount = JSON.parse(teams.fields.value).length; } catch (e) {}

    MailApp.sendEmail(to, 'Schedule backup done (' + teamCount + ' teams, ' + total + ' records)',
      'Tonight\'s backup is saved in Google Drive:\n' + file.getUrl() +
      '\n\nTeams in the team list: ' + teamCount +
      '\nRecords saved: ' + total +
      '\n\nIf the number of teams looks wrong, the backup from an earlier night is in the same folder.');
  } catch (e) {
    MailApp.sendEmail(to, 'Schedule backup FAILED', 'The nightly backup did not complete:\n\n' + (e && e.stack || e));
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
