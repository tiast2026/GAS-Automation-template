const SECRET_TOKEN_KEY = 'SECRET_TOKEN';
const BOUND_MAP_KEY = 'BOUND_SCRIPTS';
const JOB_KEY_PREFIX = 'job_';
const APPS_SCRIPT_API = 'https://script.googleapis.com/v1';

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json_({ ok: false, error: 'empty request body' });
    }
    const payload = JSON.parse(e.postData.contents);
    const expected = PropertiesService.getScriptProperties().getProperty(SECRET_TOKEN_KEY);
    if (!expected) {
      return json_({ ok: false, error: 'SECRET_TOKEN not configured on server' });
    }
    if (payload.token !== expected) {
      return json_({ ok: false, error: 'unauthorized' });
    }
    const handler = HANDLERS[payload.action];
    if (!handler) {
      return json_({ ok: false, error: 'unknown action: ' + payload.action });
    }
    const result = handler(payload);
    return json_({ ok: true, result: result === undefined ? null : result });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err), stack: err && err.stack });
  }
}

function doGet() {
  return json_({ ok: true, message: 'GAS Dispatcher alive. POST with {action, token, ...}.' });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function openSheet_(sheetId) {
  if (!sheetId) throw new Error('sheetId is required');
  return SpreadsheetApp.openById(sheetId);
}

function requireTab_(ss, tabName) {
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) throw new Error('tab not found: ' + tabName);
  return sheet;
}

const HANDLERS = {
  ping: ping_,
  listTabs: listTabs_,
  readTab: readTab_,
  readCell: readCell_,
  describeTab: describeTab_,
  writeRange: writeRange_,
  appendRows: appendRows_,
  createTab: createTab_,
  clearTab: clearTab_,
  renameTab: renameTab_,
  runScript: runScript_,
  getBoundScript: getBoundScript_,
  writeBoundScript: writeBoundScript_,
  registerBoundScript: registerBoundScript_,
  bulkRegisterBoundScripts: bulkRegisterBoundScripts_,
  listBoundScripts: listBoundScripts_,
  unregisterBoundScript: unregisterBoundScript_,
  installTimeTrigger: installTimeTrigger_,
  installSheetTrigger: installSheetTrigger_,
  listTriggers: listTriggers_,
  deleteTrigger: deleteTrigger_,
};

function ping_() {
  return {
    pong: new Date().toISOString(),
    email: Session.getActiveUser().getEmail(),
    timeZone: Session.getScriptTimeZone(),
  };
}

function listTabs_({ sheetId }) {
  return openSheet_(sheetId).getSheets().map(function (s) {
    return { name: s.getName(), rows: s.getLastRow(), cols: s.getLastColumn() };
  });
}

function readTab_({ sheetId, tab, range }) {
  const ss = openSheet_(sheetId);
  const sheet = tab ? requireTab_(ss, tab) : ss.getSheets()[0];
  const r = range ? sheet.getRange(range) : sheet.getDataRange();
  return r.getValues();
}

function readCell_({ sheetId, tab, a1 }) {
  const ss = openSheet_(sheetId);
  const sheet = tab ? requireTab_(ss, tab) : ss.getSheets()[0];
  return sheet.getRange(a1).getValue();
}

function describeTab_({ sheetId, tab }) {
  const sheet = requireTab_(openSheet_(sheetId), tab);
  const rows = sheet.getLastRow();
  const cols = sheet.getLastColumn();
  const headers = rows >= 1 && cols >= 1
    ? sheet.getRange(1, 1, 1, cols).getValues()[0]
    : [];
  return { name: tab, rows: rows, cols: cols, headers: headers };
}

function writeRange_({ sheetId, tab, a1, values }) {
  const ss = openSheet_(sheetId);
  const sheet = ss.getSheetByName(tab) || ss.insertSheet(tab);
  if (!Array.isArray(values) || !values.length) throw new Error('values must be non-empty 2D array');
  const rows = values.length;
  const cols = values[0].length;
  sheet.getRange(a1).offset(0, 0, rows, cols).setValues(values);
  return { rows: rows, cols: cols };
}

function appendRows_({ sheetId, tab, values }) {
  const ss = openSheet_(sheetId);
  const sheet = ss.getSheetByName(tab) || ss.insertSheet(tab);
  values.forEach(function (row) { sheet.appendRow(row); });
  return { appended: values.length };
}

function createTab_({ sheetId, name, index }) {
  const ss = openSheet_(sheetId);
  if (ss.getSheetByName(name)) throw new Error('tab already exists: ' + name);
  const sheet = index != null ? ss.insertSheet(name, index) : ss.insertSheet(name);
  return { created: sheet.getName() };
}

function clearTab_({ sheetId, tab }) {
  requireTab_(openSheet_(sheetId), tab).clear();
  return { cleared: tab };
}

function renameTab_({ sheetId, oldName, newName }) {
  requireTab_(openSheet_(sheetId), oldName).setName(newName);
  return { renamed: newName };
}

function runScript_({ sheetId, code }) {
  if (typeof code !== 'string' || !code.length) throw new Error('code must be a non-empty string');
  const ss = sheetId ? openSheet_(sheetId) : null;
  const fn = new Function(
    'ss', 'SpreadsheetApp', 'DriveApp', 'Logger', 'Utilities', 'UrlFetchApp', 'PropertiesService',
    code
  );
  const out = fn(ss, SpreadsheetApp, DriveApp, Logger, Utilities, UrlFetchApp, PropertiesService);
  return out === undefined ? null : out;
}

function getBoundMap_() {
  const raw = PropertiesService.getScriptProperties().getProperty(BOUND_MAP_KEY);
  return raw ? JSON.parse(raw) : {};
}

function saveBoundMap_(map) {
  PropertiesService.getScriptProperties().setProperty(BOUND_MAP_KEY, JSON.stringify(map));
}

function ensureBoundScriptId_(sheetId, autoCreate) {
  const map = getBoundMap_();
  if (map[sheetId]) return map[sheetId];
  if (!autoCreate) {
    throw new Error(
      'no bound script registered for sheet ' + sheetId +
      '. Call registerBoundScript first, or retry with { autoCreate: true } to create a new blank one.'
    );
  }
  const token = ScriptApp.getOAuthToken();
  const res = UrlFetchApp.fetch(APPS_SCRIPT_API + '/projects', {
    method: 'post',
    headers: { Authorization: 'Bearer ' + token },
    contentType: 'application/json',
    payload: JSON.stringify({ title: 'Managed by GAS Dispatcher', parentId: sheetId }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) {
    throw new Error('create bound project failed: ' + res.getContentText());
  }
  const project = JSON.parse(res.getContentText());
  map[sheetId] = project.scriptId;
  saveBoundMap_(map);
  return project.scriptId;
}

function registerBoundScript_({ sheetId, scriptId, scriptUrl, sheetUrl }) {
  if (!sheetId && sheetUrl) sheetId = extractSheetIdFromUrl_(sheetUrl);
  if (!scriptId && scriptUrl) scriptId = extractScriptIdFromUrl_(scriptUrl);
  if (!sheetId || !scriptId) {
    throw new Error('sheetId (or sheetUrl) and scriptId (or scriptUrl) are required');
  }
  const res = UrlFetchApp.fetch(APPS_SCRIPT_API + '/projects/' + scriptId, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) {
    throw new Error('cannot access scriptId ' + scriptId + ': ' + res.getContentText());
  }
  const meta = JSON.parse(res.getContentText());
  if (meta.parentId && meta.parentId !== sheetId) {
    throw new Error(
      'scriptId ' + scriptId + ' is bound to a different parent (' + meta.parentId +
      '), not ' + sheetId + '. Refusing to register.'
    );
  }
  const map = getBoundMap_();
  const previous = map[sheetId] || null;
  map[sheetId] = scriptId;
  saveBoundMap_(map);
  return { sheetId: sheetId, scriptId: scriptId, previous: previous, title: meta.title || null };
}

function extractSheetIdFromUrl_(url) {
  if (!url) return null;
  const m = String(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function extractScriptIdFromUrl_(url) {
  if (!url) return null;
  const str = String(url);
  // projects/<ID>/edit 形式
  let m = str.match(/\/projects\/([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1];
  // /d/<ID>/edit 形式（legacy）
  m = str.match(/\/d\/([a-zA-Z0-9_-]{40,})/);
  if (m) return m[1];
  // /macros/s/<ID>/exec または /edit 形式
  m = str.match(/\/macros\/s\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return null;
}

function listBoundScripts_() {
  return getBoundMap_();
}

function bulkRegisterBoundScripts_({ entries }) {
  if (!entries || typeof entries !== 'object') {
    throw new Error('entries object required: { "<sheetId>": "<scriptId>", ... }');
  }
  const results = { registered: [], skipped: [], failed: [] };
  const map = getBoundMap_();
  Object.keys(entries).forEach(function (sheetId) {
    const scriptId = entries[sheetId];
    if (!sheetId || !scriptId) {
      results.failed.push({ sheetId: sheetId, reason: 'missing id' });
      return;
    }
    if (map[sheetId] === scriptId) {
      results.skipped.push({ sheetId: sheetId, scriptId: scriptId, reason: 'already registered' });
      return;
    }
    try {
      const res = UrlFetchApp.fetch(APPS_SCRIPT_API + '/projects/' + scriptId, {
        method: 'get',
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        muteHttpExceptions: true,
      });
      if (res.getResponseCode() >= 300) {
        results.failed.push({ sheetId: sheetId, scriptId: scriptId, reason: 'cannot fetch metadata' });
        return;
      }
      const meta = JSON.parse(res.getContentText());
      if (meta.parentId && meta.parentId !== sheetId) {
        results.failed.push({
          sheetId: sheetId, scriptId: scriptId,
          reason: 'parentId mismatch: ' + meta.parentId,
        });
        return;
      }
      map[sheetId] = scriptId;
      results.registered.push({ sheetId: sheetId, scriptId: scriptId, title: meta.title || null });
    } catch (e) {
      results.failed.push({ sheetId: sheetId, scriptId: scriptId, reason: String(e.message || e) });
    }
  });
  saveBoundMap_(map);
  return results;
}

function unregisterBoundScript_({ sheetId }) {
  if (!sheetId) throw new Error('sheetId is required');
  const map = getBoundMap_();
  if (!(sheetId in map)) return { removed: false, sheetId: sheetId };
  const previous = map[sheetId];
  delete map[sheetId];
  saveBoundMap_(map);
  return { removed: true, sheetId: sheetId, previousScriptId: previous };
}

function getBoundScript_({ sheetId, autoCreate }) {
  const scriptId = ensureBoundScriptId_(sheetId, !!autoCreate);
  const res = UrlFetchApp.fetch(APPS_SCRIPT_API + '/projects/' + scriptId + '/content', {
    method: 'get',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) {
    throw new Error('get bound content failed: ' + res.getContentText());
  }
  const body = JSON.parse(res.getContentText());
  return { scriptId: scriptId, files: body.files || [] };
}

function writeBoundScript_({ sheetId, files, autoCreate }) {
  if (!Array.isArray(files) || !files.length) throw new Error('files must be non-empty array');
  const scriptId = ensureBoundScriptId_(sheetId, !!autoCreate);
  const hasManifest = files.some(function (f) { return f.name === 'appsscript' && f.type === 'JSON'; });
  const finalFiles = hasManifest ? files : [defaultManifest_()].concat(files);
  const res = UrlFetchApp.fetch(APPS_SCRIPT_API + '/projects/' + scriptId + '/content', {
    method: 'put',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    contentType: 'application/json',
    payload: JSON.stringify({ files: finalFiles }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) {
    throw new Error('write bound content failed: ' + res.getContentText());
  }
  const body = JSON.parse(res.getContentText());
  return {
    scriptId: scriptId,
    files: (body.files || []).map(function (f) { return { name: f.name, type: f.type }; }),
  };
}

function defaultManifest_() {
  return {
    name: 'appsscript',
    type: 'JSON',
    source: JSON.stringify({
      timeZone: 'Asia/Tokyo',
      dependencies: {},
      exceptionLogging: 'STACKDRIVER',
      runtimeVersion: 'V8',
    }),
  };
}

function installTimeTrigger_({ when, job, handlerName }) {
  if (!when || !when.type) throw new Error('when.type is required');
  const handler = handlerName || 'dispatchScheduledJob';
  let builder = ScriptApp.newTrigger(handler).timeBased();
  if (when.type === 'daily') {
    builder = builder.atHour(when.hour != null ? when.hour : 9).everyDays(1);
  } else if (when.type === 'weekly') {
    builder = builder.onWeekDay(weekday_(when.weekday)).atHour(when.hour != null ? when.hour : 9);
  } else if (when.type === 'hourly') {
    builder = builder.everyHours(when.hours || 1);
  } else if (when.type === 'every_minutes') {
    builder = builder.everyMinutes(when.minutes || 5);
  } else {
    throw new Error('unknown when.type: ' + when.type);
  }
  const trigger = builder.create();
  if (job) {
    PropertiesService.getScriptProperties()
      .setProperty(JOB_KEY_PREFIX + trigger.getUniqueId(), JSON.stringify(job));
  }
  return { triggerId: trigger.getUniqueId(), handlerFunction: trigger.getHandlerFunction() };
}

function installSheetTrigger_({ sheetId, eventType, job, handlerName }) {
  const ss = openSheet_(sheetId);
  const handler = handlerName || 'dispatchSheetJob';
  let builder = ScriptApp.newTrigger(handler).forSpreadsheet(ss);
  if (eventType === 'onEdit') builder = builder.onEdit();
  else if (eventType === 'onChange') builder = builder.onChange();
  else if (eventType === 'onFormSubmit') builder = builder.onFormSubmit();
  else if (eventType === 'onOpen') builder = builder.onOpen();
  else throw new Error('unknown eventType: ' + eventType);
  const trigger = builder.create();
  if (job) {
    PropertiesService.getScriptProperties()
      .setProperty(JOB_KEY_PREFIX + trigger.getUniqueId(), JSON.stringify(Object.assign({ sheetId: sheetId }, job)));
  }
  return { triggerId: trigger.getUniqueId(), handlerFunction: trigger.getHandlerFunction() };
}

function weekday_(name) {
  const map = {
    MONDAY: ScriptApp.WeekDay.MONDAY,
    TUESDAY: ScriptApp.WeekDay.TUESDAY,
    WEDNESDAY: ScriptApp.WeekDay.WEDNESDAY,
    THURSDAY: ScriptApp.WeekDay.THURSDAY,
    FRIDAY: ScriptApp.WeekDay.FRIDAY,
    SATURDAY: ScriptApp.WeekDay.SATURDAY,
    SUNDAY: ScriptApp.WeekDay.SUNDAY,
  };
  const k = String(name || 'MONDAY').toUpperCase();
  if (!map[k]) throw new Error('unknown weekday: ' + name);
  return map[k];
}

function dispatchScheduledJob(e) {
  runJobForTrigger_(findTriggerByHandler_('dispatchScheduledJob'));
}

function dispatchSheetJob(e) {
  runJobForTrigger_(findTriggerByHandler_('dispatchSheetJob'));
}

function findTriggerByHandler_(name) {
  return ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === name; });
}

function runJobForTrigger_(triggers) {
  const props = PropertiesService.getScriptProperties();
  triggers.forEach(function (t) {
    const raw = props.getProperty(JOB_KEY_PREFIX + t.getUniqueId());
    if (!raw) return;
    const job = JSON.parse(raw);
    try {
      if (job.action === 'runScript') runScript_({ sheetId: job.sheetId, code: job.code });
    } catch (err) {
      Logger.log('job failed: ' + err);
    }
  });
}

function listTriggers_() {
  const props = PropertiesService.getScriptProperties().getProperties();
  return ScriptApp.getProjectTriggers().map(function (t) {
    const id = t.getUniqueId();
    return {
      id: id,
      handlerFunction: t.getHandlerFunction(),
      eventType: String(t.getEventType()),
      job: props[JOB_KEY_PREFIX + id] ? JSON.parse(props[JOB_KEY_PREFIX + id]) : null,
    };
  });
}

function deleteTrigger_({ triggerId }) {
  const triggers = ScriptApp.getProjectTriggers();
  const target = triggers.filter(function (t) { return t.getUniqueId() === triggerId; })[0];
  if (!target) throw new Error('trigger not found: ' + triggerId);
  ScriptApp.deleteTrigger(target);
  PropertiesService.getScriptProperties().deleteProperty(JOB_KEY_PREFIX + triggerId);
  return { deleted: triggerId };
}
