/**
 * 智慧旅遊規劃 App - 動態腳本序列載入引擎
 * 負責從 GAS 取得模組清單，並依序安全載入至頁面中
 */
(async function() {
    const config = window.APP_CONFIG;
    
    if (!config || !config.GAS_WEB_APP_URL || config.GAS_WEB_APP_URL.includes("YOUR_GAS_WEB_APP_ID_HERE")) {
        console.error("❌ [DynaJS] 尚未設定有效的 GAS_WEB_APP_URL，請檢查 config.js！");
        document.getElementById("app-container").innerHTML = `
            <div class="p-6 bg-red-50 border border-red-200 text-red-700 rounded-xl max-w-lg mx-auto mt-10 text-center">
                <h3 class="font-bold text-lg mb-2">⚠️ 尚未連線至雲端後端</h3>
                <p class="text-sm">請先在 GitHub 的 <code>config.js</code> 中填入你的 Google Apps Script Web App 部署網址。</p>
            </div>
        `;
        return;
    }

    if (config.DEBUG_MODE) {
        console.log("🚀 [DynaJS] 正在向 Google Apps Script 請求前端模組清單...");
    }

    try {
        // 向 GAS 請求腳本清單與內容
        const response = await fetch(`${config.GAS_WEB_APP_URL}?action=getScriptManifest`);
        const result = await response.json();

        if (result.status !== "success" || !result.scripts) {
            throw new Error(result.message || "無法取得有效的 Script Manifest");
        }

        const scripts = result.scripts; // 預期為 [{name: "ScriptCore", code: "..."}, ...]
        
        if (config.DEBUG_MODE) {
            console.log(`📦 [DynaJS] 成功取得 ${scripts.length} 個前端模組，開始依序載入...`);
        }

        // 依序動態載入每個 JS 模組，確保依賴順序不崩潰
        for (const item of scripts) {
            await loadScriptString(item.name, item.code);
        }

        if (config.DEBUG_MODE) {
            console.log("✨ [DynaJS] 所有前端模組載入完畢，正在初始化 App...");
        }

        // 呼叫 GAS 模組初始化進入點
        if (typeof window.initApp === "function") {
            window.initApp();
        } else {
            console.warn("⚠️ [DynaJS] 找不到 window.initApp() 進入點函式。");
        }

    } catch (error) {
        console.error("❌ [DynaJS] 動態載入過程發生錯誤：", error);
        document.getElementById("app-container").innerHTML = `
            <div class="p-6 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl max-w-lg mx-auto mt-10 text-center">
                <h3 class="font-bold text-lg mb-2">⚠️ 雲端模組載入失敗</h3>
                <p class="text-sm">無法順利連線至 Google Apps Script 或解析腳本，請確認 GAS 網址與部署權限設定（須設為任何人皆可存取）。</p>
                <p class="text-xs text-slate-500 mt-2">錯誤訊息: ${error.message}</p>
            </div>
        `;
    }
})();

/**
 * 輔助函式：將字串包裝成 <script> 標籤並插入 DOM 中執行
 */
function loadScriptString(name, codeString) {
    return new Promise((resolve, reject) => {
        try {
            const scriptEl = document.createElement("script");
            scriptEl.type = "text/javascript";
            scriptEl.text = `/* [Module: ${name}] */\n` + codeString;
            document.head.appendChild(scriptEl);
            if (window.APP_CONFIG && window.APP_CONFIG.DEBUG_MODE) {
                console.log(`  ✔ 已載入模組: ${name}`);
            }
            resolve();
        } catch (err) {
            console.error(`  ✖ 載入模組失敗: ${name}`, err);
            reject(err);
        }
    });
}