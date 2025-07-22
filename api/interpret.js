// 檔案路徑: /api/interpret.js (最終版 - 更新為 gemini-2.0-flash)

// Helper Function 1: 呼叫 Google Gemini API
async function callGoogleApi(prompt, apiKey) {
  // --- 唯一的修改點在這裡 ---
  // 根據您提供的最新資訊，更新 Google API 網址
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

// Helper Function 2: 呼叫 OpenRouter API (此函式無需變動)
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


// --- 主處理函式 (Main Handler) (此函式無需變動) ---
export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Only POST requests are allowed' });
  }

  const { prompt } = request.body;
  if (!prompt) {
    return response.status(400).json({ message: 'Prompt is required' });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;

  // --- 備援邏輯開始 ---
  try {
    // Plan A: 優先嘗試 Google Gemini API
    console.log("Attempting to call Google Gemini API (Plan A)...");
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY is not set.");
    
    const aiText = await callGoogleApi(prompt, geminiApiKey);
    console.log("Google Gemini API call successful.");
    return response.status(200).json({ text: aiText });

  } catch (googleError) {
    // 如果 Plan A 失敗，在日誌中記錄錯誤，然後執行 Plan B
    console.warn("Google Gemini API (Plan A) failed:", googleError.message);
    console.log("Fallback to OpenRouter API (Plan B)...");

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
        message: "Both primary and fallback AI services failed.",
        error: {
          google: googleError.message,
          openrouter: openRouterError.message,
        },
      });
    }
  }
}
