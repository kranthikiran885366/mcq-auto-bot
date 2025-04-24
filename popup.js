document.addEventListener("DOMContentLoaded", () => {
  const botToggle = document.getElementById("botToggle")
  const voiceToggle = document.getElementById("voiceToggle")
  const autoAnswerToggle = document.getElementById("autoAnswerToggle")
  const modeSelect = document.getElementById("modeSelect")
  const scanButton = document.getElementById("scanButton")
  const captureButton = document.getElementById("captureButton")
  const statusDot = document.getElementById("statusDot")
  const statusText = document.getElementById("statusText")
  const apiStatus = document.getElementById("apiStatus")
  const mcqInfo = document.getElementById("mcqInfo")
  const mcqsFoundEl = document.getElementById("mcqsFound")
  const mcqsAnsweredEl = document.getElementById("mcqsAnswered")
  const accuracyEl = document.getElementById("accuracy")
  const themeToggle = document.getElementById("themeToggle")

  let isDarkMode = false

  // Theme toggle
  themeToggle.addEventListener("click", () => {
    isDarkMode = !isDarkMode
    document.body.classList.toggle("dark-mode", isDarkMode)
    themeToggle.textContent = isDarkMode ? "☀️" : "🌙"
    chrome.storage.sync.set({ darkMode: isDarkMode })
  })

  // Load saved settings
  chrome.storage.sync.get(
    ["botEnabled", "voiceEnabled", "autoAnswer", "mode", "apiConfigured", "darkMode", "stats"],
    (result) => {
      botToggle.checked = result.botEnabled || false
      voiceToggle.checked = result.voiceEnabled || false
      autoAnswerToggle.checked = result.autoAnswer !== false // Default to true
      modeSelect.value = result.mode || "learning"
      isDarkMode = result.darkMode || false

      // Apply dark mode if enabled
      document.body.classList.toggle("dark-mode", isDarkMode)
      themeToggle.textContent = isDarkMode ? "☀️" : "🌙"

      updateStatusIndicator(result.botEnabled || false)

      // Update stats
      if (result.stats) {
        mcqsFoundEl.textContent = result.stats.found || 0
        mcqsAnsweredEl.textContent = result.stats.answered || 0
        accuracyEl.textContent = `${result.stats.accuracy || 0}%`
      }

      if (result.apiConfigured) {
        apiStatus.textContent = "API Status: Connected"
        apiStatus.className = "api-status connected"
      } else {
        apiStatus.textContent = "API Status: Not Connected"
        apiStatus.className = "api-status disconnected"

        // Disable bot if API is not configured
        botToggle.checked = false
        botToggle.disabled = true
        scanButton.disabled = true
        captureButton.disabled = true

        updateStatusIndicator(false)
      }
    },
  )

  // Toggle bot status
  botToggle.addEventListener("change", () => {
    const isEnabled = botToggle.checked

    chrome.storage.sync.set({ botEnabled: isEnabled })

    updateStatusIndicator(isEnabled)

    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: isEnabled ? "enableBot" : "disableBot",
        mode: modeSelect.value,
      })
    })
  })

  // Toggle voice narration
  voiceToggle.addEventListener("change", () => {
    const isEnabled = voiceToggle.checked

    chrome.storage.sync.set({ voiceEnabled: isEnabled })

    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "setVoiceNarration",
        enabled: isEnabled,
      })
    })
  })

  // Toggle auto-answer
  autoAnswerToggle.addEventListener("change", () => {
    const isEnabled = autoAnswerToggle.checked

    chrome.storage.sync.set({ autoAnswer: isEnabled })

    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "setAutoAnswer",
        enabled: isEnabled,
      })
    })
  })

  // Change mode
  modeSelect.addEventListener("change", () => {
    const mode = modeSelect.value

    chrome.storage.sync.set({ mode: mode })

    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "setMode",
        mode: mode,
      })
    })
  })

  // Scan for MCQs button
  scanButton.addEventListener("click", () => {
    statusText.textContent = "Scanning for MCQs..."

    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "scanForMCQs" }, (response) => {
        if (response && response.success) {
          statusText.textContent = `Found ${response.count} MCQs`
          mcqsFoundEl.textContent = response.count

          // Update storage
          chrome.storage.sync.get(["stats"], (result) => {
            const stats = result.stats || { found: 0, answered: 0, accuracy: 0 }
            stats.found = response.count
            chrome.storage.sync.set({ stats })
          })

          // Show MCQ info if available
          if (response.lastMCQ) {
            mcqInfo.style.display = "block"
            mcqInfo.querySelector(".mcq-question").textContent =
              `Question: ${response.lastMCQ.question.substring(0, 100)}${response.lastMCQ.question.length > 100 ? "..." : ""}`
            mcqInfo.querySelector(".mcq-answer").textContent = `Answer: ${response.lastMCQ.answer || "Pending..."}`
          }
        } else {
          statusText.textContent = "No MCQs found"
        }
      })
    })
  })

  // Capture screen button
  captureButton.addEventListener("click", () => {
    statusText.textContent = "Capturing screen..."

    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "captureScreen" }, (response) => {
        if (response && response.success) {
          statusText.textContent = "Screen captured"

          // Show MCQ info if available
          if (response.ocrText) {
            mcqInfo.style.display = "block"
            mcqInfo.querySelector(".mcq-question").textContent =
              `OCR Text: ${response.ocrText.substring(0, 100)}${response.ocrText.length > 100 ? "..." : ""}`
          }
        } else {
          statusText.textContent = "Screen capture failed"
        }
      })
    })
  })

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "updateStats") {
      mcqsFoundEl.textContent = message.stats.found
      mcqsAnsweredEl.textContent = message.stats.answered
      accuracyEl.textContent = `${message.stats.accuracy}%`
    }

    if (message.action === "updateLastMCQ") {
      mcqInfo.style.display = "block"
      mcqInfo.querySelector(".mcq-question").textContent =
        `Question: ${message.mcq.question.substring(0, 100)}${message.mcq.question.length > 100 ? "..." : ""}`
      mcqInfo.querySelector(".mcq-answer").textContent = `Answer: ${message.mcq.answer || "Pending..."}`
    }
  })

  function updateStatusIndicator(isEnabled) {
    if (isEnabled) {
      statusDot.className = "status-dot active"
      statusText.textContent = "Bot is active"
    } else {
      statusDot.className = "status-dot inactive"
      statusText.textContent = "Bot is inactive"
    }
  }
})
