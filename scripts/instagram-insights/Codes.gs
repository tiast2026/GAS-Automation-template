// =========================================================================================
// ⚙️ GAS実行・取得設定
// =========================================================================================

const APP_CONFIG = {
  REFRESH_DAYS: 30,       // 自分の投稿を遡って数値を更新する日数
  TAG_REFRESH_DAYS: 30,   // タグ付け投稿を遡って数値を更新する日数
  RECURRING_HOURS: 4,     // 自動更新の頻度（時間間隔）
  LOG_RETENTION: 100,     // 実行ログの保持行数
  TIMEZONE: "JST",        // タイムゾーン
  API_VERSION: "v22.0"    // Instagram Graph API バージョン
};

// =========================================================================================
// 📊 メニュー構成
// =========================================================================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("📊 Instagram分析メニュー")
    .addItem("1️⃣ 初期設定：無期限トークン発行", "issueAccessToken")
    .addItem("2️⃣ 初期設定：アカウント一覧更新", "updateInstagramAccounts")
    .addSeparator()
    .addItem("🚀 今すぐデータ取得（通常）", "handler")
    .addItem("📅 【手動】過去1年分を遡って取得", "manualPastYearSync")
    .addSeparator()
    .addItem("⏰ 自動更新：開始 (" + APP_CONFIG.RECURRING_HOURS + "時間おき)", "setTrigger")
    .addItem("🚫 自動更新：停止", "removeTrigger")
    .addToUi();
}

// =========================================================================================
// 🚀 メインハンドラー
// =========================================================================================

function handler() {
  try {
    const settings = getSettings();
    if (!settings.accessToken || !settings.selectedAccountName) throw new Error("設定不足（B5, B6セルを確認）");
    const accountId = getInstagramAccountId(settings.selectedAccountName);
    
    writeLog("INFO", "🚀 通常データ取得開始");
    
    safeRun(() => updateAccountInsights(settings, accountId), "アカウントインサイト");
    safeRun(() => updatePostInsights(settings, accountId), "投稿のインサイト");
    safeRun(() => updateStoriesInsights(settings, accountId), "ストーリーズ取得");
    safeRun(() => updateTaggingList(settings, accountId), "タグ付け投稿一覧");
    safeRun(() => updateHashtagHistory(), "ハッシュタグ履歴作成");
    safeRun(() => updateAudienceDemographics(settings, accountId), "フォロワー属性");
    safeRun(() => updateAudienceLocale(settings, accountId), "国・地域属性");
    safeRun(() => updateOnlineFollowers(settings, accountId), "アクティブ時間");

    writeLog("SUCCESS", "✅ 全データの更新完了");
  } catch (error) { 
    writeLog("ERROR", "メイン処理失敗: " + error.message); 
  }
}

function safeRun(fn, label) { try { fn(); } catch (e) { writeLog("WARN", label + "失敗: " + e.message); } }

// =========================================================================================
// 📡 インサイト詳細（国・地域：完全日本語化・3列構成）
// =========================================================================================

function updateAudienceLocale(settings, accountId) {
  // --- 1. 国別データの取得（フォロワーの国） ---
  const countryDict = {"JP":"日本","US":"アメリカ","TW":"台湾","HK":"香港","KR":"韓国","TH":"タイ","SG":"シンガポール","VN":"ベトナム","PH":"フィリピン","MY":"マレーシア","ID":"インドネシア","AU":"オーストラリア","CA":"カナダ","GB":"イギリス","FR":"フランス","DE":"ドイツ","IT":"イタリア","ES":"スペイン","BR":"ブラジル","RU":"ロシア","IN":"インド","CN":"中国","MX":"メキシコ","CL":"チリ","CO":"コロンビア","NG":"ナイジェリア","IL":"イスラエル","AR":"アルゼンチン","NZ":"ニュージーランド"};
  const countryUrl = `https://graph.facebook.com/${APP_CONFIG.API_VERSION}/${accountId}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=country`;
  const resCountry = requestWithToken(countryUrl, settings.accessToken);
  
  if (resCountry.data && resCountry.data[0] && resCountry.data[0].total_value) {
    const results = resCountry.data[0].total_value.breakdowns[0].results.map(r => {
      const code = r.dimension_values[0];
      return [countryDict[code] || code, code, r.value];
    }).sort((a, b) => b[2] - a[2]);
    const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("フォロワーの国") || SpreadsheetApp.getActiveSpreadsheet().insertSheet("フォロワーの国");
    s.clearContents();
    s.appendRow(["国名", "国コード", "フォロワー数"]);
    if (results.length > 0) s.getRange(2, 1, results.length, 3).setValues(results);
  }

  // --- 2. 市区町村別データの取得（A:和名, B:英語, C:数値） ---
  const cityUrl = `https://graph.facebook.com/${APP_CONFIG.API_VERSION}/${accountId}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=city`;
  const resCity = requestWithToken(cityUrl, settings.accessToken);
  
  if (resCity.data && resCity.data[0] && resCity.data[0].total_value) {
    const results = resCity.data[0].total_value.breakdowns[0].results.map(r => {
      let original = r.dimension_values[0]; 
      let parts = original.split(", ");
      let cityName = parts[0] || "";      
      let prefName = parts[1] || "";      
      
      const translate = (text, isPref) => {
        if (!text) return "";
        let key = text.replace(/ Prefecture/gi, "").replace(/-shi/gi, "").replace(/-ku/gi, "").replace(/-machi/gi, "").replace(/-gun/gi, "").trim();
        
        // ★完全対応版・漢字変換辞書
        const dict = {
          "Hamamatsu":"浜松","Iwata":"磐田","Shizuoka":"静岡","Kosai":"湖西","Fukuroi":"袋井","Kakegawa":"掛川","Fujinomiya":"富士宮","Fuji":"富士","Mishima":"三島","Shimada":"島田","Kikugawa":"菊川","Yaizu":"焼津","Izunokuni":"伊豆の国","Mori":"森","Shuchi":"周智","Nagoya":"名古屋","Toyohashi":"豊橋","Toyokawa":"豊川","Okazaki":"岡崎","Kasugai":"春日井","Nisshin":"日進","Aichi":"愛知","Tokyo":"東京","Setagaya":"世田谷","Shinjuku":"新宿","Minato":"港","Shibuya":"渋谷","Meguro":"目黒","Chuo":"中央","Ota":"大田","Adachi":"足立","Nakano":"中野","Sumida":"墨田","Kita":"北","Koto":"江東","Edogawa":"江戸川","Nerima":"練馬","Itabashi":"板橋","Yokohama":"横浜","Kawasaki":"川崎","Odawara":"小田原","Chigasaki":"茅ヶ崎","Kanagawa":"神奈川","Osaka":"大阪","Mino":"箕面","Suita":"吹田","Sakai":"堺","Hirakata":"枚方","Nishinomiya":"西宮","Hyogo":"兵庫","Hyōgo":"兵庫","Kyoto":"京都","Sapporo":"札幌","Hokkaido":"北海道","Fukuoka":"福岡","Kitakyushu":"北九州","Kurume":"久留米","Hiroshima":"広島","Saitama":"埼玉","Kawaguchi":"川口","Sendai":"仙台","Miyagi":"宮城","Matsuyama":"松山","Ehime":"愛媛","Gifu":"岐阜","Hachinohe":"八戸","Aomori":"青森","Kumamoto":"熊本","Fujisawa":"藤沢","Ichinomiya":"一宮","Oita":"大分","Ōita":"大分","Hofu":"防府","Yamaguchi":"山口","Fukushima":"福島","Iwaki":"いわき","Kagoshima":"鹿児島","Toyama":"富山","Chiba":"千葉","Kobe":"神戸","Niigata":"新潟","Amagasaki":"尼崎","Toyota":"豊田"
        };
        
        let kanji = dict[key] || key;

        // 日本の行政単位を再付与
        if (isPref) {
          if (kanji === "東京") return "東京都";
          if (kanji === "大阪" || kanji === "京都") return kanji + "府";
          if (kanji === "北海道") return kanji;
          return kanji + (kanji.match(/県$/) ? "" : "県");
        }
        if (text.toLowerCase().includes("-shi") || kanji.match(/浜松|静岡|名古屋|横浜|大阪|札幌|福岡|広島|仙台|熊本|千葉|堺|新潟|相模原|岡山|川崎|神戸|尼崎|豊田/)) return kanji + (kanji.match(/市$/) ? "" : "市");
        if (text.toLowerCase().includes("-ku") || kanji.match(/世田谷|新宿|港|渋谷|目黒|中央|大田|足立|中野|墨田|北|江東|江戸川|練馬|板橋/)) return kanji + (kanji.match(/区$/) ? "" : "区");
        if (text.toLowerCase().includes("-machi")) return kanji + "町";
        if (text.toLowerCase().includes("-gun")) return kanji + "郡";
        return kanji;
      };

      let jpPref = translate(prefName, true);
      let jpCity = translate(cityName, false);
      let jpStyle = (jpPref + " " + jpCity).trim();
      if (jpPref === jpCity || (jpPref.includes(jpCity) && jpCity !== "")) jpStyle = jpPref; 

      return [jpStyle, original, r.value];
    }).sort((a, b) => b[2] - a[2]);

    const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("フォロワーの地域") || SpreadsheetApp.getActiveSpreadsheet().insertSheet("フォロワーの地域");
    s.clearContents();
    s.appendRow(["市区町村名（和名）", "元の英語表記", "フォロワー数"]);
    if (results.length > 0) s.getRange(2, 1, results.length, 3).setValues(results);
  }
}

// =========================================================================================
// 📡 アクティブ時間（C列維持版）
// =========================================================================================

function updateOnlineFollowers(settings, accountId) {
  const url = `https://graph.facebook.com/${APP_CONFIG.API_VERSION}/${accountId}/insights?metric=online_followers&period=lifetime`;
  const res = requestWithToken(url, settings.accessToken);
  if (res.data && res.data[0] && res.data[0].values) {
    const dataList = res.data[0].values;
    let validData = null;
    for (let i = dataList.length - 1; i >= 0; i--) {
      if (dataList[i].value && Object.values(dataList[i].value).some(v => v > 0)) {
        validData = dataList[i];
        break; 
      }
    }
    if (validData) {
      const r = []; 
      for (let i=0; i<24; i++) r.push([(i+17)%24 + "時", validData.value[i] || 0]);
      const results = r.sort((a,b) => parseInt(a[0])-parseInt(b[0]));
      const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("フォロワーのアクティブ時間") || SpreadsheetApp.getActiveSpreadsheet().insertSheet("フォロワーのアクティブ時間");
      s.getRange("A1:B1").setValues([["時間", "フォロワー数"]]);
      s.getRange(2, 1, 24, 2).setValues(results);
      s.getRange("C1").setValue("データ基準日: " + validData.end_time);
    }
  }
}

// =========================================================================================
// 📡 投稿・タグ付け・ストーリーズ取得
// =========================================================================================

function updatePostInsights(settings, accountId) {
  const sinceTS = Math.floor(subDays(new Date(), APP_CONFIG.REFRESH_DAYS).getTime() / 1000);
  syncMediaDeep(settings, accountId, sinceTS, new Date().getTime(), 5 * 60 * 1000, 10);
}

function syncMediaDeep(settings, accountId, sinceTS, startTime, limitMs, fetchLimit) {
  const table = new Table("投稿のインサイト");
  const mFields = ["reach", "saved", "total_interactions", "views", "shares"];
  const fields = "id,caption,media_product_type,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";
  const pMap = { "REELS": "リール", "FEED": "フィード", "AD": "広告" };
  const mMap = { "IMAGE": "画像", "VIDEO": "動画", "CAROUSEL_ALBUM": "カルーセル" };
  let url = `https://graph.facebook.com/${APP_CONFIG.API_VERSION}/${accountId}/media?fields=${encodeURIComponent(fields)}&limit=${fetchLimit}&since=${sinceTS}`;
  while (url) {
    if (new Date().getTime() - startTime > limitMs) return;
    const res = requestWithToken(url, settings.accessToken);
    if (!res.data || res.data.length === 0) break;
    const updates = res.data.map(post => {
      if (post.media_product_type === "STORY") return null;
      try {
        const iRes = requestWithToken(`https://graph.facebook.com/${APP_CONFIG.API_VERSION}/${post.id}/insights?metric=${encodeURIComponent(mFields.join(","))}`, settings.accessToken);
        let m = {}; if (iRes.data) iRes.data.forEach(metric => { m[metric.name] = (metric.values && metric.values[0]) ? metric.values[0].value : 0; });
        let imgUrl = table.getValue(post.id, "メディアURL");
        if (!imgUrl) imgUrl = saveImageToDrive(settings.folderId, (post.media_type === "VIDEO" || post.media_product_type === "REELS" ? post.thumbnail_url : post.media_url), "Thumb_" + post.id);
        return { "ID": "\"" + post.id, "投稿内容": post.caption || "", "メディアのプロダクト種別": pMap[post.media_product_type] || post.media_product_type, "メディアの種別": mMap[post.media_type] || post.media_type, "メディアURL": imgUrl, "投稿URL": post.permalink, "投稿日時": new Date(post.timestamp), "閲覧数": m.views || 0, "リーチ": m.reach || 0, "インタラクション数": m.total_interactions || 0, "いいね数": post.like_count || 0, "コメント数": post.comments_count || 0, "保存数": m.saved || 0, "シェア数": m.shares || 0 };
      } catch(e) { return null; }
    }).filter(r => r !== null);
    if (updates.length > 0) table.upsert(updates, ["ID"]);
    Utilities.sleep(500); url = (res.paging && res.paging.next) ? res.paging.next : null;
  }
}

function updateTaggingList(settings, accountId) {
  const sinceTS = Math.floor(subDays(new Date(), APP_CONFIG.TAG_REFRESH_DAYS).getTime() / 1000);
  syncTagsDeep(settings, accountId, new Date().getTime(), 5 * 60 * 1000, 5, sinceTS);
}

function syncTagsDeep(settings, accountId, startTime, limitMs, fetchLimit, sinceTS) {
  const table = new Table("タグ付け投稿一覧");
  const fields = "id,username,caption,timestamp,permalink,like_count,comments_count,media_url,thumbnail_url,media_type";
  let curLimit = fetchLimit;
  let url = `https://graph.facebook.com/${APP_CONFIG.API_VERSION}/${accountId}/tags?fields=${encodeURIComponent(fields)}&limit=${curLimit}&since=${sinceTS}`;
  while (url) {
    if (new Date().getTime() - startTime > limitMs) return;
    let res;
    try {
      res = requestWithToken(url, settings.accessToken);
    } catch (e) {
      if (/reduce the amount of data/i.test(e.message) && curLimit > 1) {
        curLimit = Math.max(1, Math.floor(curLimit / 2));
        url = url.replace(/([?&])limit=\d+/, "$1limit=" + curLimit);
        Utilities.sleep(1000);
        continue;
      }
      throw e;
    }
    if (!res.data || res.data.length === 0) break;
    const newList = res.data.map(post => {
      let imgUrl = table.getValue(post.id, "メディアURL");
      if (!imgUrl) imgUrl = saveImageToDrive(settings.folderId, (post.media_type === "VIDEO" ? (post.thumbnail_url || post.media_url) : post.media_url), "TagThumb_" + post.id);
      return { "ID": "\"" + post.id, "投稿日時": new Date(post.timestamp), "アカウント名": post.username || "不明", "プロフィールURL": "https://www.instagram.com/" + post.username + "/", "投稿内容": post.caption || "", "メディアURL": imgUrl, "投稿URL": post.permalink, "いいね数": post.like_count || 0, "コメント数": post.comments_count || 0 };
    });
    table.upsert(newList, ["ID"]);
    Utilities.sleep(1000); url = (res.paging && res.paging.next) ? res.paging.next : null;
  }
}

function updateAccountInsights(settings, accountId) {
  const profileRes = requestWithToken(`https://graph.facebook.com/${APP_CONFIG.API_VERSION}/${accountId}?fields=followers_count,follows_count,media_count`, settings.accessToken);
  const yesterday = subDays(new Date(), 1);
  const since = formatDate(yesterday, "yyyy-MM-dd"), until = formatDate(new Date(), "yyyy-MM-dd");
  const url = `https://graph.facebook.com/${APP_CONFIG.API_VERSION}/${accountId}/insights?metric=accounts_engaged,comments,likes,reach,saves,shares,total_interactions,views&period=day&since=${since}&until=${until}&metric_type=total_value`;
  const res = requestWithToken(url, settings.accessToken);
  if (res.data) {
    const m = {}; res.data.forEach(d => { m[d.name] = (d.total_value && d.total_value.value) ? d.total_value.value : 0; });
    new Table("アカウントのインサイト").upsert([{ "日付": startOfDay(yesterday), "フォロワー数": profileRes.followers_count || 0, "フォロー数": profileRes.follows_count || 0, "投稿数": profileRes.media_count || 0, "閲覧数": m.views || 0, "リーチ": m.reach || 0, "アクションを実行したアカウント": m.accounts_engaged || 0, "インタラクション数": m.total_interactions || 0, "コメント数": m.comments || 0, "いいね数": m.likes || 0, "保存数": m.saves || 0, "シェア数": m.shares || 0 }], ["日付"]);
  }
}

function updateStoriesInsights(settings, accountId) {
  const table = new Table("投稿のインサイト");
  const url = `https://graph.facebook.com/${APP_CONFIG.API_VERSION}/${accountId}/stories?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp`;
  const res = requestWithToken(url, settings.accessToken);
  if (!res.data) return;
  const results = res.data.map(story => {
    try {
      const iRes = requestWithToken(`https://graph.facebook.com/${APP_CONFIG.API_VERSION}/${story.id}/insights?metric=views,reach,replies`, settings.accessToken);
      let m = {}; iRes.data.forEach(metric => { m[metric.name] = (metric.values && metric.values[0]) ? metric.values[0].value : 0; });
      let imgUrl = table.getValue(story.id, "メディアURL");
      if (!imgUrl) imgUrl = saveImageToDrive(settings.folderId, (story.media_type === "VIDEO" ? (story.thumbnail_url || story.media_url) : story.media_url), "StoryThumb_" + story.id);
      return { "ID": "\"" + story.id, "投稿内容": story.caption || "[STORY]", "メディアのプロダクト種別": "ストーリーズ", "メディアの種別": story.media_type, "メディアURL": imgUrl, "投稿URL": story.permalink, "投稿日時": new Date(story.timestamp), "閲覧数": m.views || 0, "リーチ": m.reach || 0, "インタラクション数": m.replies || 0, "いいね数": 0, "コメント数": m.replies || 0, "保存数": 0, "シェア数": 0 };
    } catch (e) { return null; }
  }).filter(r => r !== null);
  if (results.length > 0) table.upsert(results, ["ID"]);
}

function updateAudienceDemographics(settings, accountId) {
  const res = requestWithToken(`https://graph.facebook.com/${APP_CONFIG.API_VERSION}/${accountId}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=age,gender`, settings.accessToken);
  if (res.data && res.data[0] && res.data[0].total_value) {
    const results = res.data[0].total_value.breakdowns[0].results.map(r => {
      let g = {"F":"女性","M":"男性","U":"その他"}[r.dimension_values[1]] || "不明";
      return [r.dimension_values[0], g, r.value];
    });
    const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("フォロワー属性") || SpreadsheetApp.getActiveSpreadsheet().insertSheet("フォロワー属性");
    s.clearContents();
    s.appendRow(["年齢層", "性別", "フォロワー数"]);
    if (results.length > 0) s.getRange(2, 1, results.length, 3).setValues(results).sort({column: 1, ascending: true});
  }
}

function updateHashtagHistory() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const source = ss.getSheetByName("タグ付け投稿一覧");
  if (!source) return;
  const data = source.getDataRange().getValues();
  if (data.length < 2) return;
  const h = data[0], cIdx = h.indexOf("投稿内容"), dIdx = h.indexOf("投稿日時"), list = [];
  for (let i = 1; i < data.length; i++) {
    const cap = data[i][cIdx], dt = data[i][dIdx];
    if (cap) {
      const tags = cap.match(/[#＃][Ａ-Ｚａ-ｚA-Za-z一-龠ぁ-んァ-ヶ0-9_ー]+/g);
      if (tags) tags.forEach(t => list.push([t.replace("＃", "#"), dt]));
    }
  }
  let rs = ss.getSheetByName("ハッシュタグランキング") || ss.insertSheet("ハッシュタグランキング");
  rs.clearContents();
  rs.appendRow(["ハッシュタグ", "投稿日"]);
  if (list.length > 0) rs.getRange(2, 1, list.length, 2).setValues(list.sort((a,b) => b[1]-a[1]));
}

// =========================================================================================
// 🔑 認証・システム系
// =========================================================================================

function manualPastYearSync() {
  const startTime = new Date().getTime();
  const LIMIT_MS = 5 * 60 * 1000; 
  try {
    const settings = getSettings();
    const accountId = getInstagramAccountId(settings.selectedAccountName);
    const oneYearAgo = subDays(new Date(), 365);
    const sinceTS = Math.floor(oneYearAgo.getTime() / 1000);
    writeLog("INFO", "⚠️ 1年分の遡り取得を開始");
    syncMediaDeep(settings, accountId, sinceTS, startTime, LIMIT_MS, 10);
    syncTagsDeep(settings, accountId, startTime, LIMIT_MS, 10, sinceTS); 
    updateHashtagHistory();
    writeLog("SUCCESS", "✅ 遡り処理が終了");
    SpreadsheetApp.getUi().alert("完了しました。画像保存が多い場合は再度実行してください。");
  } catch (error) { writeLog("ERROR", error.message); }
}

function issueAccessToken() {
  const s = getSettings();
  if (!s.appId || !s.appSecret || !s.shortToken) throw new Error("B2〜B4セルを入力してください。");
  const url1 = `https://graph.facebook.com/${APP_CONFIG.API_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${s.appId}&client_secret=${s.appSecret}&fb_exchange_token=${encodeURIComponent(s.shortToken)}`;
  const res1 = JSON.parse(UrlFetchApp.fetch(url1).getContentText());
  if (!res1.access_token) throw new Error("長期トークン取得失敗");
  const fields = "name,access_token,instagram_business_account{username}";
  const url2 = `https://graph.facebook.com/${APP_CONFIG.API_VERSION}/me/accounts?fields=${encodeURIComponent(fields)}&limit=100`;
  const options = { headers: { "Authorization": "Bearer " + res1.access_token }, muteHttpExceptions: true };
  const pRes = JSON.parse(UrlFetchApp.fetch(url2, options).getContentText());
  let target = pRes.data.find(p => p.name === s.selectedAccountName || (p.instagram_business_account && p.instagram_business_account.username === s.selectedAccountName));
  const finalToken = target ? target.access_token : pRes.data[0].access_token;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("設定");
  sheet.getRange("B6").setValue(finalToken);
  sheet.getRange("B7").setValue(new Date()); 
  SpreadsheetApp.getUi().alert("✅ トークン保存完了（B6）");
}

function updateInstagramAccounts() {
  const s = getSettings();
  const url1 = `https://graph.facebook.com/${APP_CONFIG.API_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${s.appId}&client_secret=${s.appSecret}&fb_exchange_token=${encodeURIComponent(s.shortToken)}`;
  const res1 = JSON.parse(UrlFetchApp.fetch(url1).getContentText());
  const fields = "name,id,instagram_business_account{id,username}";
  const url2 = `https://graph.facebook.com/${APP_CONFIG.API_VERSION}/me/accounts?fields=${encodeURIComponent(fields)}&limit=100`;
  const res = requestWithToken(url2, res1.access_token);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Instagramアカウント一覧") || SpreadsheetApp.getActiveSpreadsheet().insertSheet("Instagramアカウント一覧");
  sheet.clearContents();
  sheet.appendRow(["ページ名", "ページID", "IGアカウントID", "IGユーザー名"]);
  res.data.forEach(item => { if (item.instagram_business_account) sheet.appendRow([item.name, item.id, item.instagram_business_account.id, item.instagram_business_account.username]); });
  SpreadsheetApp.getUi().alert("✅ アカウント一覧を更新しました。");
}

function getSettings() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("設定");
  const v = sheet.getRange("B2:B8").getValues().flat();
  return { appId: v[0], appSecret: v[1], shortToken: v[2], selectedAccountName: v[3], accessToken: v[4], folderId: v[6] };
}

function getInstagramAccountId(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Instagramアカウント一覧");
  if(!sheet) throw new Error("アカウント一覧を更新してください");
  const d = sheet.getDataRange().getValues();
  const f = d.find(r => r[3] === name); 
  if (!f) throw new Error("対象アカウントが見つかりません"); 
  return String(f[2]);
}

class Table {
  constructor(n) { this.sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n) || SpreadsheetApp.getActiveSpreadsheet().insertSheet(n); }
  getValue(id, colName) {
    const lr = this.sheet.getLastRow(); if (lr < 2) return null;
    const data = this.sheet.getDataRange().getValues();
    const cIdx = data[0].indexOf(colName);
    if (cIdx === -1) return null;
    const row = data.find(r => String(r[0]).replace(/['"]/g,"") === String(id));
    return row ? row[cIdx] : null;
  }
  upsert(list, keys) {
    if (this.sheet.getLastColumn() === 0) this.sheet.appendRow(Object.keys(list[0]));
    const h = this.sheet.getRange(1,1,1,this.sheet.getLastColumn()).getValues()[0], sd = this.sheet.getDataRange().getValues();
    list.forEach(item => {
      let f = sd.findIndex((row, i) => i > 0 && keys.every(k => String(row[h.indexOf(k)]).replace(/['"]/g,"") === String(item[k]).replace(/['"]/g,"")));
      const nr = h.map(col => item[col] ?? (f !== -1 ? sd[f][h.indexOf(col)] : ""));
      if (f !== -1) this.sheet.getRange(f+1, 1, 1, nr.length).setValues([nr]); else this.sheet.appendRow(nr);
    });
  }
}

function requestWithToken(url, token) {
  const options = { headers: { "Authorization": "Bearer " + token }, muteHttpExceptions: true };
  const res = UrlFetchApp.fetch(url, options);
  const b = JSON.parse(res.getContentText());
  if (res.getResponseCode() !== 200) throw new Error(b.error ? b.error.message : "API Error");
  return b;
}

function saveImageToDrive(fId, url, name) {
  if (!fId || !url) return "";
  try {
    const f = DriveApp.getFolderById(fId);
    const ex = f.getFilesByName(name); if (ex.hasNext()) return ex.next().getUrl();
    const file = f.createFile(UrlFetchApp.fetch(url).getBlob());
    file.setName(name); file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (e) { return ""; }
}

function writeLog(s, m) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let l = ss.getSheetByName("実行ログ") || ss.insertSheet("実行ログ");
  if (l.getLastRow() > APP_CONFIG.LOG_RETENTION) l.deleteRows(2, 50);
  l.appendRow([Utilities.formatDate(new Date(), APP_CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm:ss"), s, m]);
}

const subDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() - n); return r; };
const startOfDay = (d) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };
const formatDate = (d, f) => Utilities.formatDate(d, APP_CONFIG.TIMEZONE, f);
function setTrigger() { removeTrigger(); ScriptApp.newTrigger("handler").timeBased().everyHours(APP_CONFIG.RECURRING_HOURS).create(); }
function removeTrigger() { ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t)); }
