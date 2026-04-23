/**
 * Dispatcher GAS
 *
 * Claude Code からの HTTP POST を受け取り、Google Apps Script API / SpreadsheetApp /
 * ScriptApp を叩く窓口。
 *
 * セットアップ:
 *   1. script.google.com で新規プロジェクトを作成し、本ファイルを貼り付ける
 *   2. appsscript.json をマニフェスト表示 ON にして scripts/_dispatcher/appsscript.json で上書き
 *   3. スクリプトプロパティに SECRET_TOKEN を設定（64 文字以上のランダム文字列）
 *   4. デプロイ → ウェブアプリ（実行: 自分、アクセス: 全員）
 *   5. 発行された URL を .claude/gas-dispatcher.json に貼る
 *
 * 詳しい手順は https://gas-automation.vercel.app/guide/02-setup
 */

/** エントリポイント：全 POST リクエストを action で分岐する */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');

    if (!verifyToken(body.token)) {
      return respondError('UNAUTHORIZED', 'token mismatch');
    }

    const action = body.action;
    const params = body.params || {};
    const handler = HANDLERS[action];

    if (!handler) {
      return respondError('BAD_REQUEST', `unknown action: ${action}`);
    }

    const result = handler(params);
    return respondOk(result);
  } catch (err) {
    const message = err && err.stack ? err.stack : String(err);
    return respondError('INTERNAL_ERROR', message);
  }
}

function doGet() {
  return respondError('BAD_REQUEST', 'GET is not supported. Use POST with JSON body.');
}

function verifyToken(given) {
  const expected = PropertiesService.getScriptProperties().getProperty('SECRET_TOKEN');
  if (!expected) return false;
  if (typeof given !== 'string') return false;
  // 長さの違いで早期リターンするタイミング攻撃回避
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) {
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

function respondOk(result) {
  const body = JSON.stringify({ ok: true, result: result });
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function respondError(code, message) {
  const body = JSON.stringify({ ok: false, error: { code: code, message: message } });
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// ヘルパ: スプレッドシートの解決
// ---------------------------------------------------------------------------

function openSpreadsheet(url) {
  if (!url) throw new Error('params.url is required');
  return SpreadsheetApp.openByUrl(url);
}

function getTab(ss, tabName) {
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    const err = new Error(`tab not found: ${tabName}`);
    err.code = 'NOT_FOUND';
    throw err;
  }
  return sheet;
}

function extractSpreadsheetId(url) {
  const m = /\/d\/([a-zA-Z0-9-_]+)/.exec(url);
  if (!m) throw new Error(`invalid spreadsheet url: ${url}`);
  return m[1];
}

// ---------------------------------------------------------------------------
// ハンドラ群
// ---------------------------------------------------------------------------

const HANDLERS = {
  // 読み取り系
  ping: handlePing,
  listTabs: handleListTabs,
  readTab: handleReadTab,
  readCell: handleReadCell,
  describeTab: handleDescribeTab,

  // 書き込み系
  writeRange: handleWriteRange,
  appendRows: handleAppendRows,
  createTab: handleCreateTab,
  clearTab: handleClearTab,
  renameTab: handleRenameTab,

  // 実行系
  runScript: handleRunScript,

  // コンテナバインド GAS 操作（Apps Script API 使用）
  getBoundScript: handleGetBoundScript,
  writeBoundScript: handleWriteBoundScript,
  registerBoundScript: handleRegisterBoundScript,

  // トリガー系
  installTimeTrigger: handleInstallTimeTrigger,
  installSheetTrigger: handleInstallSheetTrigger,
  listTriggers: handleListTriggers,
  deleteTrigger: handleDeleteTrigger,
};

// ---- 読み取り系 ----------------------------------------------------------

function handlePing() {
  return { pong: true, ts: new Date().toISOString() };
}

function handleListTabs(p) {
  const ss = openSpreadsheet(p.url);
  return { tabs: ss.getSheets().map(s => s.getName()) };
}

function handleReadTab(p) {
  const ss = openSpreadsheet(p.url);
  const sheet = getTab(ss, p.tab);
  const range = p.range ? sheet.getRange(p.range) : sheet.getDataRange();
  return { values: range.getValues() };
}

function handleReadCell(p) {
  const ss = openSpreadsheet(p.url);
  const sheet = getTab(ss, p.tab);
  return { value: sheet.getRange(p.cell).getValue() };
}

function handleDescribeTab(p) {
  const ss = openSpreadsheet(p.url);
  const sheet = getTab(ss, p.tab);
  const range = sheet.getDataRange();
  const values = range.getValues();
  return {
    rows: range.getNumRows(),
    cols: range.getNumColumns(),
    headers: values.length > 0 ? values[0] : [],
  };
}

// ---- 書き込み系 ----------------------------------------------------------

function handleWriteRange(p) {
  const ss = openSpreadsheet(p.url);
  const sheet = getTab(ss, p.tab);
  const values = p.values || [];
  if (values.length === 0) return { written: 0 };
  const rows = values.length;
  const cols = values[0].length;
  const anchor = sheet.getRange(p.range || 'A1');
  sheet.getRange(anchor.getRow(), anchor.getColumn(), rows, cols).setValues(values);
  return { written: rows * cols, rows: rows, cols: cols };
}

function handleAppendRows(p) {
  const ss = openSpreadsheet(p.url);
  const sheet = getTab(ss, p.tab);
  const rows = p.rows || [];
  rows.forEach(row => sheet.appendRow(row));
  return { appended: rows.length };
}

function handleCreateTab(p) {
  const ss = openSpreadsheet(p.url);
  if (ss.getSheetByName(p.tab)) {
    throw new Error(`tab already exists: ${p.tab}`);
  }
  const sheet = ss.insertSheet(p.tab, typeof p.position === 'number' ? p.position : ss.getNumSheets());
  return { tab: sheet.getName(), index: sheet.getIndex() };
}

function handleClearTab(p) {
  const ss = openSpreadsheet(p.url);
  const sheet = getTab(ss, p.tab);
  sheet.clear();
  return { tab: p.tab, cleared: true };
}

function handleRenameTab(p) {
  const ss = openSpreadsheet(p.url);
  const sheet = getTab(ss, p.tab);
  sheet.setName(p.newName);
  return { from: p.tab, to: p.newName };
}

// ---- 実行系 --------------------------------------------------------------

function handleRunScript(p) {
  const code = p.code;
  if (typeof code !== 'string') throw new Error('params.code (string) is required');

  const logs = [];
  const origLog = console.log;
  console.log = function () {
    try {
      logs.push(Array.prototype.slice.call(arguments).map(String).join(' '));
    } catch (_) { /* ignore */ }
    return origLog.apply(console, arguments);
  };

  try {
    // params をコード内から参照できるよう Function 経由で評価
    const fn = new Function('params', code);
    const returnValue = fn(p);
    return { returnValue: returnValue === undefined ? null : returnValue, logs: logs };
  } finally {
    console.log = origLog;
  }
}

// ---- コンテナバインド GAS 操作（Apps Script API 経由） --------------------

const SCRIPT_API_BASE = 'https://script.googleapis.com/v1/projects';

function callScriptApi(path, method, payload) {
  const url = `${SCRIPT_API_BASE}${path}`;
  const options = {
    method: method,
    headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
    muteHttpExceptions: true,
    contentType: 'application/json',
  };
  if (payload) options.payload = JSON.stringify(payload);
  const resp = UrlFetchApp.fetch(url, options);
  const status = resp.getResponseCode();
  const text = resp.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error(`Apps Script API ${status}: ${text}`);
  }
  return JSON.parse(text);
}

function resolveBoundScriptId(url) {
  const ssId = extractSpreadsheetId(url);
  // Drive API v2 を使わずに SpreadsheetApp でバインド済みスクリプトの scriptId を直接取る手段はない。
  // 代わりに、事前に registerBoundScript で紐付けた scriptId を
  // ScriptProperties の 'boundScriptIds.<spreadsheetId>' から取得する設計にしている。
  const key = `boundScriptId.${ssId}`;
  const cached = PropertiesService.getScriptProperties().getProperty(key);
  if (!cached) {
    const err = new Error(`no bound script registered for spreadsheet ${ssId}. Call registerBoundScript first.`);
    err.code = 'NOT_FOUND';
    throw err;
  }
  return cached;
}

function handleGetBoundScript(p) {
  const scriptId = resolveBoundScriptId(p.url);
  const res = callScriptApi(`/${scriptId}/content`, 'get');
  const files = (res.files || []).map(f => ({ name: f.name, source: f.source, type: f.type }));
  return { scriptId: scriptId, files: files };
}

function handleWriteBoundScript(p) {
  const scriptId = resolveBoundScriptId(p.url);
  // 既存 content を取得して、指定されたファイルだけ差し替え、それ以外は残す
  const current = callScriptApi(`/${scriptId}/content`, 'get');
  const currentFiles = current.files || [];
  const incoming = p.files || [];
  const byName = {};
  currentFiles.forEach(f => { byName[f.name] = f; });
  incoming.forEach(f => {
    byName[f.name] = {
      name: f.name,
      source: f.source,
      type: inferFileType(f.name),
    };
  });
  const merged = Object.keys(byName).map(k => byName[k]);
  const res = callScriptApi(`/${scriptId}/content`, 'put', { files: merged });
  return { scriptId: scriptId, files: (res.files || []).map(f => f.name) };
}

function inferFileType(name) {
  if (name.endsWith('.html')) return 'HTML';
  if (name === 'appsscript' || name === 'appsscript.json') return 'JSON';
  return 'SERVER_JS';
}

function handleRegisterBoundScript(p) {
  const ssId = extractSpreadsheetId(p.url);
  const key = `boundScriptId.${ssId}`;
  const props = PropertiesService.getScriptProperties();

  if (p.scriptId) {
    props.setProperty(key, p.scriptId);
    return { scriptId: p.scriptId, created: false, registered: true };
  }

  // scriptId 未指定時は Apps Script API で新規プロジェクトを作成してシートにバインド
  const res = callScriptApi('', 'post', {
    title: p.title || 'Container-bound Script',
    parentId: ssId,
  });
  props.setProperty(key, res.scriptId);
  return { scriptId: res.scriptId, created: true, registered: true };
}

// ---- トリガー系 ----------------------------------------------------------
//
// 注: ScriptApp.newTrigger は「自分自身（このスクリプト）」にしかトリガーを張れない。
// コンテナバインド GAS にトリガーを設置するには、
// Apps Script API 経由で「トリガー設置用の関数」をバインド済みスクリプトに注入し、
// scripts.run でその関数を実行する必要がある。
//
// ここでは writeBoundScript で最小限のトリガー管理ユーティリティを注入する方式をとる。

const TRIGGER_BOOTSTRAP_FILE = '_dispatcherTriggerHelpers';

const TRIGGER_BOOTSTRAP_SOURCE = [
  'function __dispatcherInstallTimeTrigger(params) {',
  '  const fn = params.functionName;',
  '  const spec = params.spec;',
  '  let b = ScriptApp.newTrigger(fn).timeBased();',
  '  switch (spec.type) {',
  '    case "everyMinutes": b = b.everyMinutes(spec.minutes); break;',
  '    case "everyHours": b = b.everyHours(spec.hours); break;',
  '    case "dailyAt": b = b.atHour(spec.hour).everyDays(1); break;',
  '    case "weeklyAt": b = b.atHour(spec.hour).everyWeeks(1).onWeekDay(ScriptApp.WeekDay[spec.weekDay]); break;',
  '    default: throw new Error("unknown spec.type: " + spec.type);',
  '  }',
  '  const trigger = b.create();',
  '  return trigger.getUniqueId();',
  '}',
  'function __dispatcherInstallSheetTrigger(params) {',
  '  const fn = params.functionName;',
  '  const event = params.event;',
  '  const ss = SpreadsheetApp.getActiveSpreadsheet();',
  '  let b = ScriptApp.newTrigger(fn).forSpreadsheet(ss);',
  '  switch (event) {',
  '    case "EDIT": b = b.onEdit(); break;',
  '    case "CHANGE": b = b.onChange(); break;',
  '    case "OPEN": b = b.onOpen(); break;',
  '    default: throw new Error("unknown event: " + event);',
  '  }',
  '  const trigger = b.create();',
  '  return trigger.getUniqueId();',
  '}',
  'function __dispatcherListTriggers() {',
  '  return ScriptApp.getProjectTriggers().map(function (t) {',
  '    return {',
  '      id: t.getUniqueId(),',
  '      functionName: t.getHandlerFunction(),',
  '      type: String(t.getEventType()),',
  '    };',
  '  });',
  '}',
  'function __dispatcherDeleteTrigger(params) {',
  '  const id = params.triggerId;',
  '  const triggers = ScriptApp.getProjectTriggers();',
  '  for (let i = 0; i < triggers.length; i++) {',
  '    if (triggers[i].getUniqueId() === id) {',
  '      ScriptApp.deleteTrigger(triggers[i]);',
  '      return true;',
  '    }',
  '  }',
  '  return false;',
  '}',
].join('\n');

function ensureTriggerBootstrap(scriptId) {
  const current = callScriptApi(`/${scriptId}/content`, 'get');
  const files = current.files || [];
  if (files.some(f => f.name === TRIGGER_BOOTSTRAP_FILE)) return;
  const updated = files.concat([{
    name: TRIGGER_BOOTSTRAP_FILE,
    source: TRIGGER_BOOTSTRAP_SOURCE,
    type: 'SERVER_JS',
  }]);
  callScriptApi(`/${scriptId}/content`, 'put', { files: updated });
}

function runOnBoundScript(scriptId, functionName, params) {
  ensureTriggerBootstrap(scriptId);
  const res = callScriptApi(`/${scriptId}:run`, 'post', {
    function: functionName,
    parameters: params ? [params] : [],
    devMode: true,
  });
  if (res.error) {
    throw new Error(`bound script error: ${JSON.stringify(res.error)}`);
  }
  return res.response && res.response.result;
}

function handleInstallTimeTrigger(p) {
  const scriptId = resolveBoundScriptId(p.url);
  const id = runOnBoundScript(scriptId, '__dispatcherInstallTimeTrigger', {
    functionName: p.functionName,
    spec: p.spec,
  });
  return { triggerId: id };
}

function handleInstallSheetTrigger(p) {
  const scriptId = resolveBoundScriptId(p.url);
  const id = runOnBoundScript(scriptId, '__dispatcherInstallSheetTrigger', {
    functionName: p.functionName,
    event: p.event,
  });
  return { triggerId: id };
}

function handleListTriggers(p) {
  const scriptId = resolveBoundScriptId(p.url);
  const triggers = runOnBoundScript(scriptId, '__dispatcherListTriggers');
  return { triggers: triggers || [] };
}

function handleDeleteTrigger(p) {
  const scriptId = resolveBoundScriptId(p.url);
  const deleted = runOnBoundScript(scriptId, '__dispatcherDeleteTrigger', {
    triggerId: p.triggerId,
  });
  return { deleted: !!deleted };
}
