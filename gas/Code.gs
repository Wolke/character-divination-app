/**
 * 測字大師 - GAS 網頁應用程式 + LINE Bot Webhook
 * GAS 提供前端網頁 + 呼叫 Gemini Vision API + LINE Bot
 */

// ====== 設定區 ======
const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || 'YOUR_GEMINI_API_KEY';
const LINE_CHANNEL_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN') || 'YOUR_LINE_CHANNEL_ACCESS_TOKEN';
const LIFF_URL = PropertiesService.getScriptProperties().getProperty('LIFF_URL') || 'https://liff.line.me/YOUR_LIFF_ID';

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
  
  if (message.type === 'text') {
    // 使用者發送文字訊息
    const userText = message.text.toLowerCase();
    
    if (userText.includes('測字') || userText.includes('占卜') || userText.includes('算命')) {
      // 引導到 LIFF
      replyWithLiffLink(replyToken);
    } else {
      // 一般訊息：引導使用
      replyWithWelcome(replyToken);
    }
  } else if (message.type === 'image') {
    // 使用者發送圖片：引導到 LIFF（因為需要問題）
    replyWithNeedQuestion(replyToken);
  }
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
        contents: [{
          type: 'button',
          action: {
            type: 'uri',
            label: '開始測字',
            uri: LIFF_URL
          },
          style: 'primary',
          color: '#8b5cf6'
        }],
        backgroundColor: '#0f0a1a',
        paddingAll: '15px'
      }
    }
  }];
  
  replyMessage(replyToken, messages);
}

function replyWithWelcome(replyToken) {
  const messages = [
    {
      type: 'text',
      text: '🔮 歡迎來到測字大師！\n\n我可以透過「拆字」幫您解讀命運與問題。\n\n📝 使用方式：\n輸入「測字」即可開始占卜\n\n💡 小提示：\n誠心發問，答案自現。'
    }
  ];
  
  replyMessage(replyToken, messages);
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
  const { question, imageBase64 } = data;
  
  if (!question || !imageBase64) {
    return createJsonResponse({ success: false, error: '請提供問題和圖片' });
  }
  
  const interpretation = callGeminiVision(question, imageBase64);
  return createJsonResponse({ success: true, interpretation: interpretation });
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
