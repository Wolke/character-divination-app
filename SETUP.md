# 測字大師 LINE Bot + LIFF 部署指南

## 步驟一：部署 GAS 後端

1. 前往 [Google Apps Script](https://script.google.com/)
2. 建立新專案
3. 將 `gas/Code.gs` 的內容貼入
4. 修改 `GEMINI_API_KEY` 為你的 API Key
5. 點選「部署」→「新增部署作業」
6. 選擇「網頁應用程式」
7. 設定：
   - 執行身分：我
   - 誰可以存取：所有人
8. 點選「部署」→ 複製網址

---

## 步驟二：設定前端

編輯 `app.js`，修改 CONFIG：

```javascript
const CONFIG = {
    LIFF_ID: 'YOUR_LIFF_ID',           // 步驟三取得
    GAS_URL: 'https://script.google.com/...', // 步驟一取得
    USE_LIFF: true
};
```

---

## 步驟三：部署前端

### 方法 A：GitHub Pages
1. 將專案推到 GitHub
2. Settings → Pages → 選擇分支
3. 取得網址：`https://username.github.io/repo/`

### 方法 B：Vercel
1. 連結 GitHub repo
2. 自動部署
3. 取得網址

---

## 步驟四：設定 LINE LIFF

1. 前往 [LINE Developers Console](https://developers.line.biz/)
2. 建立 Provider（如果沒有）
3. 建立 LINE Login Channel
4. 進入「LIFF」頁籤
5. 新增 LIFF App：
   - Size: Full
   - Endpoint URL: 你的前端網址
   - Scope: ✓ openid
6. 複製 LIFF ID，貼回 `app.js` 的 `CONFIG.LIFF_ID`

---

## 步驟五：測試

### LIFF 連結格式
```
https://liff.line.me/YOUR_LIFF_ID
```

1. 在 LINE 中開啟此連結
2. 輸入問題、手寫一個字
3. 點「開始解讀」
4. 測試「分享結果」

---

## 檔案結構

```
volatile-belt/
├── index.html      # 前端頁面
├── style.css       # 樣式
├── app.js          # 前端邏輯（LIFF + GAS）
└── gas/
    └── Code.gs     # GAS 後端程式碼
```

---

## 取得 API Keys

- **Gemini API Key**: https://aistudio.google.com/app/apikey
- **LINE LIFF ID**: LINE Developers Console
