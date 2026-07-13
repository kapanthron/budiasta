/**
 * Budiasta server — Google Apps Script web app.
 * Free backend: saves every user's work to Drive and logs every activity to a
 * Google Sheet ("Budiasta Data"), owned by whoever deploys this script.
 *
 * SETUP (once, ~3 minutes):
 * 1. Open script.google.com → New project, paste this whole file.
 * 2. Set ADMIN_ID and ADMIN_PASS below to your real credentials.
 * 3. Deploy → New deployment → Web app:
 *      Execute as: Me · Who has access: Anyone
 * 4. Copy the /exec URL into data/config.json ("serverUrl") in the repo,
 *    or paste it in the app's Masuk dialog.
 */

var ADMIN_ID = 'admin1810';
var ADMIN_PASS = 'GANTI_SANDI_INI';   // <-- ganti dengan sandi asli sebelum deploy

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) {}
  var out;
  try { out = handle(body); }
  catch (err) { out = { ok: false, error: String(err) }; }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, service: 'budiasta' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handle(b) {
  switch (b.action) {
    case 'ping':          return { ok: true };
    case 'save':          return saveProject(b);
    case 'load':          return loadProject(b);
    case 'log':           return logActivity(b);
    case 'adminLogin':    return { ok: isAdmin(b) };
    case 'adminActivity': return isAdmin(b) ? adminActivity(b) : { ok: false, error: 'auth' };
    case 'adminUsers':    return isAdmin(b) ? adminUsers() : { ok: false, error: 'auth' };
    default:              return { ok: false, error: 'unknown action' };
  }
}

function isAdmin(b) { return b.id === ADMIN_ID && b.pass === ADMIN_PASS; }

function userKey(b) {
  var u = b.user || {};
  return String(u.sub || u.email || 'anon').slice(0, 80);
}

// --- storage ---
function ss() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SS_ID');
  if (!id) {
    var s = SpreadsheetApp.create('Budiasta Data');
    id = s.getId();
    props.setProperty('SS_ID', id);
  }
  return SpreadsheetApp.openById(id);
}

function sheet(name, headers) {
  var book = ss();
  var sh = book.getSheetByName(name);
  if (!sh) {
    sh = book.insertSheet(name);
    sh.appendRow(headers);
  }
  return sh;
}

function folder() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('FOLDER_ID');
  if (!id) {
    var f = DriveApp.createFolder('Budiasta Projects');
    id = f.getId();
    props.setProperty('FOLDER_ID', id);
  }
  return DriveApp.getFolderById(id);
}

// --- actions ---
function saveProject(b) {
  if (!b.project || !b.project.project) return { ok: false, error: 'no project' };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var key = userKey(b);
    var pid = String(b.project.project.id || 'default');
    var sh = sheet('projects', ['userKey', 'email', 'projectId', 'title', 'words', 'updatedAt', 'fileId']);
    var data = sh.getDataRange().getValues();
    var rowIdx = -1, fileId = '';
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === key && data[i][2] === pid) { rowIdx = i + 1; fileId = data[i][6]; break; }
    }
    var json = JSON.stringify(b.project);
    if (fileId) {
      DriveApp.getFileById(fileId).setContent(json);
    } else {
      fileId = folder().createFile('budiasta-' + key + '-' + pid + '.json', json, 'application/json').getId();
    }
    var row = [key, (b.user && b.user.email) || '', pid,
               b.project.project.title || '', b.words || 0, new Date().toISOString(), fileId];
    if (rowIdx > 0) sh.getRange(rowIdx, 1, 1, row.length).setValues([row]);
    else sh.appendRow(row);
    return { ok: true, savedAt: row[5] };
  } finally { lock.releaseLock(); }
}

function loadProject(b) {
  var key = userKey(b);
  var sh = sheet('projects', ['userKey', 'email', 'projectId', 'title', 'words', 'updatedAt', 'fileId']);
  var data = sh.getDataRange().getValues();
  var best = null;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key && (!best || data[i][5] > best[5])) best = data[i];
  }
  if (!best) return { ok: false, error: 'not found' };
  var json = DriveApp.getFileById(best[6]).getBlob().getDataAsString();
  return { ok: true, updatedAt: best[5], project: JSON.parse(json) };
}

function logActivity(b) {
  var sh = sheet('activity', ['time', 'email', 'sub', 'type', 'detail']);
  var u = b.user || {};
  sh.appendRow([new Date().toISOString(), u.email || 'tamu', u.sub || '',
                String(b.type || '').slice(0, 40), String(b.detail || '').slice(0, 200)]);
  return { ok: true };
}

function adminActivity(b) {
  var sh = sheet('activity', ['time', 'email', 'sub', 'type', 'detail']);
  var n = Math.min(b.limit || 200, 500);
  var last = sh.getLastRow();
  if (last < 2) return { ok: true, rows: [] };
  var start = Math.max(2, last - n + 1);
  var rows = sh.getRange(start, 1, last - start + 1, 5).getValues().reverse();
  return { ok: true, rows: rows };
}

function adminUsers() {
  var sh = sheet('projects', ['userKey', 'email', 'projectId', 'title', 'words', 'updatedAt', 'fileId']);
  var last = sh.getLastRow();
  if (last < 2) return { ok: true, rows: [] };
  var rows = sh.getRange(2, 1, last - 1, 6).getValues();  // omit fileId
  return { ok: true, rows: rows };
}
