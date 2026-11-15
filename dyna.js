/**
 * 動態前端模組載入引擎 (dyna.js)
 * 負責驗證設定檔、向 GAS 取得 CSS 與 JS 清單、依序掛載並精準捕捉任何模組錯誤
 */
(async function() {
  const statusEl = document.getElementById("loading-status-text");
  const containerEl = document.getElementById("app-container");

  function showFatalError(title, detail) {
    console.error("❌ [DynaJS 致命錯誤]", title, detail);
    if (containerEl) {
      containerEl.innerHTML = `
        <div class="max-w-lg mx-auto bg-red-50 border border-red-200 rounded-xl p-6 text-center mt-10">
          <i class="fa-solid fa-triangle-exclamation text-3xl text-red-500 mb-3"></i>
          <h3 class="font-bold text-red-800 text-base mb-1">${title}</h3>
          <p class="text-xs text-red-600 break-all mb-4">${detail}</p>
          <button onclick="location.reload()" class="px-4 py-2 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition">重新整理網頁</button>
        </div>
      `;
    }
  }

  // 1. 驗證全域設定檔
  if (typeof window.APP_CONFIG === "undefined" || !window.APP_CONFIG.GAS_URL) {
    showFatalError("找不到系統設定檔 (APP_CONFIG)", "請確認 config.js 是否存在且正確設定了 GAS_URL。");
    return;
  }

  const gasUrl = window.APP_CONFIG.GAS_URL.trim();
  if (gasUrl.includes("請替換為你的正式部署ID") || !gasUrl.endsWith("/exec")) {
    showFatalError("GAS_URL 設定不正確", "請確認 config.js 中的網址為正式發布的 /exec 結尾網址，而非 /dev 測試網址。");
    return;
  }

  try {
    if (statusEl) statusEl.textContent = "正在向 Google Apps Script 請求介面模組...";
    if (window.APP_CONFIG.DEBUG_MODE) console.log("🚀 [DynaJS] 開始向 GAS 請求前端模組清單...");

    // 加入時間戳避免瀏覽器快取舊版回應
    const manifestUrl = `${gasUrl}?action=getManifest&t=${Date.now()}`;
    const response = await fetch(manifestUrl, {
      method: "GET",
      redirect: "follow"
    });

    if (!response.ok) {
      throw new Error(`HTTP 狀態碼錯誤: ${response.status}`);
    }

    const textData = await response.text();
    let manifest;
    try {
      manifest = JSON.parse(textData);
    } catch (parseErr) {
      throw new Error("後端回傳格式非 JSON（可能是權限未設為「任何人」或 GAS 發生內部錯誤）。回傳開頭：" + textData.substring(0, 100));
    }

    if (manifest.status !== "success") {
      throw new Error(manifest.message || "後端回報未知的清單生成錯誤");
    }

    // 2. 注入共用樣式表 (CSS)
    if (manifest.css) {
      const styleTag = document.createElement("style");
      styleTag.id = "gas-dynamic-styles";
      styleTag.textContent = manifest.css;
      document.head.appendChild(styleTag);
    }

    // 3. 依序載入並執行前端 JS 模組
    const scripts = manifest.scripts || [];
    if (window.APP_CONFIG.DEBUG_MODE) console.log(`📦 [DynaJS] 成功取得 ${scripts.length} 個前端模組，開始依序掛載...`);

    for (let i = 0; i < scripts.length; i++) {
      const mod = scripts[i];
      if (statusEl) statusEl.textContent = `正在載入模組 (${i + 1}/${scripts.length}): ${mod.name}...`;
      
      try {
        const scriptTag = document.createElement("script");
        scriptTag.type = "text/javascript";
        scriptTag.setAttribute("data-module", mod.name);
        // 加上 sourceURL 方便在 DevTools 精準定位除錯行數
        scriptTag.textContent = `${mod.code}\n//# sourceURL=${mod.name}.js`;
        document.body.appendChild(scriptTag);
        if (window.APP_CONFIG.DEBUG_MODE) console.log(`  ✓ 已成功掛載模組: ${mod.name}`);
      } catch (modErr) {
        throw new Error(`模組 [${mod.name}] 執行時發生語法或初始化錯誤: ${modErr.message}`);
      }
    }

    // 4. 啟動應用程式進入點
    if (typeof window.initApp === "function") {
      if (window.APP_CONFIG.DEBUG_MODE) console.log("✨ [DynaJS] 所有模組載入完畢，啟動 window.initApp()...");
      await window.initApp();
    } else {
      throw new Error("所有模組皆已載入，但找不到 window.initApp() 進入點函式（請檢查 ScriptCore.html）。");
    }

  } catch (error) {
    showFatalError("雲端模組載入失敗", error.message);
  }
})();