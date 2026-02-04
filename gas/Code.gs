/**
 * 測字大師 - GAS 網頁應用程式 + LINE Bot Webhook
 * GAS 提供前端網頁 + 呼叫 Gemini Vision API + LINE Bot
 */

// ====== 設定區 ======
const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || 'YOUR_GEMINI_API_KEY';
const LINE_CHANNEL_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN') || 'YOUR_LINE_CHANNEL_ACCESS_TOKEN';
const LIFF_URL = PropertiesService.getScriptProperties().getProperty('LIFF_URL') || 'https://liff.line.me/YOUR_LIFF_ID';

// Google Sheets 用戶資料庫
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || '';
const SHEET_NAME = 'Users';
const INITIAL_CREDITS = 1; // 新用戶免費次數
const TEMP_FOLDER_NAME = 'TempImages'; // 暫存圖片資料夾名稱

// ====== 圖片自動清理機制 ======

function getTempFolder() {
  const folders = DriveApp.getFoldersByName(TEMP_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  // 沒找到就建立
  const folder = DriveApp.createFolder(TEMP_FOLDER_NAME);
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return folder;
}

function saveTempImage(base64Data) {
  try {
    console.log('saveTempImage 開始, 資料長度:', base64Data ? base64Data.length : 0);
    
    if (!base64Data) {
      return { success: false, error: '沒有收到圖片資料' };
    }
    
    const folder = getTempFolder();
    console.log('資料夾取得成功:', folder.getName());
    
    const decodedData = Utilities.base64Decode(base64Data);
    console.log('Base64 解碼成功, 位元組:', decodedData.length);
    
    const blob = Utilities.newBlob(decodedData, 'image/png', `temp_${new Date().getTime()}.png`);
    console.log('Blob 建立成功');
    
    const file = folder.createFile(blob);
    console.log('檔案建立成功, ID:', file.getId());
    
    // 設定公開檢視權限 (確保 LINE 可以讀取)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    console.log('權限設定成功');
    
    const fileId = file.getId();
    // 使用 Google Drive 直接連結格式 (LINE 需要 HTTPS 且可直接存取的 URL)
    const imageUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
    
    console.log('圖片 URL:', imageUrl);
    
    return {
      success: true,
      imageUrl: imageUrl,
      fileId: fileId
    };
  } catch (error) {
    console.error('Save temp image error:', error.toString());
    return { success: false, error: '圖片上傳失敗: ' + error.toString() };
  }
}

function cleanOldImages() {
  try {
    const folder = getTempFolder();
    const files = folder.getFiles();
    const now = new Date().getTime();
    const ONE_HOUR = 60 * 60 * 1000;
    
    let deletedCount = 0;
    
    while (files.hasNext()) {
      const file = files.next();
      const created = file.getDateCreated().getTime();
      
      // 刪除超過 1 小時的檔案
      if (now - created > ONE_HOUR) {
        file.setTrashed(true);
        deletedCount++;
      }
    }
    console.log(`已清理 ${deletedCount} 張舊圖片`);
  } catch (error) {
    console.error('Clean images error:', error);
  }
}
// ====== 用戶資料庫函數 ======

// 生成 6 位英數字邀請碼
function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除易混淆字元
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getSheet() {
  if (!SPREADSHEET_ID) {
    // 自動建立新的 Spreadsheet
    const ss = SpreadsheetApp.create('測字大師用戶資料');
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
    const sheet = ss.getActiveSheet();
    sheet.setName(SHEET_NAME);
    // 設定標題列（9 欄，增加 referralCode）
    sheet.getRange(1, 1, 1, 9).setValues([['userId', 'displayName', 'credits', 'usedCount', 'referredBy', 'referralCount', 'waitlistPaid', 'createdAt', 'referralCode']]);
    return sheet;
  }
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, 9).setValues([['userId', 'displayName', 'credits', 'usedCount', 'referredBy', 'referralCount', 'waitlistPaid', 'createdAt', 'referralCode']]);
  }
  return sheet;
}

function findUserRow(sheet, userId) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      return i + 1; // 1-indexed row number
    }
  }
  return null;
}

function getOrCreateUser(userId, displayName, referrerId) {
  const sheet = getSheet();
  const existingRow = findUserRow(sheet, userId);
  
  if (existingRow) {
    // 用戶已存在，返回資料（9 欄）
    const row = sheet.getRange(existingRow, 1, 1, 9).getValues()[0];
    
    // 如果沒有邀請碼，補上一個
    let referralCode = row[8];
    if (!referralCode) {
      referralCode = generateReferralCode();
      sheet.getRange(existingRow, 9).setValue(referralCode);
    }
    
    return {
      userId: row[0],
      displayName: row[1],
      credits: row[2],
      usedCount: row[3],
      referredBy: row[4],
      referralCount: row[5],
      waitlistPaid: row[6],
      createdAt: row[7],
      referralCode: referralCode,
      isNew: false
    };
  }
  
  // 建立新用戶（含邀請碼）
  const referralCode = generateReferralCode();
  const newRow = [
    userId,
    displayName || '',
    INITIAL_CREDITS,
    0,
    referrerId || '',
    0,
    false,
    new Date().toISOString(),
    referralCode
  ];
  sheet.appendRow(newRow);
  
  return {
    userId: newRow[0],
    displayName: newRow[1],
    credits: newRow[2],
    usedCount: newRow[3],
    referredBy: newRow[4],
    referralCount: newRow[5],
    waitlistPaid: newRow[6],
    createdAt: newRow[7],
    referralCode: newRow[8],
    isNew: true
  };
}

// 透過邀請碼找用戶
function findUserByCode(code) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][8] && data[i][8].toUpperCase() === code.toUpperCase()) {
      return {
        row: i + 1,
        userId: data[i][0],
        displayName: data[i][1],
        credits: data[i][2]
      };
    }
  }
  return null;
}

// 兌換邀請碼（新用戶輸入邀請碼，雙方各得 1 次額度）
function redeemReferralCode(newUserId, code) {
  const sheet = getSheet();
  
  // 找邀請人
  const inviter = findUserByCode(code);
  if (!inviter) {
    return { success: false, error: '無效的邀請碼' };
  }
  
  // 不能自己邀請自己
  if (inviter.userId === newUserId) {
    return { success: false, error: '不能使用自己的邀請碼' };
  }
  
  // 檢查新用戶是否已被邀請過
  const newUserRow = findUserRow(sheet, newUserId);
  if (newUserRow) {
    const referredBy = sheet.getRange(newUserRow, 5).getValue();
    if (referredBy) {
      return { success: false, error: '你已經使用過邀請碼了' };
    }
    
    // 更新新用戶的 referredBy
    sheet.getRange(newUserRow, 5).setValue(inviter.userId);
    // 給新用戶 +1 額度
    const newUserCredits = sheet.getRange(newUserRow, 3).getValue();
    sheet.getRange(newUserRow, 3).setValue(newUserCredits + 1);
  }
  
  // 給邀請人 +1 額度
  const inviterCredits = sheet.getRange(inviter.row, 3).getValue();
  sheet.getRange(inviter.row, 3).setValue(inviterCredits + 1);
  // 邀請人邀請次數 +1
  const referralCount = sheet.getRange(inviter.row, 6).getValue();
  sheet.getRange(inviter.row, 6).setValue(referralCount + 1);
  
  return { 
    success: true, 
    inviterName: inviter.displayName || '神秘用戶',
    message: `🎉 邀請碼兌換成功！你和 ${inviter.displayName || '邀請人'} 各獲得 1 次額度！`
  };
}

function useCredit(userId) {
  const sheet = getSheet();
  const row = findUserRow(sheet, userId);
  if (!row) return { success: false, error: '用戶不存在' };
  
  const credits = sheet.getRange(row, 3).getValue();
  if (credits <= 0) {
    return { success: false, error: '額度不足', credits: 0 };
  }
  
  // 扣除額度
  sheet.getRange(row, 3).setValue(credits - 1);
  // 增加使用次數
  const usedCount = sheet.getRange(row, 4).getValue();
  sheet.getRange(row, 4).setValue(usedCount + 1);
  
  return { success: true, credits: credits - 1 };
}

function addCreditToReferrer(referrerId) {
  if (!referrerId) return { success: false };
  
  const sheet = getSheet();
  const row = findUserRow(sheet, referrerId);
  if (!row) return { success: false };
  
  // 增加額度
  const credits = sheet.getRange(row, 3).getValue();
  sheet.getRange(row, 3).setValue(credits + 1);
  // 增加邀請人數
  const referralCount = sheet.getRange(row, 6).getValue();
  sheet.getRange(row, 6).setValue(referralCount + 1);
  
  return { success: true, newCredits: credits + 1 };
}

function joinPaidWaitlist(userId) {
  const sheet = getSheet();
  const row = findUserRow(sheet, userId);
  if (!row) return { success: false, error: '用戶不存在' };
  
  sheet.getRange(row, 7).setValue(true);
  return { success: true, message: '已加入付費等候名單，功能上線後將第一時間通知您！' };
}

function getUserCredits(userId) {
  const sheet = getSheet();
  const row = findUserRow(sheet, userId);
  if (!row) return { credits: INITIAL_CREDITS, exists: false };
  
  const credits = sheet.getRange(row, 3).getValue();
  return { credits: credits, exists: true };
}
// ====== 網頁進入點 ======

/**
 * GET 請求 - 返回 HTML 頁面
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('測字大師')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
}

/**
 * POST 請求 - 處理 LIFF API 呼叫 & LINE Webhook
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // 判斷是 LINE Webhook 還是 LIFF API 呼叫
    if (data.events) {
      // LINE Webhook
      return handleLineWebhook(data.events);
    } else {
      // LIFF API 呼叫
      return handleLiffRequest(data);
    }
    
  } catch (error) {
    console.error('doPost Error:', error);
    return createJsonResponse({ success: false, error: error.message });
  }
}

// ====== LINE Webhook 處理 ======

function handleLineWebhook(events) {
  events.forEach(event => {
    if (event.type === 'message') {
      handleMessageEvent(event);
    } else if (event.type === 'follow') {
      handleFollowEvent(event);
    }
  });
  
  return ContentService.createTextOutput('OK');
}

function handleMessageEvent(event) {
  const replyToken = event.replyToken;
  const message = event.message;
  const userId = event.source.userId;
  
  if (message.type === 'text') {
    const userText = message.text.trim();
    const upperText = userText.toUpperCase();
    
    // 檢查是否為 6 位邀請碼格式（只包含英數字）
    if (/^[A-Z0-9]{6}$/.test(upperText)) {
      // 嘗試兌換邀請碼
      handleReferralCode(replyToken, userId, upperText);
      return;
    }
    
    // 使用者發送文字訊息
    const lowerText = userText.toLowerCase();
    
    if (lowerText.includes('測字') || lowerText.includes('占卜') || lowerText.includes('算命')) {
      // 引導到 LIFF
      replyWithLiffLink(replyToken);
    } else if (lowerText.includes('邀請碼') || lowerText.includes('序號') || lowerText.includes('我的碼')) {
      // 查詢自己的邀請碼
      showMyReferralCode(replyToken, userId);
    } else {
      // 一般訊息：引導使用
      replyWithWelcome(replyToken);
    }
  } else if (message.type === 'image') {
    // 使用者發送圖片：引導到 LIFF（因為需要問題）
    replyWithNeedQuestion(replyToken);
  }
}

// 處理邀請碼兌換
function handleReferralCode(replyToken, userId, code) {
  // 先確保用戶存在
  getOrCreateUser(userId, '', '');
  
  const result = redeemReferralCode(userId, code);
  
  if (result.success) {
    replyMessage(replyToken, [{
      type: 'text',
      text: result.message + '\n\n💡 輸入「測字」開始你的占卜之旅！'
    }]);
  } else {
    replyMessage(replyToken, [{
      type: 'text',
      text: `❌ ${result.error}\n\n💡 如果你想測字，請輸入「測字」`
    }]);
  }
}

// 顯示用戶的邀請碼
function showMyReferralCode(replyToken, userId) {
  const user = getOrCreateUser(userId, '', '');
  
  replyMessage(replyToken, [{
    type: 'flex',
    altText: '你的專屬邀請碼',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🎁 你的專屬邀請碼',
            weight: 'bold',
            size: 'lg',
            color: '#fbbf24'
          },
          {
            type: 'text',
            text: user.referralCode,
            weight: 'bold',
            size: '3xl',
            align: 'center',
            margin: 'lg',
            color: '#8b5cf6'
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'text',
            text: '分享給朋友，請他們：',
            size: 'sm',
            margin: 'lg',
            color: '#9ca3af'
          },
          {
            type: 'text',
            text: '1️⃣ 加入測字大師好友',
            size: 'sm',
            color: '#9ca3af'
          },
          {
            type: 'text',
            text: '2️⃣ 輸入你的邀請碼',
            size: 'sm',
            color: '#9ca3af'
          },
          {
            type: 'text',
            text: '✨ 雙方各得 1 次額度！',
            size: 'sm',
            margin: 'md',
            color: '#10b981'
          }
        ],
        backgroundColor: '#1a1025',
        paddingAll: '20px'
      }
    }
  }]);
}

function handleFollowEvent(event) {
  const replyToken = event.replyToken;
  replyWithWelcome(replyToken);
}

// ====== LINE Reply Functions ======

function replyWithLiffLink(replyToken) {
  const messages = [{
    type: 'flex',
    altText: '🔮 測字大師 - 開始占卜',
    contents: {
      type: 'bubble',
      hero: {
        type: 'box',
        layout: 'vertical',
        contents: [{
          type: 'text',
          text: '🔮',
          size: '4xl',
          align: 'center'
        }],
        paddingAll: '20px',
        backgroundColor: '#1a0a2e'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '測字大師',
            weight: 'bold',
            size: 'xl',
            align: 'center',
            color: '#fbbf24'
          },
          {
            type: 'text',
            text: '心誠則靈，字現天機',
            size: 'sm',
            align: 'center',
            color: '#9ca3af',
            margin: 'sm'
          },
          {
            type: 'text',
            text: '輸入問題 → 手寫一字 → AI 為您拆字解讀',
            size: 'xs',
            align: 'center',
            color: '#6b7280',
            margin: 'lg',
            wrap: true
          }
        ],
        backgroundColor: '#0f0a1a',
        paddingAll: '20px'
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '開始測字',
              uri: LIFF_URL
            },
            style: 'primary',
            color: '#8b5cf6'
          },
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '➕ 加入好友',
              uri: 'https://line.me/R/ti/p/@145yhtov'
            },
            style: 'secondary',
            margin: 'sm'
          }
        ],
        backgroundColor: '#0f0a1a',
        paddingAll: '15px'
      }
    }
  }];
  
  replyMessage(replyToken, messages);
}

function replyWithWelcome(replyToken) {
  // 直接顯示開始測字的 Flex Message
  replyWithLiffLink(replyToken);
}

function replyWithNeedQuestion(replyToken) {
  const messages = [{
    type: 'text',
    text: '📷 收到您的圖片了！\n\n不過測字需要您先說明「想問什麼問題」，這樣才能針對問題解讀。\n\n請點選下方按鈕開始完整的測字流程：'
  }, {
    type: 'template',
    altText: '開始測字',
    template: {
      type: 'buttons',
      text: '使用測字大師',
      actions: [{
        type: 'uri',
        label: '開始測字',
        uri: LIFF_URL
      }]
    }
  }];
  
  replyMessage(replyToken, messages);
}

function replyMessage(replyToken, messages) {
  const url = 'https://api.line.me/v2/bot/message/reply';
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
    },
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: messages
    }),
    muteHttpExceptions: true
  };
  
  UrlFetchApp.fetch(url, options);
}

// ====== LIFF API 處理 ======

function handleLiffRequest(data) {
  const { action, userId, displayName, referrerId, question, imageBase64 } = data;
  
  switch (action) {
    case 'checkUser':
      // 檢查或建立用戶
      const user = getOrCreateUser(userId, displayName, referrerId);
      // 如果是新用戶且有邀請人，標記邀請成功
      return createJsonResponse({ success: true, user: user });
      
    case 'interpret':
      // 執行測字（會扣除額度）
      if (!question || !imageBase64) {
        return createJsonResponse({ success: false, error: '請提供問題和圖片' });
      }
      
      // 先檢查額度
      const creditResult = useCredit(userId);
      if (!creditResult.success) {
        return createJsonResponse({ success: false, error: creditResult.error, credits: 0, needCredits: true });
      }
      
      const interpretation = callGeminiVision(question, imageBase64);
      return createJsonResponse({ 
        success: true, 
        interpretation: interpretation,
        credits: creditResult.credits
      });
      
    case 'completeReading':
      // 完成測字，觸發邀請獎勵
      const userData = getOrCreateUser(userId, displayName, '');
      if (userData.isNew && userData.referredBy) {
        // 新用戶完成首次測字，給邀請人加額度
        addCreditToReferrer(userData.referredBy);
      }
      return createJsonResponse({ success: true });
      
    case 'joinWaitlist':
      // 加入付費等候名單
      const waitlistResult = joinPaidWaitlist(userId);
      return createJsonResponse(waitlistResult);
      
    case 'getCredits':
      // 取得剩餘額度
      const creditsResult = getUserCredits(userId);
      return createJsonResponse({ success: true, credits: creditsResult.credits });
      
    case 'uploadTempImage':
      // 上傳暫存圖片
      if (!imageBase64) {
        return createJsonResponse({ success: false, error: '請提供圖片' });
      }
      const uploadResult = saveTempImage(imageBase64);
      return createJsonResponse(uploadResult);
      
    default:
      // 舊版 API 相容：直接執行測字（不扣額度，給測試用）
      if (question && imageBase64) {
        const result = callGeminiVision(question, imageBase64);
        return createJsonResponse({ success: true, interpretation: result });
      }
      return createJsonResponse({ success: false, error: '未知的動作' });
  }
}

function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ====== API 端點（前端呼叫）======

/**
 * 執行拆字解讀
 * @param {string} question - 使用者問題
 * @param {string} imageBase64 - 圖片 base64
 * @returns {Object} - 解讀結果
 */
function interpret(question, imageBase64) {
  try {
    if (!question || !imageBase64) {
      return { success: false, error: '請提供問題和圖片' };
    }
    
    const interpretation = callGeminiVision(question, imageBase64);
    return { success: true, interpretation: interpretation };
    
  } catch (error) {
    console.error('Error:', error);
    return { success: false, error: error.message };
  }
}

// ====== Gemini API ======

function callGeminiVision(question, imageBase64) {
  const prompt = buildPrompt(question);
  
  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: 'image/png', data: imageBase64 } }
      ]
    }],
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 2048
    }
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = UrlFetchApp.fetch(url, options);
  const result = JSON.parse(response.getContentText());
  
  if (result.error) {
    throw new Error(result.error.message || 'Gemini API 錯誤');
  }
  
  if (!result.candidates || result.candidates.length === 0) {
    throw new Error('AI 沒有回應，請重試');
  }
  
  return result.candidates[0].content.parts[0].text;
}

function buildPrompt(question) {
  return `你是一位精通拆字占卜的大師，擁有深厚的中華文化底蘊。

【使用者的問題】
${question}

【重要說明】
使用者已被要求只寫「一個字」，請辨識圖片中的那個字。如果看起來像多個字，請選擇最完整或最明顯的那一個字來解讀。

請分析這張手寫圖片，並針對使用者的問題進行拆字解讀：

1. **辨識文字**：使用者寫的是什麼字？（請只辨識一個字）

2. **拆字分析**：
   - 將這個字拆解成部首和部件
   - 說明每個部件的象形意義和象徵
   - 可運用「加字法、減字法、換字法」延伸解讀

3. **針對問題的解讀**：
   - 這個字如何回應使用者的問題「${question}」
   - 給出具體的指引和建議
   - 提醒使用者需要注意的事項

請用繁體中文回答，語氣要神秘且有智慧感，像一位睿智的占卜大師。
使用 Markdown 格式輸出，使用 ### 作為標題。`;
}

// ====== 設定 API Key ======
function setApiKey(key) {
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', key);
  return { success: true };
}

function getApiKeyStatus() {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  return { hasKey: !!key && key !== 'YOUR_GEMINI_API_KEY' };
}
