document.addEventListener("DOMContentLoaded", () => {
  // Tab switching functionality
  const tabButtons = document.querySelectorAll(".tab-button")
  const tabContents = document.querySelectorAll(".tab-content")
  const themeToggle = document.getElementById("themeToggle")

  let isDarkMode = false

  // Theme toggle
  themeToggle.addEventListener("click", () => {
    isDarkMode = !isDarkMode
    document.body.classList.toggle("dark-mode", isDarkMode)
    themeToggle.textContent = isDarkMode ? "☀️" : "🌙"
    chrome.storage.sync.set({ darkMode: isDarkMode })
  })

  tabButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const tabId = this.getAttribute("data-tab")

      // Update active tab button
      tabButtons.forEach((btn) => btn.classList.remove("active"))
      this.classList.add("active")

      // Show active tab content
      tabContents.forEach((content) => content.classList.remove("active"))
      document.getElementById(`${tabId}Tab`).classList.add("active")
    })
  })

  // API provider change handler
  const apiProvider = document.getElementById("apiProvider")
  const openaiSettings = document.getElementById("openaiSettings")
  const geminiSettings = document.getElementById("geminiSettings")
  const deepseekSettings = document.getElementById("deepseekSettings")

  apiProvider.addEventListener("change", () => {
    const provider = apiProvider.value

    // Hide all settings
    openaiSettings.style.display = "none"
    geminiSettings.style.display = "none"
    deepseekSettings.style.display = "none"

    // Show selected provider settings
    if (provider === "openai" || provider === "auto") {
      openaiSettings.style.display = "block"
    }

    if (provider === "gemini" || provider === "auto") {
      geminiSettings.style.display = "block"
    }

    if (provider === "deepseek" || provider === "auto") {
      deepseekSettings.style.display = "block"
    }
  })

  // Range input value display
  const rangeInputs = document.querySelectorAll('input[type="range"]')

  rangeInputs.forEach((input) => {
    const valueDisplay = document.getElementById(`${input.id}Value`)

    // Set initial value
    if (valueDisplay) {
      if (input.id === "voiceRate") {
        valueDisplay.textContent = `${input.value}x`
      } else if (input.id.includes("Delay")) {
        valueDisplay.textContent = `${input.value}s`
      } else {
        valueDisplay.textContent = input.value
      }
    }

    // Update value on input
    input.addEventListener("input", () => {
      if (valueDisplay) {
        if (input.id === "voiceRate") {
          valueDisplay.textContent = `${input.value}x`
        } else if (input.id.includes("Delay")) {
          valueDisplay.textContent = `${input.value}s`
        } else {
          valueDisplay.textContent = input.value
        }
      }
    })
  })

  // Form elements
  const openaiKey = document.getElementById("openaiKey")
  const openaiModel = document.getElementById("openaiModel")
  const geminiKey = document.getElementById("geminiKey")
  const geminiModel = document.getElementById("geminiModel")
  const deepseekKey = document.getElementById("deepseekKey")
  const deepseekModel = document.getElementById("deepseekModel")
  const promptTemplate = document.getElementById("promptTemplate")
  const apiStatus = document.getElementById("apiStatus")
  const testApiButton = document.getElementById("testApiButton")
  const saveApiButton = document.getElementById("saveApiButton")

  const autoAnswerToggle = document.getElementById("autoAnswerToggle")
  const answerDelay = document.getElementById("answerDelay")
  const maxAnswerDelay = document.getElementById("maxAnswerDelay")
  const retryWrongToggle = document.getElementById("retryWrongToggle")
  const maxRetries = document.getElementById("maxRetries")
  const voiceToggle = document.getElementById("voiceToggle")
  const voiceRate = document.getElementById("voiceRate")
  const autoScrollToggle = document.getElementById("autoScrollToggle")
  const highlightToggle = document.getElementById("highlightToggle")
  const saveBehaviorButton = document.getElementById("saveBehaviorButton")

  const domDetectionToggle = document.getElementById("domDetectionToggle")
  const ocrToggle = document.getElementById("ocrToggle")
  const ocrLanguage = document.getElementById("ocrLanguage")
  const shadowDomToggle = document.getElementById("shadowDomToggle")
  const imageDetectionToggle = document.getElementById("imageDetectionToggle")
  const mathDetectionToggle = document.getElementById("mathDetectionToggle")
  const customSelectors = document.getElementById("customSelectors")
  const saveDetectionButton = document.getElementById("saveDetectionButton")

  const safeModeToggle = document.getElementById("safeModeToggle")
  const detectWebcamToggle = document.getElementById("detectWebcamToggle")
  const detectFullscreenToggle = document.getElementById("detectFullscreenToggle")
  const detectVMToggle = document.getElementById("detectVMToggle")
  const stealthModeToggle = document.getElementById("stealthModeToggle")
  const saveHistoryToggle = document.getElementById("saveHistoryToggle")
  const maxHistoryItems = document.getElementById("maxHistoryItems")
  const debugModeToggle = document.getElementById("debugModeToggle")
  const exportDataButton = document.getElementById("exportDataButton")
  const importDataButton = document.getElementById("importDataButton")
  const resetButton = document.getElementById("resetButton")
  const saveAdvancedButton = document.getElementById("saveAdvancedButton")

  const clearHistoryButton = document.getElementById("clearHistoryButton")
  const exportHistoryButton = document.getElementById("exportHistoryButton")
  const historyList = document.getElementById("historyList")

  // Load saved settings
  loadSettings()

  // Test API connection
  testApiButton.addEventListener("click", () => {
    const provider = apiProvider.value
    let key = ""
    let model = ""

    if (provider === "openai" || provider === "auto") {
      key = openaiKey.value
      model = openaiModel.value
    } else if (provider === "gemini") {
      key = geminiKey.value
      model = geminiModel.value
    } else if (provider === "deepseek") {
      key = deepseekKey.value
      model = deepseekModel.value
    }

    if (!key) {
      showApiStatus("Please enter an API key", "error")
      return
    }

    showApiStatus("Testing connection...", "")

    // Send message to background script to test API
    chrome.runtime.sendMessage(
      {
        action: "testApiConnection",
        provider: provider,
        apiKey: key,
        model: model,
      },
      (response) => {
        if (response && response.success) {
          showApiStatus("Connection successful!", "success")
        } else {
          showApiStatus(`Connection failed: ${response.error || "Unknown error"}`, "error")
        }
      },
    )
  })

  // Save API settings
  saveApiButton.addEventListener("click", () => {
    const provider = apiProvider.value
    const template = promptTemplate.value

    const settings = {
      apiProvider: provider,
      promptTemplate: template,
      apiConfigured: false,
    }

    // Save provider-specific settings
    if (provider === "openai" || provider === "auto") {
      const key = openaiKey.value
      const model = openaiModel.value

      if (!key) {
        showApiStatus("Please enter an OpenAI API key", "error")
        return
      }

      settings.openaiKey = key
      settings.openaiModel = model
      settings.apiConfigured = true
    }

    if (provider === "gemini" || provider === "auto") {
      const key = geminiKey.value
      const model = geminiModel.value

      if (!key && (provider === "gemini" || !settings.apiConfigured)) {
        showApiStatus("Please enter a Gemini API key", "error")
        return
      }

      if (key) {
        settings.geminiKey = key
        settings.geminiModel = model
        settings.apiConfigured = true
      }
    }

    if (provider === "deepseek" || provider === "auto") {
      const key = deepseekKey.value
      const model = deepseekModel.value

      if (!key && (provider === "deepseek" || !settings.apiConfigured)) {
        showApiStatus("Please enter a DeepSeek API key", "error")
        return
      }

      if (key) {
        settings.deepseekKey = key
        settings.deepseekModel = model
        settings.apiConfigured = true
      }
    }

    chrome.storage.sync.set(settings, () => {
      showApiStatus("API settings saved successfully!", "success")
    })
  })

  // Save behavior settings
  saveBehaviorButton.addEventListener("click", () => {
    const settings = {
      autoAnswer: autoAnswerToggle.checked,
      answerDelay: Number.parseFloat(answerDelay.value),
      maxAnswerDelay: Number.parseFloat(maxAnswerDelay.value),
      retryWrong: retryWrongToggle.checked,
      maxRetries: Number.parseInt(maxRetries.value),
      voiceEnabled: voiceToggle.checked,
      voiceRate: Number.parseFloat(voiceRate.value),
      autoScroll: autoScrollToggle.checked,
      highlightAnswers: highlightToggle.checked,
    }

    chrome.storage.sync.set(settings, () => {
      showStatus("behaviorTab", "Behavior settings saved successfully!", "success")
    })
  })

  // Save detection settings
  saveDetectionButton.addEventListener("click", () => {
    const settings = {
      domDetection: domDetectionToggle.checked,
      ocrEnabled: ocrToggle.checked,
      ocrLanguage: ocrLanguage.value,
      shadowDomDetection: shadowDomToggle.checked,
      imageDetection: imageDetectionToggle.checked,
      mathDetection: mathDetectionToggle.checked,
      customSelectors: customSelectors.value,
    }

    chrome.storage.sync.set(settings, () => {
      showStatus("detectionTab", "Detection settings saved successfully!", "success")
    })
  })

  // Save advanced settings
  saveAdvancedButton.addEventListener("click", () => {
    const settings = {
      safeMode: safeModeToggle.checked,
      detectWebcam: detectWebcamToggle.checked,
      detectFullscreen: detectFullscreenToggle.checked,
      detectVM: detectVMToggle.checked,
      stealthMode: stealthModeToggle.checked,
      saveHistory: saveHistoryToggle.checked,
      maxHistoryItems: Number.parseInt(maxHistoryItems.value),
      debugMode: debugModeToggle.checked,
    }

    chrome.storage.sync.set(settings, () => {
      showStatus("advancedTab", "Advanced settings saved successfully!", "success")
    })
  })

  // Export data
  exportDataButton.addEventListener("click", () => {
    chrome.storage.sync.get(null, (data) => {
      // Convert the data to a JSON string
      const jsonData = JSON.stringify(data, null, 2)

      // Create a blob with the data
      const blob = new Blob([jsonData], { type: "application/json" })

      // Create a URL for the blob
      const url = URL.createObjectURL(blob)

      // Create a temporary link element
      const a = document.createElement("a")
      a.href = url
      a.download = "mcq_bot_settings.json"

      // Trigger a click on the link to start the download
      document.body.appendChild(a)
      a.click()

      // Clean up
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    })
  })

  // Import data
  importDataButton.addEventListener("click", () => {
    // Create a file input element
    const fileInput = document.createElement("input")
    fileInput.type = "file"
    fileInput.accept = ".json"

    fileInput.addEventListener("change", (event) => {
      const file = event.target.files[0]

      if (file) {
        const reader = new FileReader()

        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target.result)

            // Save the imported data to storage
            chrome.storage.sync.set(data, () => {
              showStatus("advancedTab", "Settings imported successfully! Reloading...", "success")

              // Reload the settings after a short delay
              setTimeout(() => {
                loadSettings()
              }, 1000)
            })
          } catch (error) {
            showStatus("advancedTab", `Error importing settings: ${error.message}`, "error")
          }
        }

        reader.readAsText(file)
      }
    })

    // Trigger a click on the file input
    fileInput.click()
  })

  // Reset to defaults
  resetButton.addEventListener("click", () => {
    if (confirm("Are you sure you want to reset all settings to defaults?")) {
      const defaultSettings = {
        apiProvider: "openai",
        openaiModel: "gpt-4o",
        geminiModel: "gemini-pro",
        deepseekModel: "deepseek-chat",
        promptTemplate: promptTemplate.defaultValue,
        autoAnswer: true,
        answerDelay: 3,
        maxAnswerDelay: 6,
        retryWrong: true,
        maxRetries: 3,
        voiceEnabled: false,
        voiceRate: 1,
        autoScroll: true,
        highlightAnswers: true,
        domDetection: true,
        ocrEnabled: true,
        ocrLanguage: "eng",
        shadowDomDetection: true,
        imageDetection: true,
        mathDetection: true,
        customSelectors: customSelectors.defaultValue,
        safeMode: true,
        detectWebcam: true,
        detectFullscreen: true,
        detectVM: true,
        stealthMode: false,
        saveHistory: true,
        maxHistoryItems: 50,
        debugMode: false,
        mode: "learning",
        darkMode: false,
      }

      chrome.storage.sync.set(defaultSettings, () => {
        showStatus("advancedTab", "All settings reset to defaults! Reloading...", "success")

        // Reload the settings after a short delay
        setTimeout(() => {
          loadSettings()
          document.body.classList.remove("dark-mode")
          themeToggle.textContent = "🌙"
        }, 1000)
      })
    }
  })

  // Clear history
  clearHistoryButton.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear all answer history?")) {
      chrome.storage.local.set({ history: [] }, () => {
        loadHistory()
        showStatus("historyTab", "History cleared successfully!", "success")
      })
    }
  })

  // Export history
  exportHistoryButton.addEventListener("click", () => {
    chrome.storage.local.get(["history"], (data) => {
      const history = data.history || []

      // Convert the history to a JSON string
      const jsonData = JSON.stringify(history, null, 2)

      // Create a blob with the data
      const blob = new Blob([jsonData], { type: "application/json" })

      // Create a URL for the blob
      const url = URL.createObjectURL(blob)

      // Create a temporary link element
      const a = document.createElement("a")
      a.href = url
      a.download = "mcq_bot_history.json"

      // Trigger a click on the link to start the download
      document.body.appendChild(a)
      a.click()

      // Clean up
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    })
  })

  // Helper functions
  function loadSettings() {
    chrome.storage.sync.get(null, (result) => {
      // Apply dark mode if enabled
      isDarkMode = result.darkMode || false
      document.body.classList.toggle("dark-mode", isDarkMode)
      themeToggle.textContent = isDarkMode ? "☀️" : "🌙"

      // API settings
      apiProvider.value = result.apiProvider || "openai"
      openaiKey.value = result.openaiKey || ""
      openaiModel.value = result.openaiModel || "gpt-4o"
      geminiKey.value = result.geminiKey || ""
      geminiModel.value = result.geminiModel || "gemini-pro"
      deepseekKey.value = result.deepseekKey || ""
      deepseekModel.value = result.deepseekModel || "deepseek-chat"
      promptTemplate.value = result.promptTemplate || promptTemplate.defaultValue

      // Show/hide provider settings based on selected provider
      const provider = apiProvider.value
      openaiSettings.style.display = provider === "openai" || provider === "auto" ? "block" : "none"
      geminiSettings.style.display = provider === "gemini" || provider === "auto" ? "block" : "none"
      deepseekSettings.style.display = provider === "deepseek" || provider === "auto" ? "block" : "none"

      // Behavior settings
      autoAnswerToggle.checked = result.autoAnswer !== false // Default to true
      answerDelay.value = result.answerDelay || 3
      maxAnswerDelay.value = result.maxAnswerDelay || 6
      retryWrongToggle.checked = result.retryWrong !== false // Default to true
      maxRetries.value = result.maxRetries || 3
      voiceToggle.checked = result.voiceEnabled || false
      voiceRate.value = result.voiceRate || 1
      autoScrollToggle.checked = result.autoScroll !== false // Default to true
      highlightToggle.checked = result.highlightAnswers !== false // Default to true

      // Update range value displays
      document.getElementById("answerDelayValue").textContent = `${answerDelay.value}s`
      document.getElementById("maxAnswerDelayValue").textContent = `${maxAnswerDelay.value}s`
      document.getElementById("maxRetriesValue").textContent = maxRetries.value
      document.getElementById("voiceRateValue").textContent = `${voiceRate.value}x`

      // Detection settings
      domDetectionToggle.checked = result.domDetection !== false // Default to true
      ocrToggle.checked = result.ocrEnabled !== false // Default to true
      ocrLanguage.value = result.ocrLanguage || "eng"
      shadowDomToggle.checked = result.shadowDomDetection !== false // Default to true
      imageDetectionToggle.checked = result.imageDetection !== false // Default to true
      mathDetectionToggle.checked = result.mathDetection !== false // Default to true
      customSelectors.value = result.customSelectors || customSelectors.defaultValue

      // Advanced settings
      safeModeToggle.checked = result.safeMode !== false // Default to true
      detectWebcamToggle.checked = result.detectWebcam !== false // Default to true
      detectFullscreenToggle.checked = result.detectFullscreen !== false // Default to true
      detectVMToggle.checked = result.detectVM !== false // Default to true
      stealthModeToggle.checked = result.stealthMode || false
      saveHistoryToggle.checked = result.saveHistory !== false // Default to true
      maxHistoryItems.value = result.maxHistoryItems || 50
      debugModeToggle.checked = result.debugMode || false

      // Update range value display
      document.getElementById("maxHistoryItemsValue").textContent = maxHistoryItems.value

      // Load history
      loadHistory()
    })
  }

  function loadHistory() {
    chrome.storage.local.get(["history"], (data) => {
      const history = data.history || []

      // Clear the history list
      historyList.innerHTML = ""

      if (history.length === 0) {
        const emptyMessage = document.createElement("div")
        emptyMessage.className = "history-item"
        emptyMessage.textContent = "No history items yet."
        historyList.appendChild(emptyMessage)
        return
      }

      // Add history items in reverse chronological order
      history.reverse().forEach((item) => {
        const historyItem = document.createElement("div")
        historyItem.className = "history-item"

        const questionDiv = document.createElement("div")
        questionDiv.className = "history-question"
        questionDiv.textContent = item.question.substring(0, 150) + (item.question.length > 150 ? "..." : "")

        const answerDiv = document.createElement("div")
        answerDiv.className = "history-answer"
        answerDiv.textContent = `Answer: ${item.answer}`

        const timeDiv = document.createElement("div")
        timeDiv.className = "history-time"
        timeDiv.textContent = new Date(item.timestamp).toLocaleString()

        historyItem.appendChild(questionDiv)
        historyItem.appendChild(answerDiv)
        historyItem.appendChild(timeDiv)

        historyList.appendChild(historyItem)
      })
    })
  }

  function showApiStatus(message, type) {
    apiStatus.textContent = message
    apiStatus.className = `status ${type}`
    apiStatus.style.display = "block"

    if (type === "success" || type === "error") {
      setTimeout(() => {
        apiStatus.style.display = "none"
      }, 5000)
    }
  }

  function showStatus(tabId, message, type) {
    const container = document.querySelector(`#${tabId} .container`)

    // Remove any existing status messages
    const existingStatus = container.querySelector(".status")
    if (existingStatus) {
      container.removeChild(existingStatus)
    }

    // Create a new status message
    const status = document.createElement("div")
    status.className = `status ${type}`
    status.textContent = message

    // Add the status message to the container
    container.appendChild(status)

    // Remove the status message after a delay
    setTimeout(() => {
      if (container.contains(status)) {
        container.removeChild(status)
      }
    }, 5000)
  }
})
