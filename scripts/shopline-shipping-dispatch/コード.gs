// ========================================
// メニュー追加
// ========================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📦 出荷データ作成')
    .addItem('▶ ① 振り分け実行', 'createShippingData')
    .addItem('▶ ② 出荷完了データ作成', 'createShipmentComplete')
    .addItem('▶ ③ アップロード済み削除', 'cleanupAfterUpload')
    .addToUi();
}

// ========================================
// ① 振り分け実行 + 出荷指示済みデータに自動蓄積
// ========================================
function createShippingData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  
  var srcSheet = ss.getSheetByName('SHOPLINE');
  var nekoSheet = ss.getSheetByName('クロネコゆうパケット');
  var yamatoSheet = ss.getSheetByName('ヤマト宅配便');
  var shijSheet = ss.getSheetByName('SHOPLINE出荷指示済みデータ');
  
  if (!srcSheet || !nekoSheet || !yamatoSheet) {
    ui.alert('エラー：「SHOPLINE」「クロネコゆうパケット」「ヤマト宅配便」の3シートが必要です。');
    return;
  }
  if (!shijSheet) {
    ui.alert('エラー：「SHOPLINE出荷指示済みデータ」シートが見つかりません。');
    return;
  }
  
  var data = srcSheet.getDataRange().getValues();
  if (data.length < 3) {
    ui.alert('SHOPLINEシートにデータがありません。（1行目:カテゴリ、2行目:ヘッダー、3行目以降:データ）');
    return;
  }
  
  var headers = data[1];
  var headerMap = {};
  for (var i = 0; i < headers.length; i++) {
    headerMap[normalizeHeader(String(headers[i]))] = i;
  }
  
  var col = {};
  col.orderNumber = findInMap(headerMap, ['ordernumber']);
  col.orderId = findInMap(headerMap, ['orderid']);
  col.productName = findInMap(headerMap, ['productname']);
  col.recipientName = findInMap(headerMap, ["recipient'sname", "recipientsname", "recipient\u2019sname"]);
  col.phone = findInMap(headerMap, ["recipient'sphonenumber", "recipientsphonenumber", "recipient\u2019sphonenumber"]);
  col.address1 = findInMap(headerMap, ['address1']);
  col.address2 = findInMap(headerMap, ['address2']);
  col.city = findInMap(headerMap, ['city']);
  col.province = findInMap(headerMap, ['province/state', 'provincestate']);
  col.postalCode = findInMap(headerMap, ['postalcode']);
  col.quantity = findInMap(headerMap, ['quantity']);
  
  var missing = [];
  var colNames = {
    orderNumber: 'Order number', orderId: 'Order ID', productName: 'Product name',
    recipientName: "Recipient's name", phone: "Recipient's phone number",
    address1: 'Address 1', address2: 'Address 2', city: 'City',
    province: 'Province / State', postalCode: 'Postal code', quantity: 'Quantity'
  };
  for (var key in col) {
    if (col[key] === -1) missing.push(colNames[key] || key);
  }
  if (missing.length > 0) {
    var debugInfo = '\n\n【デバッグ情報】検出されたヘッダー（最初の20個）:\n';
    var count = 0;
    for (var key2 in headerMap) {
      if (count >= 20) break;
      if (key2 !== '') { debugInfo += '  ' + key2 + '\n'; count++; }
    }
    ui.alert('SHOPLINEシートで以下のヘッダーが見つかりません：\n' + missing.join(', ') + debugInfo);
    return;
  }
  
  var sender = {
    phone: '054-265-3210', name: 'Myu本店',
    zip: '420-0913', address: '静岡県静岡市葵区瀬名川2丁目26-5-1',
    building: '', kana: ''
  };
  
  var outputHeader = [
    '出荷予定日', 'お客様管理番号', '送り状種類', 'クール区分',
    'お届け先電話番号', 'お届け先名', 'お届け先郵便番号', 'お届け先住所',
    'お届け先建物名', 'お届け先名略称カナ',
    'ご依頼主電話番号', 'ご依頼主名', 'ご依頼主郵便番号', 'ご依頼主住所',
    'ご依頼主建物名', 'ご依頼主略称カナ',
    '品名１', '品名２', 'お届け予定（指定）日', '配送時間帯',
    '発行枚数', '合計金額', '内消費税', '配送備考',
    'お届け先会社・部門名１', 'お届け先会社・部門名２', '注文番号'
  ];
  
  // --- SHOPLINE出荷指示済みデータの既存注文番号を取得（重複防止） ---
  var existingOrders = {};
  var shijData = shijSheet.getDataRange().getValues();
  var shijHeaderRow = findHeaderRow(shijData);
  
  if (shijHeaderRow >= 0) {
    var shijHeaderMap2 = {};
    for (var i = 0; i < shijData[shijHeaderRow].length; i++) {
      shijHeaderMap2[normalizeHeader(String(shijData[shijHeaderRow][i]))] = i;
    }
    var shijOrderCol = findInMap(shijHeaderMap2, ['ordernumber', 'orderbaseinfoordernumber']);
    if (shijOrderCol !== -1) {
      for (var i = shijHeaderRow + 1; i < shijData.length; i++) {
        var existOrder = String(shijData[i][shijOrderCol]).trim();
        if (existOrder) existingOrders[existOrder] = true;
      }
    }
  }
  
  // =============================================
  // STEP1: 注文番号ごとに情報を集約
  // =============================================
  var orderInfo = {};
  
  for (var i = 2; i < data.length; i++) {
    var row = data[i];
    var orderNum = String(row[col.orderNumber]).trim();
    if (!orderNum || orderNum === '') continue;
    
    var productName = String(row[col.productName]).trim();
    var hasTH = productName.toUpperCase().indexOf('TH') !== -1;
    var qty = parseInt(row[col.quantity]) || 1;
    
    if (!orderInfo[orderNum]) {
      orderInfo[orderNum] = {
        hasTH: false,
        totalQty: 0,
        firstRow: row,
        rows: []
      };
    }
    
    if (hasTH) orderInfo[orderNum].hasTH = true;
    orderInfo[orderNum].totalQty += qty;
    orderInfo[orderNum].rows.push(row);
  }
  
  // =============================================
  // STEP2: 注文番号ごとに振り分け判定
  // =============================================
  var nekoRows = [];
  var yamatoRows = [];
  var stockRows = [];
  var skippedCount = 0;
  
  for (var orderNum in orderInfo) {
    var info = orderInfo[orderNum];
    var row = info.firstRow;
    
    var isTakuhai = info.hasTH || info.totalQty >= 3;
    
    var phone = String(row[col.phone]).replace(/[^0-9]/g, '');
    if (phone && phone.charAt(0) !== '0') phone = '0' + phone;
    
    var zip = String(row[col.postalCode]).replace(/[^0-9]/g, '');
    if (zip.length === 7) zip = zip.substring(0, 3) + '-' + zip.substring(3);
    
    var province = String(row[col.province] || '').trim();
    var city = String(row[col.city] || '').trim();
    var addr1 = String(row[col.address1] || '').trim();
    var addr2 = String(row[col.address2] || '').trim();
    var fullAddress = province + city + addr1;
    var recipientName = String(row[col.recipientName]).trim();
    
    var outputRow = [
      '', orderNum, isTakuhai ? '0' : 'A', '',
      phone, recipientName, zip, fullAddress,
      addr2, '',
      sender.phone, sender.name, sender.zip, sender.address,
      sender.building, sender.kana,
      '', '', '', '',
      '1', '', '', '',
      '', '', orderNum
    ];
    
    if (isTakuhai) {
      yamatoRows.push(outputRow);
    } else {
      nekoRows.push(outputRow);
    }
    
    if (!existingOrders[orderNum]) {
      for (var r = 0; r < info.rows.length; r++) {
        stockRows.push(info.rows[r]);
      }
    } else {
      skippedCount++;
    }
  }
  
  nekoSheet.clearContents();
  nekoSheet.getRange(1, 1, 1, outputHeader.length).setValues([outputHeader]);
  if (nekoRows.length > 0) nekoSheet.getRange(2, 1, nekoRows.length, outputHeader.length).setValues(nekoRows);
  
  yamatoSheet.clearContents();
  yamatoSheet.getRange(1, 1, 1, outputHeader.length).setValues([outputHeader]);
  if (yamatoRows.length > 0) yamatoSheet.getRange(2, 1, yamatoRows.length, outputHeader.length).setValues(yamatoRows);
  
  // --- 出荷指示済みデータに追加蓄積 ---
  var stockHeader = data[1];
  
  if (shijHeaderRow < 0 || shijData.length <= 1) {
    shijSheet.clearContents();
    shijSheet.getRange(1, 1, 1, stockHeader.length).setValues([stockHeader]);
    if (stockRows.length > 0) {
      shijSheet.getRange(2, 1, stockRows.length, stockRows[0].length).setValues(stockRows);
    }
  } else if (stockRows.length > 0) {
    var lastRow = shijSheet.getLastRow();
    shijSheet.getRange(lastRow + 1, 1, stockRows.length, stockRows[0].length).setValues(stockRows);
  }
  
  var msg = '✅ 振り分け完了！\n\n' +
    'ネコポス：' + nekoRows.length + ' 件\n' +
    '宅急便：' + yamatoRows.length + ' 件\n\n' +
    '📋 出荷指示済みデータに ' + stockRows.length + ' 行追加蓄積';
  
  if (skippedCount > 0) {
    msg += '\n（既に蓄積済み ' + skippedCount + ' 件はスキップ）';
  }
  
  ui.alert(msg);
}

// ========================================
// ② 出荷完了データ作成（照合）
// ========================================
function createShipmentComplete() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  
  var shijSheet = ss.getSheetByName('SHOPLINE出荷指示済みデータ');
  var trackSheet = ss.getSheetByName('ヤマト追跡番号');
  var completeSheet = ss.getSheetByName('本店アップロード出荷完了');
  
  if (!shijSheet || !trackSheet || !completeSheet) {
    ui.alert('エラー：「SHOPLINE出荷指示済みデータ」「ヤマト追跡番号」「本店アップロード出荷完了」の3シートが必要です。');
    return;
  }
  
  // --- SHOPLINE出荷指示済みデータ読み込み（ヘッダー行を自動検出） ---
  var shijData = shijSheet.getDataRange().getValues();
  if (shijData.length < 2) {
    ui.alert('SHOPLINE出荷指示済みデータにデータがありません。');
    return;
  }
  
  var shijHeaderRow = findHeaderRow(shijData);
  if (shijHeaderRow === -1) {
    ui.alert('SHOPLINE出荷指示済みデータでヘッダー行が見つかりません。');
    return;
  }
  
  var shijHeaders = shijData[shijHeaderRow];
  var shijHeaderMap = {};
  for (var i = 0; i < shijHeaders.length; i++) {
    shijHeaderMap[normalizeHeader(String(shijHeaders[i]))] = i;
  }
  
  var shijColOrder = findInMap(shijHeaderMap, ['ordernumber']);
  var shijColOrderId = findInMap(shijHeaderMap, ['orderid']);
  
  if (shijColOrder === -1 || shijColOrderId === -1) {
    ui.alert('SHOPLINE出荷指示済みデータで「Order number」または「Order ID」が見つかりません。\n\nヘッダー行を確認してください。');
    return;
  }
  
  // 注文番号 → Order ID のマップ作成
  var orderIdMap = {};
  for (var i = shijHeaderRow + 1; i < shijData.length; i++) {
    var orderNum = String(shijData[i][shijColOrder]).trim();
    var orderId = String(shijData[i][shijColOrderId]).trim();
    if (orderNum && orderId && !orderIdMap[orderNum]) {
      orderIdMap[orderNum] = orderId;
    }
  }
  
  // --- ヤマト追跡番号読み込み ---
  var trackData = trackSheet.getDataRange().getValues();
  if (trackData.length < 2) {
    ui.alert('ヤマト追跡番号シートにデータがありません。');
    return;
  }
  
  var trackHeaders = trackData[0];
  var trackHeaderMap = {};
  for (var i = 0; i < trackHeaders.length; i++) {
    trackHeaderMap[normalizeHeader(String(trackHeaders[i]))] = i;
  }
  
  var trackColCustomer = findInMap(trackHeaderMap, ['お客様管理番号']);
  var trackColDenpyo = findInMap(trackHeaderMap, ['伝票番号']);
  
  if (trackColCustomer === -1 || trackColDenpyo === -1) {
    ui.alert('ヤマト追跡番号シートで「お客様管理番号」または「伝票番号」が見つかりません。\n\nB2クラウドから出力したデータをそのまま貼り付けてください。');
    return;
  }
  
  // ヤマト追跡番号を読み込み。同じ注文番号は最初の 1 行だけ採用、
  // 2 本目以降の伝票はアラートで警告する。
  var trackingList = [];
  var seenOrders = {};
  var duplicateExtras = [];
  for (var i = 1; i < trackData.length; i++) {
    var custNum = String(trackData[i][trackColCustomer]).trim();
    if (!custNum) continue;
    // 伝票番号の指数表記対策：数値の場合は整数文字列に変換
    var rawDenpyo = trackData[i][trackColDenpyo];
    var denpyo = '';
    if (typeof rawDenpyo === 'number') {
      denpyo = rawDenpyo.toFixed(0);
    } else {
      denpyo = String(rawDenpyo).trim();
    }
    if (seenOrders.hasOwnProperty(custNum)) {
      duplicateExtras.push({ orderNum: custNum, denpyo: denpyo, firstDenpyo: seenOrders[custNum] });
      continue;
    }
    seenOrders[custNum] = denpyo;
    trackingList.push({ orderNum: custNum, denpyo: denpyo });
  }
  
  // --- 照合して出力データ作成 ---
  var trackingUrl = 'https://toi.kuronekoyamato.co.jp/cgi-bin/tneko';
  var outputHeader = [
    'Order number\n \n Required\n Sample: #1001',
    'Order ID\n \n Required\n Sample: 2106701580000000000000001',
    'Logistics service provider\n \n Optional\n If your provider is one listed on the \'Logistics service providers\' sheet, please enter their name exactly as shown.\n Sample: USPS',
    'Tracking number\n \n Optional\n Given by the logistics service provider\n Sample: UM900192866US',
    'Tracking URL\n \n Optional\n 1. If the logistics service provider you enter is one listed on the \'Logistics service providers\' sheet, we\'ll automatically enter the provider\'s official tracking URL.\n 2. If the logistics service provider isn\'t on the list, you may enter the tracking URL manually so the buyer can track their shipment.'
  ];

  // ヤマト追跡番号の全行を出力。Order ID は出荷指示済みから引いて、無ければ空欄。
  var outputRows = [];
  var missingFromShiji = [];
  for (var t = 0; t < trackingList.length; t++) {
    var entry = trackingList[t];
    var hasShiji = orderIdMap.hasOwnProperty(entry.orderNum);
    var orderId = hasShiji ? orderIdMap[entry.orderNum] : '';
    outputRows.push([
      entry.orderNum,
      orderId,
      'ヤマト運輸',
      entry.denpyo,
      trackingUrl
    ]);
    if (!hasShiji) missingFromShiji.push(entry.orderNum);
  }

  // --- 本店アップロード出荷完了シートに出力 ---
  completeSheet.clearContents();
  completeSheet.getRange(1, 1, 1, outputHeader.length).setValues([outputHeader]);
  if (outputRows.length > 0) {
    completeSheet.getRange(2, 1, outputRows.length, outputHeader.length).setValues(outputRows);
  }

  var matchedCount = outputRows.length - missingFromShiji.length;

  var msg = '✅ 出荷完了データ作成完了！\n\n' +
    '出力行数：' + outputRows.length + ' 件\n' +
    '  ・Order ID 引当済み：' + matchedCount + ' 件\n' +
    '  ・Order ID 空欄（指示データ未登録）：' + missingFromShiji.length + ' 件';

  if (missingFromShiji.length > 0) {
    msg += '\n\n⚠️ Order ID が空欄の注文番号：\n';
    var displayLimit = 30;
    var shown = missingFromShiji.slice(0, displayLimit);
    msg += shown.map(function(n) { return '  ・' + n; }).join('\n');
    if (missingFromShiji.length > displayLimit) {
      msg += '\n  …他 ' + (missingFromShiji.length - displayLimit) + ' 件';
    }
    msg += '\n\n→ シート上で空欄を確認して、必要なら指示データを補ってください。';
  }

  if (duplicateExtras.length > 0) {
    msg += '\n\n⚠️ 同じ注文番号で複数の伝票番号があります（' + duplicateExtras.length + ' 件）。\n' +
      '出力には最初の伝票だけ採用しました。2 本目以降は手動で対応してください：\n';
    var dupLimit = 20;
    var dupShown = duplicateExtras.slice(0, dupLimit);
    msg += dupShown.map(function(d) {
      return '  ・' + d.orderNum + '（採用: ' + d.firstDenpyo + ' / 未採用: ' + d.denpyo + '）';
    }).join('\n');
    if (duplicateExtras.length > dupLimit) {
      msg += '\n  …他 ' + (duplicateExtras.length - dupLimit) + ' 件';
    }
  }

  msg += '\n\nSHOPLINEへアップロード後、「③ アップロード済み削除」を実行してください。';

  ui.alert(msg);
}

// ========================================
// ③ アップロード済み削除（クリーンアップ）
// ========================================
function cleanupAfterUpload() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  
  var confirm = ui.alert(
    '⚠️ 確認',
    'アップロード済みデータを削除します。\n\n' +
    '・SHOPLINE出荷指示済みデータ → 出荷完了済みの行を削除\n' +
    '・ヤマト追跡番号 → 全データクリア\n\n' +
    'よろしいですか？',
    ui.ButtonSet.YES_NO
  );
  
  if (confirm !== ui.Button.YES) {
    ui.alert('キャンセルしました。');
    return;
  }
  
  var shijSheet = ss.getSheetByName('SHOPLINE出荷指示済みデータ');
  var trackSheet = ss.getSheetByName('ヤマト追跡番号');
  var completeSheet = ss.getSheetByName('本店アップロード出荷完了');
  
  if (!shijSheet || !trackSheet || !completeSheet) {
    ui.alert('エラー：必要なシートが見つかりません。');
    return;
  }
  
  var completeData = completeSheet.getDataRange().getValues();
  var completedOrders = {};
  for (var i = 1; i < completeData.length; i++) {
    var orderNum = String(completeData[i][0]).trim();
    if (orderNum) completedOrders[orderNum] = true;
  }
  
  var shijData = shijSheet.getDataRange().getValues();
  var shijHeaderRow = findHeaderRow(shijData);
  
  if (shijHeaderRow === -1) {
    ui.alert('SHOPLINE出荷指示済みデータでヘッダー行が見つかりません。');
    return;
  }
  
  var shijHeaderMap = {};
  for (var i = 0; i < shijData[shijHeaderRow].length; i++) {
    shijHeaderMap[normalizeHeader(String(shijData[shijHeaderRow][i]))] = i;
  }
  var shijColOrder = findInMap(shijHeaderMap, ['ordernumber']);
  
  if (shijColOrder === -1) {
    ui.alert('SHOPLINE出荷指示済みデータで「Order number」が見つかりません。');
    return;
  }
  
  // ヘッダー行までの行（カテゴリ行含む）を残す
  var remainingRows = [];
  for (var i = 0; i <= shijHeaderRow; i++) {
    remainingRows.push(shijData[i]);
  }
  
  var deletedCount = 0;
  for (var i = shijHeaderRow + 1; i < shijData.length; i++) {
    var orderNum = String(shijData[i][shijColOrder]).trim();
    if (completedOrders[orderNum]) {
      deletedCount++;
    } else {
      remainingRows.push(shijData[i]);
    }
  }
  
  shijSheet.clearContents();
  if (remainingRows.length > 0) {
    shijSheet.getRange(1, 1, remainingRows.length, remainingRows[0].length).setValues(remainingRows);
  }
  
  trackSheet.clearContents();
  
  var remainingCount = remainingRows.length - shijHeaderRow - 1;
  
  ui.alert(
    '✅ クリーンアップ完了！\n\n' +
    '削除済み：' + deletedCount + ' 件\n' +
    '出荷指示済みに残留：' + remainingCount + ' 件\n' +
    'ヤマト追跡番号：クリア済み'
  );
}

// ========================================
// ヘッダー行を自動検出する関数
// 「Order number」や「Order  number」を含む行を探す
// ========================================
function findHeaderRow(data) {
  for (var i = 0; i < Math.min(data.length, 5); i++) {
    for (var j = 0; j < data[i].length; j++) {
      var cell = normalizeHeader(String(data[i][j]));
      if (cell === 'ordernumber' || cell === 'order number') {
        return i;
      }
    }
  }
  return -1;
}

// ========================================
// ヘッダー正規化
// ========================================
function normalizeHeader(str) {
  return str
    .replace(/\s+/g, '')
    .replace(/[''ʼ`]/g, "'")
    .replace(/[""]/g, '"')
    .toLowerCase();
}

// ========================================
// 正規化済みヘッダーマップから列番号を検索
// ========================================
function findInMap(headerMap, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    var key = candidates[i].replace(/\s+/g, '').toLowerCase();
    if (headerMap.hasOwnProperty(key)) return headerMap[key];
  }
  for (var mapKey in headerMap) {
    for (var j = 0; j < candidates.length; j++) {
      var candidate = candidates[j].replace(/\s+/g, '').toLowerCase();
      if (mapKey.indexOf(candidate) !== -1 || candidate.indexOf(mapKey) !== -1) return headerMap[mapKey];
    }
  }
  return -1;
}

