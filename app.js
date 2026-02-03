/**
 * 測字大師 - LIFF + GAS 版本
 * 前端透過 GAS 後端呼叫 Gemini Vision API
 */

// ====== 設定區 ======
const CONFIG = {
    // LIFF ID（部署後填入）
    LIFF_ID: 'YOUR_LIFF_ID',
    // GAS 後端 URL（部署後填入）
    GAS_URL: 'YOUR_GAS_DEPLOYMENT_URL',
    // 是否啟用 LIFF（設為 false 可在一般瀏覽器測試）
    USE_LIFF: false
};

// ====== State Management ======
const state = {
    userQuestion: '',
    hasDrawing: false,
    liffInitialized: false,
    userProfile: null
};

// ====== DOM Elements ======
const elements = {
    stepQuestion: document.getElementById('step-question'),
    stepDraw: document.getElementById('step-draw'),
    stepResult: document.getElementById('step-result'),
    questionInput: document.getElementById('user-question'),
    btnToDraw: document.getElementById('btn-to-draw'),
    canvas: document.getElementById('drawing-canvas'),
    canvasContainer: document.querySelector('.canvas-container'),
    btnClear: document.getElementById('btn-clear'),
    btnInterpret: document.getElementById('btn-interpret'),
    btnBackQuestion: document.getElementById('btn-back-question'),
    drawnImage: document.getElementById('drawn-image'),
    recapQuestion: document.getElementById('recap-question'),
    loadingEl: document.getElementById('interpretation-loading'),
    contentEl: document.getElementById('interpretation-content'),
    btnShare: document.getElementById('btn-share'),
    btnRestart: document.getElementById('btn-restart')
};

// ====== Canvas Setup ======
let ctx;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

function initCanvas() {
    const canvas = elements.canvas;
    const container = elements.canvasContainer;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#1a1025';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
}

function getCanvasPosition(e) {
    const rect = elements.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function startDrawing(e) {
    isDrawing = true;
    const pos = getCanvasPosition(e);
    lastX = pos.x;
    lastY = pos.y;
}

function draw(e) {
    if (!isDrawing) return;
    const pos = getCanvasPosition(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastX = pos.x;
    lastY = pos.y;
    markHasDrawing();
}

function stopDrawing() { isDrawing = false; }

function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    startDrawing({ clientX: touch.clientX, clientY: touch.clientY });
}

function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    draw({ clientX: touch.clientX, clientY: touch.clientY });
}

function markHasDrawing() {
    if (!state.hasDrawing) {
        state.hasDrawing = true;
        elements.canvasContainer.classList.add('has-drawing');
        elements.btnInterpret.disabled = false;
    }
}

function clearCanvas() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, elements.canvas.width, elements.canvas.height);
    state.hasDrawing = false;
    elements.canvasContainer.classList.remove('has-drawing');
    elements.btnInterpret.disabled = true;
}

function getCanvasBase64() {
    // 回傳純 base64（不含 data:image/png;base64, 前綴）
    return elements.canvas.toDataURL('image/png').split(',')[1];
}

// ====== Step Navigation ======
function showStep(stepId) {
    document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
    document.getElementById(stepId).classList.add('active');
    if (stepId === 'step-draw') setTimeout(initCanvas, 100);
}

// ====== Question Step ======
function updateNextButton() {
    elements.btnToDraw.disabled = state.userQuestion.trim().length === 0;
}

elements.questionInput.addEventListener('input', (e) => {
    state.userQuestion = e.target.value;
    updateNextButton();
});

elements.btnToDraw.addEventListener('click', () => showStep('step-draw'));

// ====== Draw Step ======
elements.btnClear.addEventListener('click', clearCanvas);
elements.btnBackQuestion.addEventListener('click', () => showStep('step-question'));
elements.btnInterpret.addEventListener('click', performInterpretation);

// ====== Result Step ======
elements.btnRestart.addEventListener('click', () => {
    state.userQuestion = '';
    state.hasDrawing = false;
    elements.questionInput.value = '';
    elements.btnToDraw.disabled = true;
    showStep('step-question');
});

elements.btnShare.addEventListener('click', shareResult);

// ====== API Integration ======
async function performInterpretation() {
    showStep('step-result');
    elements.loadingEl.style.display = 'block';
    elements.contentEl.style.display = 'none';

    const imageBase64 = getCanvasBase64();
    elements.drawnImage.src = 'data:image/png;base64,' + imageBase64;
    elements.recapQuestion.textContent = state.userQuestion;

    try {
        const response = await callBackend(state.userQuestion, imageBase64);
        displayInterpretation(response.interpretation);
    } catch (error) {
        console.error('API Error:', error);
        displayError(error.message);
    }
}

async function callBackend(question, imageBase64) {
    // 如果 GAS URL 未設定，使用本地測試模式
    if (!CONFIG.GAS_URL || CONFIG.GAS_URL === 'YOUR_GAS_DEPLOYMENT_URL') {
        // 測試模式：模擬回應
        console.warn('GAS URL 未設定，使用測試模式');
        return {
            interpretation: `### 測試模式\n\n請先完成以下設定：\n\n1. 將 \`gas/Code.gs\` 部署到 Google Apps Script\n2. 在 \`app.js\` 的 \`CONFIG.GAS_URL\` 填入部署網址\n\n**您的問題**：${question}\n\n**圖片已收到**（base64 長度：${imageBase64.length}）`
        };
    }

    const response = await fetch(CONFIG.GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, imageBase64 })
    });

    if (!response.ok) {
        throw new Error('後端連線失敗');
    }

    const data = await response.json();
    if (data.error) {
        throw new Error(data.error);
    }

    return data;
}

function displayInterpretation(text) {
    elements.loadingEl.style.display = 'none';
    elements.contentEl.style.display = 'block';

    let html = text
        .replace(/### (.*)/g, '<h3>$1</h3>')
        .replace(/## (.*)/g, '<h3>$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n- /g, '</p><ul><li>')
        .replace(/\n/g, '<br>');

    html = '<p>' + html + '</p>';
    html = html.replace(/<\/p><ul><li>/g, '<ul><li>');
    html = html.replace(/<li>(.*?)<br>/g, '<li>$1</li>');

    elements.contentEl.innerHTML = html;
}

function displayError(message) {
    elements.loadingEl.style.display = 'none';
    elements.contentEl.style.display = 'block';
    elements.contentEl.innerHTML = `
        <div style="text-align: center; color: var(--error);">
            <p>😔 解讀時發生錯誤</p>
            <p style="font-size: 0.9rem; margin-top: 8px;">${message}</p>
            <button onclick="performInterpretation()" class="secondary-btn" style="margin-top: 16px;">重新嘗試</button>
        </div>
    `;
}

// ====== Share (LIFF) ======
async function shareResult() {
    const text = `🔮 測字大師解讀結果\n\n問題：${state.userQuestion}\n\n${elements.contentEl.innerText.substring(0, 300)}...`;

    // 如果在 LIFF 環境中，使用 LIFF 分享
    if (CONFIG.USE_LIFF && state.liffInitialized && liff.isInClient()) {
        try {
            await liff.shareTargetPicker([{
                type: 'text',
                text: text
            }]);
        } catch (error) {
            console.error('LIFF share error:', error);
            fallbackShare(text);
        }
    } else {
        fallbackShare(text);
    }
}

function fallbackShare(text) {
    if (navigator.share) {
        navigator.share({ title: '測字大師', text }).catch(console.error);
    } else {
        navigator.clipboard.writeText(text).then(() => {
            alert('已複製到剪貼簿！');
        }).catch(console.error);
    }
}

// ====== LIFF Initialization ======
async function initLiff() {
    if (!CONFIG.USE_LIFF || CONFIG.LIFF_ID === 'YOUR_LIFF_ID') {
        console.log('LIFF 未啟用或未設定，使用一般模式');
        return;
    }

    try {
        await liff.init({ liffId: CONFIG.LIFF_ID });
        state.liffInitialized = true;
        console.log('LIFF 初始化成功');

        if (liff.isLoggedIn()) {
            state.userProfile = await liff.getProfile();
            console.log('使用者：', state.userProfile.displayName);
        }
    } catch (error) {
        console.error('LIFF 初始化失敗:', error);
    }
}

// ====== Initialize ======
document.addEventListener('DOMContentLoaded', () => {
    initLiff();
});
