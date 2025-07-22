// 檔案路徑: /api/interpret.js

export default async function handler(request, response) {
  // 安全性檢查：只允許 POST 請求
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Only POST requests are allowed' });
  }

  // 從前端傳來的請求中，讀取 prompt 內容
  const { prompt } = request.body;

  // 如果 prompt 不存在，回傳錯誤訊息
  if (!prompt) {
    return response.status(400).json({ message: 'Prompt is required in the request body' });
  }

  // 這是最關鍵的一步：從伺服器的「環境變數」中安全地讀取 API 金鑰
  // 這樣金鑰就完全不會暴露在前端程式碼中
  const API_KEY = process.env.GEMINI_API_KEY;
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`;

  try {
    // 代替前端，由我們的後端伺服器去呼叫真正的 Google Gemini API
    const geminiResponse = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    // 如果 Google API 回傳錯誤，將錯誤訊息拋出
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      throw new Error(`Gemini API Error: ${errorText}`);
    }

    const result = await geminiResponse.json();
    
    // 從 Google 的回覆中，取出 AI 生成的文字
    // 加上 try-catch 避免因為回覆格式問題導致伺服器崩潰
    let aiText = "抱歉，AI 回應的格式有誤，暫時無法解析。";
    if (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts[0]) {
       aiText = result.candidates[0].content.parts[0].text;
    }
    
    // 成功後，將 AI 的文字回傳給前端
    response.status(200).json({ text: aiText });

  } catch (error) {
    // 如果過程中發生任何錯誤，記錄錯誤並回傳一個伺服器錯誤的訊息給前端
    console.error('Error in interpret function:', error);
    response.status(500).json({ message: 'An internal server error occurred.' });
  }
}