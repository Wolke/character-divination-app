# 🔮 測字大師 (Character Divination App)

測字大師是一款結合 LINE LIFF、Google Apps Script (GAS) 與 Gemini AI 的線上測字占卜應用。使用者可以在畫布上親手寫下一個字，並針對心中所想的問題，讓 AI 測字大師根據字的寫法、結構與含意，進行獨一無二的拆字解讀。

## ✨ 核心功能
* **手寫互動板：** 支援觸控與滑鼠的 Canvas 手寫字體輸入。
* **專屬智能測字：** 結合 Google Gemini AI，將使用者寫下的特定文字與問題做完整的語意及結構分析。
* **流暢的使用經驗：** 直覺的三步驟流程：輸入問題 ➔ 靜心寫字 ➔ 獲得大師解讀。
* **LINE 深度整合：** 透過 LINE LIFF SDK 整合於 LINE App 內，方便快速分享占卜結果給好友。

## 🛠️ 技術架構
本專案採用輕量級的雲端無伺服器架構：
* **前端介面 (Frontend)：** HTML5, CSS3, JavaScript (Vanilla JS)
  * 利用 HTML5 Canvas 實現手寫板機制。
  * 整合 LINE LIFF SDK 以獲取用戶情境，提供無縫的 LINE 內部體驗。
* **後端服務 (Backend)：** Google Apps Script (GAS)
  * 擔任前端與外部 AI API 的中介橋樑 (Web App)。
  * 提供穩定的 API 接收測字請求並回傳結果。
* **AI 核心模組：** Google Gemini API
  * 分析圖片中的字跡以及回答測字占卜提問。

## 📂 專案資料夾結構

```text
character-divination-app/
├── index.html      # 主前端頁面，實作三階段呈現流程
├── style.css       # 前端樣式，包含 RWD 及基礎動效設計
├── app.js          # 前端核心邏輯 (Canvas 控制、LIFF 登入、GAS API 請求)
├── SETUP.md        # 專案部署詳細圖文指南
├── gas/            # Google Apps Script 後端程式碼
│   ├── Code.gs     # 後端主邏輯，負責呼叫 Gemini 和回應給前端
│   ├── Index.html  # GAS Web App 自訂網頁 (備用/管理介面)
│   ├── appsscript.json # GAS 專案權限與環境配置檔
│   └── .clasp.json # Clasp CLI 專用設定檔
├── liff/           # LIFF 單一網頁應用版本 (進階實作參考)
│   ├── index.html  # 打包好的另一個前端單一檔案
│   ├── SETUP.md    # LIFF 特別版部署指南
│   └── og-image.png # 分享時使用的縮圖
└── assets/         # 其他圖片或其他靜態資源
```

## 🚀 部署與執行
本專案的安裝與部署有詳細獨立的指導文件，包含設定 LINE Channel、GAS Web App 以及取得 Gemini API Key 等步驟。

請參考：👉 **[部署指南 (SETUP.md)](./SETUP.md)**

## 💡 使用流程
1. 在行動裝置的 LINE 內部開啟部屬好的 **LIFF 連結**。
2. 於首頁文字框中輸入**您的問題**（例如：今年換工作好嗎？）。
3. 進入第二步，在畫板中用心寫出**一個字**。
4. 點擊「開始解讀」，系統將自動送出文字圖片至 AI，數秒後即可獲得專屬的測字回覆與分享按鈕！
