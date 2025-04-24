// Import Tesseract.js for OCR
importScripts("https://unpkg.com/tesseract.js@v2.1.0/dist/tesseract.min.js")

// Global variables
let apiProvider = "openai"
let openaiKey = ""
let openaiModel = "gpt-4o"
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
      openaiModel = result.openaiModel || "gpt-4o"
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
  if (message.action === "testApiConnection") {
    testApiConnection(message.provider, message.apiKey, message.model)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true // Indicates async response
  }

  if (message.action === "predictAnswer") {
    predictAnswer(message.question, message.options, message.imageData)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true // Indicates async response
  }

  if (message.action === "performOCR") {
    performOCR(message.imageData, message.language, message.detectBounds)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true // Indicates async response
  }

  if (message.action === "detectMathEquation") {
    detectMathEquation(message.imageData)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true // Indicates async response
  }
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
`
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
`
    }

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
`
    }

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

// Perform OCR on image
async function performOCR(imageData, language = "eng", detectBounds = true) {
  try {
    const worker = await Tesseract.createWorker({
      logger: (m) => console.log(m),
    })

    await worker.loadLanguage(language)
    await worker.initialize(language)

    // Basic text recognition
    const { data } = await worker.recognize(imageData)

    const result = {
      success: true,
      text: data.text,
      confidence: data.confidence,
    }

    // Get detailed data with bounding boxes if requested
    if (detectBounds) {
      const { data: boxData } = await worker.recognize(imageData, {
        rectangle: { top: 0, left: 0, width: 0, height: 0 },
      })

      result.words = boxData.words
      result.lines = boxData.lines
      result.paragraphs = boxData.paragraphs
    }

    await worker.terminate()

    return result
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
