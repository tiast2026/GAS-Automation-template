// ▼▼▼ APIキー設定済み ▼▼▼
const GEMINI_API_KEY = 'AIzaSyCmt3Rm_XUOAsKfwhSJI0cSnGQ25CFDyfs';

function analyzeInstagramInsights() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // --- ★追加：分析の基準（設定シート B5）を読み込む ---
  let analysisContext = "";
  const settingSheet = ss.getSheetByName('設定');
  if (settingSheet) {
    analysisContext = settingSheet.getRange('B5').getValue();
    console.log("分析基準(B5)を読み込みました: " + analysisContext);
  } else {
    console.warn("「設定」シートが見つからないため、デフォルト基準で分析します。");
  }

  // シートの確認・作成（3列構成）
  let outputSheet = ss.getSheetByName('AI Analysis');
  if (!outputSheet) {
    outputSheet = ss.insertSheet('AI Analysis');
  }
  
  // 既存データをクリアし、ヘッダーを再設定
  outputSheet.clear(); 
  outputSheet.getRange('A1:C1').setValues([['分析カテゴリ(ID)', '見出し(Label)', 'AIコメント(Text)']]);

  // --- 分析設定 ---
  const TARGETS = [
    {
      id: 'Follower_Trend', // 1. フォロワー数の推移
      sheetName: 'アカウントのインサイト',
      getData: function(sheet) {
        const lastRow = sheet.getLastRow();
        const startRow = Math.max(2, lastRow - 6); 
        const header = sheet.getRange(1, 1, 1, 12).getValues(); 
        const body = sheet.getRange(startRow, 1, lastRow - startRow + 1, 12).getValues();
        return header.concat(body);
      },
      prompt: '直近1週間の「フォロワー数」の推移を分析してください。以下のJSON形式のリスト（要素数1つ）で出力してください。\n[{"label": "推移分析", "text": "ここに150文字以内の解説"}]'
    },
    {
      id: 'Active_Time', // 2. フォロワーのアクティブ時間
      sheetName: 'フォロワーのアクティブ時間',
      getData: function(sheet) {
        return sheet.getDataRange().getValues();
      },
      prompt: 'フォロワーがアクティブな時間帯を分析し、投稿のおすすめ時間を3つ提案してください。以下のJSON形式のリスト（要素数3つ）で出力してください。\n[{"label": "推奨①", "text": "時間帯と理由"}, {"label": "推奨②", "text": "時間帯と理由"}, {"label": "推奨③", "text": "時間帯と理由"}]'
    },
    {
      id: 'Tagged_Posts', // 3. タグ付け投稿
      sheetName: 'タグ付け投稿一覧',
      getData: function(sheet) {
        const lastRow = sheet.getLastRow();
        const startRow = Math.max(2, lastRow - 4);
        const header = sheet.getRange(1, 1, 1, 8).getValues();
        const body = sheet.getRange(startRow, 1, lastRow - startRow + 1, 8).getValues();
        return header.concat(body);
      },
      prompt: '直近のタグ付け投稿（UGC）を分析してください。以下のJSON形式のリスト（要素数1つ）で出力してください。\n[{"label": "UGC分析", "text": "ここに150文字以内の解説"}]'
    },
    {
      id: 'Winning_Pattern', // 4. ★勝ちパターン分析
      sheetName: '投稿のインサイト',
      getData: function(sheet) {
        const allData = sheet.getDataRange().getValues();
        if (allData.length < 2) return allData;

        const header = allData[0];
        let targetColIndex = header.indexOf('保存数');
        if (targetColIndex === -1) targetColIndex = header.indexOf('いいね数');
        
        const rows = allData.slice(1);

        if (targetColIndex !== -1) {
          rows.sort((a, b) => {
            const valA = (typeof a[targetColIndex] === 'number') ? a[targetColIndex] : 0;
            const valB = (typeof b[targetColIndex] === 'number') ? b[targetColIndex] : 0;
            return valB - valA; 
          });
        }

        const topRows = rows.slice(0, 5);
        return [header].concat(topRows);
      },
      prompt: '保存数が多かった上位投稿を分析し、ユーザーに響く「勝ちパターン」を特定してください。以下のJSON形式のリスト（要素数2つ）で出力してください。\n[{"label": "成功要因", "text": "共通する成功要因（画像や内容など）を分析"}, {"label": "次回の対策", "text": "次の投稿で意識すべき具体的なアクション"}]'
    },
    {
      id: 'Demographics', // 5. ★新規追加：フォロワーの性別・年齢
      sheetName: 'フォロワー属性', // ※実際のシート名に合わせてください
      getData: function(sheet) {
        // 全データを取得してAIに渡す
        return sheet.getDataRange().getValues();
      },
      prompt: 'フォロワーの性別と年齢層のデータを分析し、メインとなるターゲット層（ペルソナ）を特定してください。以下のJSON形式のリスト（要素数2つ）で出力してください。\n[{"label": "中心ターゲット層", "text": "性別・年代の傾向と特徴（例: 30代女性が中心など）"}, {"label": "アプローチ提案", "text": "その層に向けた投稿の切り口やトーンの提案"}]'
    }
  ];

  // --- 実行処理 ---
  let outputRows = []; 

  for (let i = 0; i < TARGETS.length; i++) {
    const target = TARGETS[i];
    
    try {
      const sheet = ss.getSheetByName(target.sheetName);
      if (!sheet) {
        console.warn(`シートが見つかりません: ${target.sheetName}`);
        outputRows.push([target.id, "スキップ", "シートが見つかりません: " + target.sheetName]);
        continue;
      }

      console.log(`${target.id} の分析を開始します...`);
      const dataValues = target.getData(sheet);
      
      let dataString = "";
      dataValues.forEach(row => { 
        const formattedRow = row.map(cell => {
          if (cell instanceof Date) return Utilities.formatDate(cell, Session.getScriptTimeZone(), "MM/dd");
          let str = String(cell);
          if (str.length > 100) str = str.substring(0, 100) + "...";
          return str;
        });
        dataString += formattedRow.join(", ") + "\n"; 
      });

      // --- ★追加：プロンプトにB5の内容を結合 ---
      const finalPrompt = `
        以下のデータに基づき、指示されたJSON形式のみを出力してください。
        
        【全体的な分析方針・役割設定】
        ${analysisContext}
        
        【個別の指示】
        ${target.prompt}
        
        【データ】
        ${dataString}
      `;

      // ★モデル：ご指定の gemini-flash-latest (2.5 Flash実験版) を使用
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
      
      const options = {
        "method": "post",
        "contentType": "application/json",
        "muteHttpExceptions": true,
        "payload": JSON.stringify({
          "contents": [{ "parts": [{ "text": finalPrompt }] }],
          "generationConfig": { "response_mime_type": "application/json" }
        })
      };

      // リトライ処理（429エラー時に少しだけ粘る）
      let response;
      let responseCode;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount <= maxRetries) {
        response = UrlFetchApp.fetch(url, options);
        responseCode = response.getResponseCode();

        if (responseCode === 429) { // Too Many Requests
          retryCount++;
          if (retryCount > maxRetries) break;
          // 実験版モデルは回復に時間がかかる場合があるため、長めに待機
          console.warn(`>> 429エラー発生。リトライします (${retryCount}/${maxRetries})... 30秒待機`);
          Utilities.sleep(30000); 
        } else {
          break; 
        }
      }

      if (responseCode === 200) {
        const jsonResponse = JSON.parse(response.getContentText());
        let aiRawText = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        
        let parsedData = [];
        try {
          parsedData = JSON.parse(aiRawText);
        } catch (e) {
          console.warn("JSONパース失敗、テキストとして処理");
          parsedData = [{ label: "分析結果", text: aiRawText }];
        }

        if (Array.isArray(parsedData)) {
          parsedData.forEach(item => {
            outputRows.push([target.id, item.label || "詳細", item.text || ""]);
          });
        }
        console.log(`>> 成功: ${target.id}`);

      } else {
        console.error(`>> APIエラー(${responseCode}): ` + response.getContentText());
        outputRows.push([target.id, "エラー", "API Error: " + responseCode]);
      }

    } catch (e) {
      console.error(e);
      outputRows.push([target.id, "エラー", "システムエラー: " + e.toString()]);
    }

    // 待機時間（実験版は制限がきついため、少し長めに取っておくのが無難です）
    if (i < TARGETS.length - 1) {
      console.log("...待機中(15秒)...");
      Utilities.sleep(15000); 
    }
  }

  // 書き込み
  if (outputRows.length > 0) {
    outputSheet.getRange(2, 1, outputRows.length, 3).setValues(outputRows);
  }
}
