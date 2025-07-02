// Manifest V3 service worker (module): importScripts() is NOT supported. Use ES module imports instead.
// importScripts("https://unpkg.com/tesseract.js@v2.1.0/dist/tesseract.min.js") // <-- REMOVE THIS LINE
// If you need Tesseract, use dynamic import:
// import('https://unpkg.com/tesseract.js@v2.1.0/dist/tesseract.min.js').then(Tesseract => { /* use Tesseract */ });

// Global variables
let apiProvider = "openai"
let openaiKey = ""
let openaiModel = "gpt-4-0125-preview"  // Updated to a valid model name
let geminiKey = ""
let geminiModel = "gemini-pro"
let deepseekKey = ""
let deepseekModel = "deepseek-chat"
let promptTemplate = ""

// Initialize settings
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(
    [
      "apiProvider",
      "openaiKey",
      "openaiModel",
      "geminiKey",
      "geminiModel",
      "deepseekKey",
      "deepseekModel",
      "promptTemplate",
    ],
    (result) => {
      apiProvider = result.apiProvider || "openai"
      openaiKey = result.openaiKey || ""
      openaiModel = result.openaiModel || "gpt-4-0125-preview"  // Updated to a valid model name
      geminiKey = result.geminiKey || ""
      geminiModel = result.geminiModel || "gemini-pro"
      deepseekKey = result.deepseekKey || ""
      deepseekModel = result.deepseekModel || "deepseek-chat"
      promptTemplate = result.promptTemplate || ""
    },
  )
})

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "captureTabScreenshot") {
    try {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        console.log("[captureTabScreenshot] Queried tabs:", tabs);
        console.log("[captureTabScreenshot] Sender:", sender);
        console.log("[captureTabScreenshot] Message:", message);
        if (!tabs || !tabs[0]) {
          console.error("[captureTabScreenshot] No active tab found. Tabs:", tabs);
          sendResponse({ success: false, error: "No active tab found" });
          return;
        }
        chrome.tabs.captureVisibleTab(
          tabs[0].windowId,
          { format: "png" },
          function(dataUrl) {
            if (chrome.runtime.lastError) {
              console.error("[captureTabScreenshot] captureVisibleTab error:", chrome.runtime.lastError.message, "Tabs:", tabs, "Sender:", sender, "Message:", message);
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
              return;
            }
            if (!dataUrl) {
              console.error("[captureTabScreenshot] No image data received from capture. Tabs:", tabs, "Sender:", sender, "Message:", message);
              sendResponse({ success: false, error: "No image data received from capture" });
              return;
            }
            console.log("[captureTabScreenshot] Capture successful. DataUrl length:", dataUrl.length);
            sendResponse({ success: true, dataUrl: dataUrl });
          }
        );
      });
      return true; // async
    } catch (error) {
      console.error("[captureTabScreenshot] Exception:", error, "Sender:", sender, "Message:", message);
      sendResponse({ success: false, error: error.message });
      return true;
    }
  }

  // --- Robust handler for 'performOCR' ---
  if (message.action === "performOCR") {
    (async () => {
      try {
        console.log("[BG] Received performOCR:", message);
        const { imageData, language } = message;
        if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image')) {
          sendResponse({ success: false, error: 'Invalid image data for OCR.' });
          return;
        }
        // Fallback: Use backend OCR API
        try {
          const response = await fetch('http://localhost:5000/api/ocr-detect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_data: imageData, language: language || 'eng' })
          });
          const data = await response.json();
          console.log('[BG] Backend OCR response:', data);
          if (data.success) {
            sendResponse({ success: true, text: data.text || '', mcqs: data.mcqs || [] });
          } else {
            sendResponse({ success: false, error: data.error || 'Backend OCR failed.' });
          }
        } catch (err) {
          console.error('[BG] Backend OCR error:', err);
          sendResponse({ success: false, error: err.message || String(err) });
        }
      } catch (err) {
        console.error('[BG] Error in performOCR handler:', err);
        sendResponse({ success: false, error: err.message || String(err) });
      }
    })();
    return true; // async
  }

  // --- Robust handler for 'predictAnswer' ---
  if (message.action === "predictAnswer") {
    (async () => {
      try {
        console.log("[BG] Received predictAnswer:", message);
        const { question, options, imageData } = message;
        let result = { success: false, error: "No AI provider configured" };
        if (!question || !options || !Array.isArray(options) || options.length === 0) {
          result = { success: false, error: "Missing question or options" };
        } else {
          // Use the main predictAnswer function (already defined in this file)
          result = await predictAnswer(question, options, imageData);
        }
        if (!result || typeof result !== "object") {
          sendResponse({ success: false, error: "AI returned no result" });
        } else {
          sendResponse(result);
        }
      } catch (err) {
        console.error("[BG] Error in predictAnswer handler:", err);
        sendResponse({ success: false, error: err.message || String(err) });
      }
    })();
    return true; // async
  }

  // Always respond for unhandled actions to close the port
  sendResponse({});
})

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "sync") {
    if (changes.apiProvider) {
      apiProvider = changes.apiProvider.newValue
    }
    if (changes.openaiKey) {
      openaiKey = changes.openaiKey.newValue
    }
    if (changes.openaiModel) {
      openaiModel = changes.openaiModel.newValue
    }
    if (changes.geminiKey) {
      geminiKey = changes.geminiKey.newValue
    }
    if (changes.geminiModel) {
      geminiModel = changes.geminiModel.newValue
    }
    if (changes.deepseekKey) {
      deepseekKey = changes.deepseekKey.newValue
    }
    if (changes.deepseekModel) {
      deepseekModel = changes.deepseekModel.newValue
    }
    if (changes.promptTemplate) {
      promptTemplate = changes.promptTemplate.newValue
    }
  }
})

// Test API connection
async function testApiConnection(provider, key, model) {
  try {
    switch (provider) {
      case "openai":
        return await testOpenAI(key, model)
      case "gemini":
        return await testGemini(key, model)
      case "deepseek":
        return await testDeepSeek(key, model)
      case "auto":
        // Test all configured APIs
        const results = []

        if (key || openaiKey) {
          const openaiResult = await testOpenAI(key || openaiKey, model || openaiModel)
          results.push({ provider: "openai", result: openaiResult })
        }

        if (geminiKey) {
          const geminiResult = await testGemini(geminiKey, geminiModel)
          results.push({ provider: "gemini", result: geminiResult })
        }

        if (deepseekKey) {
          const deepseekResult = await testDeepSeek(deepseekKey, deepseekModel)
          results.push({ provider: "deepseek", result: deepseekResult })
        }

        // If at least one API is working, return success
        const workingApis = results.filter((r) => r.result.success)
        if (workingApis.length > 0) {
          return {
            success: true,
            message: `${workingApis.length} of ${results.length} APIs are working.`,
            workingApis: workingApis.map((r) => r.provider),
          }
        } else {
          return {
            success: false,
            error: "No APIs are working. Please check your API keys and settings.",
          }
        }
      default:
        return { success: false, error: "Unsupported API provider" }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Test OpenAI API
async function testOpenAI(key, model) {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: "Hello, are you working?" }],
        max_tokens: 10,
      }),
    })

    const data = await response.json()

    if (response.ok) {
      return { success: true }
    } else {
      return { success: false, error: data.error?.message || "Unknown error" }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Test Gemini API
async function testGemini(key, model) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Hello, are you working?" }] }],
        }),
      },
    )

    const data = await response.json()

    if (response.ok) {
      return { success: true }
    } else {
      return { success: false, error: data.error?.message || "Unknown error" }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Test DeepSeek API
async function testDeepSeek(key, model) {
  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: "Hello, are you working?" }],
        max_tokens: 10,
      }),
    })

    const data = await response.json()

    if (response.ok) {
      return { success: true }
    } else {
      return { success: false, error: data.error?.message || "Unknown error" }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Predict answer using AI
async function predictAnswer(question, options, imageData = null) {
  try {
    // Get current settings
    const settings = await new Promise((resolve) => {
      chrome.storage.sync.get(
        [
          "apiProvider",
          "openaiKey",
          "openaiModel",
          "geminiKey",
          "geminiModel",
          "deepseekKey",
          "deepseekModel",
          "promptTemplate",
        ],
        resolve,
      )
    })

    const provider = settings.apiProvider || apiProvider
    const template = settings.promptTemplate || promptTemplate

    // If auto mode, try all configured APIs in sequence
    if (provider === "auto") {
      // Try OpenAI first if configured
      if (settings.openaiKey) {
        try {
          const result = await predictWithOpenAI(question, options, settings.openaiKey, settings.openaiModel, template)
          if (result.success) {
            return { ...result, provider: "openai" }
          }
        } catch (error) {
          console.error("OpenAI prediction failed:", error)
        }
      }

      // Try Gemini next if configured
      if (settings.geminiKey) {
        try {
          const result = await predictWithGemini(
            question,
            options,
            settings.geminiKey,
            settings.geminiModel,
            template,
            imageData,
          )
          if (result.success) {
            return { ...result, provider: "gemini" }
          }
        } catch (error) {
          console.error("Gemini prediction failed:", error)
        }
      }

      // Try DeepSeek last if configured
      if (settings.deepseekKey) {
        try {
          const result = await predictWithDeepSeek(
            question,
            options,
            settings.deepseekKey,
            settings.deepseekModel,
            template,
          )
          if (result.success) {
            return { ...result, provider: "deepseek" }
          }
        } catch (error) {
          console.error("DeepSeek prediction failed:", error)
        }
      }

      // If all APIs failed, return error
      return { success: false, error: "All configured AI providers failed to generate an answer." }
    } else {
      // Use the specified provider
      switch (provider) {
        case "openai":
          if (!settings.openaiKey) {
            return { success: false, error: "OpenAI API key not configured" }
          }
          return {
            ...(await predictWithOpenAI(question, options, settings.openaiKey, settings.openaiModel, template)),
            provider: "openai",
          }
        case "gemini":
          if (!settings.geminiKey) {
            return { success: false, error: "Gemini API key not configured" }
          }
          return {
            ...(await predictWithGemini(
              question,
              options,
              settings.geminiKey,
              settings.geminiModel,
              template,
              imageData,
            )),
            provider: "gemini",
          }
        case "deepseek":
          if (!settings.deepseekKey) {
            return { success: false, error: "DeepSeek API key not configured" }
          }
          return {
            ...(await predictWithDeepSeek(question, options, settings.deepseekKey, settings.deepseekModel, template)),
            provider: "deepseek",
          }
        default:
          return { success: false, error: "Unsupported API provider" }
      }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Predict with OpenAI
async function predictWithOpenAI(question, options, key, model, customTemplate) {
  try {
    const optionsText = options.map((opt, index) => `${index + 1}. ${opt}`).join("\n")

    // Use custom template if provided, otherwise use default
    let prompt
    if (customTemplate) {
      prompt = customTemplate.replace("{{question}}", question).replace("{{options}}", optionsText)
    } else {
      // Enhanced prompt with clearer instructions
      prompt = `You are a multiple choice question answering assistant. 
      
Question: ${question}

Options:
${optionsText}

Instructions:
1. Analyze the question and options carefully.
2. Select the single most accurate answer.
3. Respond ONLY with the exact text of the correct option, exactly as it appears in the options above.
4. Do not include any other text or explanation in your response.
5. If you're unsure, make your best guess from the given options.
      
Your response should be exactly one of the option texts from above, with no additional characters.`
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 50,
      }),
    })

    const data = await response.json()
    console.log('OpenAI API Response:', data)

    if (response.ok && data.choices && data.choices.length > 0) {
      let answer = data.choices[0].message.content.trim()
      console.log('Raw API response:', answer)
      
      // Clean up the answer
      answer = answer.replace(/^[\"']|[\"']$/g, '').trim()
      
      // Enhanced answer cleaning
      const cleanAnswer = (text) => {
        return text
          .replace(/^[^a-zA-Z0-9\s]|[^a-zA-Z0-9\s]$/g, '') // Remove non-alphanumeric from start/end
          .replace(/^["']|["']$/g, '') // Remove quotes
          .trim()
          .toLowerCase()
      }

      // Clean the answer
      answer = cleanAnswer(answer)
      console.log('Cleaned answer:', answer)

      // 1. Try exact match first (case insensitive)
      let matchingOption = options.find(opt => 
        cleanAnswer(opt) === answer
      )

      // 2. Try matching by option letter (A, B, C, etc.)
      if (!matchingOption && /^[a-z]$/i.test(answer)) {
        const optionIndex = answer.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0)
        if (optionIndex >= 0 && optionIndex < options.length) {
          matchingOption = options[optionIndex]
          console.log('Matched by letter:', answer, '->', matchingOption)
        }
      }

      // 3. Try matching option numbers (1, 2, 3, etc.)
      if (!matchingOption && /^\d+$/.test(answer)) {
        const optionIndex = parseInt(answer, 10) - 1
        if (optionIndex >= 0 && optionIndex < options.length) {
          matchingOption = options[optionIndex]
          console.log('Matched by number:', answer, '->', matchingOption)
        }
      }

      // 4. Try partial matching
      if (!matchingOption) {
        matchingOption = options.find(opt => {
          const optText = cleanAnswer(opt)
          return (
            optText === answer ||
            optText.includes(answer) ||
            answer.includes(optText) ||
            // Handle cases where answer might be a subset with punctuation
            optText.replace(/[^a-z0-9]/g, '').includes(answer.replace(/[^a-z0-9]/g, ''))
          )
        })
      }

      // 5. If still no match, try word-by-word matching
      if (!matchingOption) {
        const words = answer.split(/\s+/).filter(word => word.length > 2)
        for (const word of words) {
          const wordMatch = options.find(opt => {
            const optText = cleanAnswer(opt)
            return optText.includes(word) || word.includes(optText)
          })
          if (wordMatch) {
            matchingOption = wordMatch
            console.log('Matched by word:', word, '->', matchingOption)
            break
          }
        }
      }

      if (matchingOption) {
        console.log('Match found:', matchingOption)
        return { success: true, answer: matchingOption }
      }
      
      // If no match found, try to extract just the letter/number from the answer
      const extractedMatch = answer.match(/\b([a-z]|\d+)\b/i)
      if (extractedMatch) {
        const extracted = extractedMatch[1]
        // Try matching the extracted part
        if (/^[a-z]$/i.test(extracted)) {
          const optionIndex = extracted.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0)
          if (optionIndex >= 0 && optionIndex < options.length) {
            console.log('Extracted letter match:', extracted, '->', options[optionIndex])
            return { success: true, answer: options[optionIndex] }
          }
        } else if (/^\d+$/.test(extracted)) {
          const optionIndex = parseInt(extracted, 10) - 1
          if (optionIndex >= 0 && optionIndex < options.length) {
            console.log('Extracted number match:', extracted, '->', options[optionIndex])
            return { success: true, answer: options[optionIndex] }
          }
        }
      }
      
      // As a last resort, return the first option with a warning
      console.warn('No match found, using first option. Answer was:', answer)
      return { success: true, answer: options[0] }
      
    } else {
      const errorMsg = data.error?.message || "Unknown error"
      console.error('OpenAI API Error:', errorMsg, data)
      return { success: false, error: errorMsg }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Predict with Gemini
async function predictWithGemini(question, options, key, model, customTemplate, imageData = null) {
  try {
    const optionsText = options.map((opt, index) => `${index + 1}. ${opt}`).join("\n")

    // Use custom template if provided, otherwise use default
    let prompt
    if (customTemplate) {
      prompt = customTemplate.replace("{{question}}", question).replace("{{options}}", optionsText)
    } else {
      prompt = `
Question: ${question}

Options:
${optionsText}

Instructions:
1. Analyze the question and options carefully.
2. Select the most accurate answer.
3. Respond ONLY with the letter or number of the correct option, or the exact text of the correct option.
4. If multiple answers are correct, list all correct options separated by commas.
5. Do not explain your reasoning, just provide the answer.
`    }

    // Prepare request body
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 50,
      },
    }

    // If image data is provided and using vision model, add it to the request
    if (imageData && model === "gemini-pro-vision") {
      // Remove data:image/png;base64, prefix if present
      const base64Image = imageData.replace(/^data:image\/\w+;base64,/, "")

      requestBody.contents[0].parts.push({
        inlineData: {
          mimeType: "image/png",
          data: base64Image,
        },
      })
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
    )

    const data = await response.json()

    if (response.ok && data.candidates && data.candidates.length > 0) {
      const answer = data.candidates[0].content.parts[0].text.trim()
      return { success: true, answer }
    } else {
      return { success: false, error: data.error?.message || "Unknown error" }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Predict with DeepSeek
async function predictWithDeepSeek(question, options, key, model, customTemplate) {
  try {
    const optionsText = options.map((opt, index) => `${index + 1}. ${opt}`).join("\n")

    // Use custom template if provided, otherwise use default
    let prompt
    if (customTemplate) {
      prompt = customTemplate.replace("{{question}}", question).replace("{{options}}", optionsText)
    } else {
      prompt = `
Question: ${question}

Options:
${optionsText}

Instructions:
1. Analyze the question and options carefully.
2. Select the most accurate answer.
3. Respond ONLY with the letter or number of the correct option, or the exact text of the correct option.
4. If multiple answers are correct, list all correct options separated by commas.
5. Do not explain your reasoning, just provide the answer.
`    }

    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 50,
      }),
    })

    const data = await response.json()

    if (response.ok && data.choices && data.choices.length > 0) {
      const answer = data.choices[0].message.content.trim()
      return { success: true, answer }
    } else {
      return { success: false, error: data.error?.message || "Unknown error" }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Detect math equations in image
async function detectMathEquation(imageData) {
  try {
    // First use OCR to get the text
    const ocrResult = await performOCR(imageData, "eng", false)

    if (!ocrResult.success) {
      return { success: false, error: ocrResult.error }
    }

    // Check if the text contains math symbols
    const mathSymbols = [
      "+",
      "-",
      "×",
      "÷",
      "=",
      "<",
      ">",
      "≤",
      "≥",
      "≠",
      "∫",
      "∑",
      "∏",
      "√",
      "∞",
      "π",
      "θ",
      "α",
      "β",
      "γ",
      "δ",
    ]
    const containsMathSymbols = mathSymbols.some((symbol) => ocrResult.text.includes(symbol))

    // Check for common math patterns using regex
    const mathPatterns = [
      /\d+\s*[+\-×÷=<>]\s*\d+/, // Basic operations
      /$$\s*\d+\s*[+\-×÷]\s*\d+\s*$$/, // Parentheses
      /\d+\s*\/\s*\d+/, // Fractions
      /\d+\s*\^\s*\d+/, // Exponents
      /sqrt\s*$$\s*\d+\s*$$/, // Square roots
      /\d+\s*\*\s*\d+/, // Multiplication
    ]

    const containsMathPatterns = mathPatterns.some((pattern) => pattern.test(ocrResult.text))

    // If math symbols or patterns are detected, use AI to interpret the equation
    if (containsMathSymbols || containsMathPatterns) {
      // Get current settings for AI
      const settings = await new Promise((resolve) => {
        chrome.storage.sync.get(["apiProvider", "openaiKey", "openaiModel", "geminiKey", "geminiModel"], resolve)
      })

      // Use Gemini Vision if available, otherwise use OpenAI
      if (settings.geminiKey && settings.geminiModel) {
        try {
          // Remove data:image/png;base64, prefix if present
          const base64Image = imageData.replace(/^data:image\/\w+;base64,/, "")

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${settings.geminiKey}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: "This image contains a mathematical equation or expression. Please identify and transcribe it in a format that can be understood by a computer. Use standard notation like * for multiplication, / for division, ^ for exponents, sqrt() for square roots, etc.",
                      },
                      {
                        inlineData: {
                          mimeType: "image/png",
                          data: base64Image,
                        },
                      },
                    ],
                  },
                ],
                generationConfig: {
                  temperature: 0.2,
                  maxOutputTokens: 100,
                },
              }),
            },
          )

          const data = await response.json()

          if (response.ok && data.candidates && data.candidates.length > 0) {
            const mathExpression = data.candidates[0].content.parts[0].text.trim()
            return {
              success: true,
              isMathEquation: true,
              text: ocrResult.text,
              mathExpression: mathExpression,
              confidence: ocrResult.confidence,
            }
          }
        } catch (error) {
          console.error("Error using Gemini for math detection:", error)
        }
      }

      // Fallback to basic detection
      return {
        success: true,
        isMathEquation: true,
        text: ocrResult.text,
        confidence: ocrResult.confidence,
      }
    }

    // Not a math equation
    return {
      success: true,
      isMathEquation: false,
      text: ocrResult.text,
      confidence: ocrResult.confidence,
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// All Tesseract.js dynamic imports and performOCR handler have been removed. OCR is now only handled in the content script or via backend server fallback.

// Helper: Crop image using canvas
function cropImage(base64, rect, callback) {
  const img = new Image();
  img.onload = function() {
    const canvas = new OffscreenCanvas(rect.width, rect.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
    canvas.convertToBlob().then(blob => {
      const reader = new FileReader();
      reader.onloadend = () => callback(reader.result);
      reader.readAsDataURL(blob);
    });
  };
  img.src = base64;
}

// Listen for popup trigger
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "startAutoMCQ") {
    // 1. Ask content script for MCQ rect
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {type: "autoDetectMCQ"}, (resp) => {
        if (!resp || !resp.success) {
          sendResponse({success: false, error: resp ? resp.error : "No response"});
          return;
        }
        // 2. Capture visible tab
        chrome.tabs.captureVisibleTab(null, {format: "png"}, (dataUrl) => {
          // 3. Crop to rect
          cropImage(dataUrl, resp.rect, (croppedBase64) => {
            // 4. Send cropped image to popup for OCR
            sendResponse({success: true, image: croppedBase64, rect: resp.rect});
          });
        });
      });
    });
    return true; // async
  }
});


