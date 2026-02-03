/**
 * 測字大師 - GAS 網頁應用程式
 * GAS 提供前端網頁 + 呼叫 Gemini Vision API
 */

// ====== 設定區 ======
const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || 'YOUR_GEMINI_API_KEY';

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
