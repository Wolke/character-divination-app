# LIFF 版本設定指南

## 步驟 1：建立 LINE Login Channel

1. 前往 [LINE Developers Console](https://developers.line.biz/console/)
2. 選擇或建立一個 Provider
3. 建立新的 **LINE Login** Channel
4. 填寫基本資料後建立

## 步驟 2：建立 LIFF App

1. 在 LINE Login Channel 中，點選「LIFF」→「Add」
2. 設定：
   - **LIFF app name**: `測字大師`
   - **Size**: `Full`
   - **Endpoint URL**: 你的 GitHub Pages 網址（見步驟 4）
   - **Scope**: 勾選 `profile`
   - **Bot link feature**: `Off`
3. 建立後複製 **LIFF ID**

## 步驟 3：更新 LIFF ID

編輯 `liff/index.html`，找到 CONFIG 區段：

```javascript
const CONFIG = {
  LIFF_ID: 'YOUR_LIFF_ID', // 替換成你的 LIFF ID
  GAS_URL: 'https://script.google.com/macros/s/..../exec'
};
```

將 `YOUR_LIFF_ID` 替換成實際的 LIFF ID。

## 步驟 4：部署到 GitHub Pages

```bash
# 推送更新
git add .
git commit -m "feat: add LIFF version"
git push

# 啟用 GitHub Pages
# 前往 GitHub Repo → Settings → Pages
# Source: Deploy from a branch
# Branch: master, /liff
# 儲存後等待部署
```

GitHub Pages URL: `https://wolke.github.io/character-divination-app/liff/`

## 步驟 5：更新 LIFF Endpoint URL

回到 LINE Developers Console，將 LIFF 的 Endpoint URL 更新為：
```
https://wolke.github.io/character-divination-app/liff/
```

## 步驟 6：更新 GAS 並重新部署

```bash
cd gas
clasp push --force
clasp deploy --description "v1.2 - LIFF support"
```

## 步驟 7：測試

在手機 LINE 中開啟：
```
https://liff.line.me/YOUR_LIFF_ID
```

或將此連結分享給朋友測試！

---

## 檔案結構

```
character-divination-app/
├── gas/                  # GAS 後端（獨立部署）
│   ├── Code.gs
│   ├── Index.html
│   └── appsscript.json
├── liff/                 # LIFF 前端（GitHub Pages）
│   └── index.html
├── assets/               # 圖片素材
└── README.md
```
