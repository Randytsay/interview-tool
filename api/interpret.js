// 檔案路徑: /api/interpret.js (新版 - 支援多組 Google 金鑰備援)

// Helper Function 1: 呼叫 Google Gemini API (此函式保持不變)
async function callGoogleApi(prompt, apiKey) {
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google API Error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const messageContent = result?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!messageContent) {
    throw new Error("Google API response format is invalid or empty.");
  }
  return messageContent.trim();
}

// Helper Function 2: 呼叫 OpenRouter API (此函式保持不變)
async function callOpenRouterApi(prompt, apiKey) {
  const API_URL = "https://openrouter.ai/api/v1/chat/completions";
  
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.VERCEL_URL || 'http://localhost:3000',
      'X-Title': encodeURIComponent('工作的理想與現實'),
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat-v3-0324:free",
      messages: [{ "role": "user", "content": prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API Error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const messageContent = result?.choices?.[0]?.message?.content;

  if (!messageContent) {
    throw new Error("OpenRouter API response format is invalid or empty.");
  }
  return messageContent.trim();
}

// --- 新增：一個專門嘗試所有 Google 金鑰的函式 ---
async function tryGoogleKeysInSequence(prompt, keys) {
  let lastError = null;
  // 使用 for...of 迴圈依序嘗試陣列中的每一個金鑰
  for (const [index, key] of keys.entries()) {
    try {
      console.log(`Attempting Google API with Key #${index + 1}...`);
      // 呼叫 Google API，如果成功，立刻回傳結果並結束函式
      const result = await callGoogleApi(prompt, key);
      console.log(`Google API call with Key #${index + 1} successful.`);
      return result;
    } catch (error) {
      // 如果失敗，記錄錯誤訊息，然後迴圈會繼續嘗試下一個金鑰
      lastError = error;
      console.warn(`Google API with Key #${index + 1} failed:`, error.message);
    }
  }
  // 如果迴圈跑完所有金鑰都失敗了，就拋出最後一次的錯誤
  throw new Error(`All Google API keys failed. Last error: ${lastError.message}`);
}


// --- 主處理函式 (Main Handler) ---
export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Only POST requests are allowed' });
  }

  const { prompt } = request.body;
  if (!prompt) {
    return response.status(400).json({ message: 'Prompt is required' });
  }

  // --- 讀取所有金鑰，並將 Google 金鑰放入一個陣列中 ---
  const googleKeys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    // 如果未來有第3把，加在這裡 -> process.env.GEMINI_API_KEY_3,
  ].filter(key => key); // .filter(key => key) 會過濾掉未設定的 (undefined) 金鑰

  const openRouterApiKey = process.env.OPENROUTER_API_KEY;

  try {
    // Plan A: 依序嘗試所有 Google 金鑰
    if (googleKeys.length === 0) throw new Error("No Google API keys are set.");
    
    const aiText = await tryGoogleKeysInSequence(prompt, googleKeys);
    return response.status(200).json({ text: aiText });

  } catch (googleError) {
    // 如果所有 Google 金鑰都失敗了，執行 Plan B
    console.warn("All Google API keys failed. Fallback to OpenRouter API (Plan B)...");

    try {
      // Plan B: 嘗試 OpenRouter API
      if (!openRouterApiKey) throw new Error("OPENROUTER_API_KEY is not set.");
      
      const aiText = await callOpenRouterApi(prompt, openRouterApiKey);
      console.log("OpenRouter API call successful.");
      return response.status(200).json({ text: aiText });

    } catch (openRouterError) {
      // 如果 Plan B 也失敗，回傳最終的錯誤訊息
      console.error("OpenRouter API (Plan B) also failed:", openRouterError.message);
      return response.status(500).json({
        message: "All primary and fallback AI services failed.",
        error: {
          google: googleError.message,
          openrouter: openRouterError.message,
        },
      });
    }
  }
}
