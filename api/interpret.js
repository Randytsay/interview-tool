// 檔案路徑: /api/interpret.js (新版 - 適用於 OpenRouter)

export default async function handler(request, response) {
  // 安全性檢查：只允許 POST 請求
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Only POST requests are allowed' });
  }

  // 從前端傳來的請求中，讀取 prompt 內容
  const { prompt } = request.body;
  if (!prompt) {
    return response.status(400).json({ message: 'Prompt is required in the request body' });
  }

  // --- 修改開始 (1/4): 改為讀取 OpenRouter 的金鑰 ---
  const API_KEY = process.env.OPENROUTER_API_KEY;
  if (!API_KEY) {
    // 如果 Vercel 環境變數沒設定，提前回傳錯誤，方便除錯
    return response.status(500).json({ message: 'OPENROUTER_API_KEY is not set on the server.' });
  }

  // --- 修改開始 (2/4): 更新 API 網址 ---
  const API_URL = "https://openrouter.ai/api/v1/chat/completions";

  try {
    // 代替前端，由我們的後端伺服器去呼叫 OpenRouter API
    const openRouterResponse = await fetch(API_URL, {
      method: 'POST',
      // --- 修改開始 (3/4): 更新 Headers 和 Body ---
      headers: {
        'Content-Type': 'application/json',
        // OpenRouter 使用 Bearer Token 進行驗證
        'Authorization': `Bearer ${API_KEY}`,
        // 以下為 OpenRouter 建議的選填標頭，有助於他們進行排名和追蹤
        // 請將 YOUR_SITE_URL 和 YOUR_SITE_NAME 換成您自己的資訊
        'HTTP-Referer': 'https://your-project-name.vercel.app', // 例如: https://interview-tool.vercel.app
        'X-Title': '工作的理想與現實', // 您的網站標題
      },
      body: JSON.stringify({
        // 指定您想使用的模型
        "model": "deepseek/deepseek-r1-0528:free", 
        // 訊息格式改為 OpenRouter/OpenAI 的標準格式
        "messages": [
          { "role": "user", "content": prompt }
        ]
      }),
      // --- 修改結束 (3/4) ---
    });

    if (!openRouterResponse.ok) {
      const errorText = await openRouterResponse.text();
      // 拋出更詳細的錯誤，方便除錯
      throw new Error(`OpenRouter API Error (${openRouterResponse.status}): ${errorText}`);
    }

    const result = await openRouterResponse.json();

    // --- 修改開始 (4/4): 更新解析回傳結果的方式 ---
    let aiText = "抱歉，AI 回應的格式有誤或為空，暫時無法解析。";
    // 使用可選串連 (Optional Chaining `?.`) 來安全地存取深層物件
    const messageContent = result?.choices?.[0]?.message?.content;
    if (messageContent) {
       aiText = messageContent.trim();
    }
    // --- 修改結束 (4/4) ---
    
    // 成功後，將 AI 的文字回傳給前端
    response.status(200).json({ text: aiText });

  } catch (error) {
    // 如果過程中發生任何錯誤，記錄錯誤並回傳一個伺服器錯誤的訊息給前端
    console.error('Error in interpret function:', error);
    response.status(500).json({ message: `An internal server error occurred: ${error.message}` });
  }
}
