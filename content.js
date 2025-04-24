// Global variables
let botEnabled = false
let voiceEnabled = false
let autoAnswer = true
let mode = "learning" // 'learning', 'safe', or 'stealth'
let answerDelay = 3
let maxAnswerDelay = 6
let retryWrong = true
let maxRetries = 3
let voiceRate = 1
let autoScroll = true
let highlightAnswers = true
let safeMode = true
let detectWebcam = true
let detectFullscreen = true
let detectVM = true
let stealthMode = false
let saveHistory = true
let maxHistoryItems = 50
let debugMode = false
let domDetection = true
let ocrEnabled = true
let ocrLanguage = "eng"
let shadowDomDetection = true
let imageDetection = true
let mathDetection = true
let customSelectors = ""

// Stats
let stats = {
  found: 0,
  answered: 0,
  correct: 0,
  accuracy: 0,
}

// Last MCQ processed
let lastMCQ = null

// Initialize settings
if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
  chrome.storage.sync.get(null, (result) => {
    botEnabled = result.botEnabled || false
    voiceEnabled = result.voiceEnabled || false
    autoAnswer = result.autoAnswer !== false // Default to true
    mode = result.mode || "learning"
    answerDelay = result.answerDelay || 3
    maxAnswerDelay = result.maxAnswerDelay || 6
    retryWrong = result.retryWrong !== false // Default to true
    maxRetries = result.maxRetries || 3
    voiceRate = result.voiceRate || 1
    autoScroll = result.autoScroll !== false // Default to true
    highlightAnswers = result.highlightAnswers !== false // Default to true
    safeMode = result.safeMode !== false // Default to true
    detectWebcam = result.detectWebcam !== false // Default to true
    detectFullscreen = result.detectFullscreen !== false // Default to true
    detectVM = result.detectVM !== false // Default to true
    stealthMode = result.stealthMode || false
    saveHistory = result.saveHistory !== false // Default to true
    maxHistoryItems = result.maxHistoryItems || 50
    debugMode = result.debugMode || false
    domDetection = result.domDetection !== false // Default to true
    ocrEnabled = result.ocrEnabled !== false // Default to true
    ocrLanguage = result.ocrLanguage || "eng"
    shadowDomDetection = result.shadowDomDetection !== false // Default to true
    imageDetection = result.imageDetection !== false // Default to true
    mathDetection = result.mathDetection !== false // Default to true
    customSelectors = result.customSelectors || ""

    // Load stats
    if (result.stats) {
      stats = result.stats
    }

    // If bot is enabled, start scanning for MCQs
    if (botEnabled) {
      initBot()
    }
  })
} else {
  console.warn("Chrome storage API not available. Settings will not be loaded.")
}

// Listen for messages from popup
if (typeof chrome !== "undefined" && chrome.runtime) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "enableBot") {
      botEnabled = true
      mode = message.mode || "learning"
      initBot()
      sendResponse({ success: true })
    }

    if (message.action === "disableBot") {
      botEnabled = false
      sendResponse({ success: true })
    }

    if (message.action === "setVoiceNarration") {
      voiceEnabled = message.enabled
      sendResponse({ success: true })
    }

    if (message.action === "setAutoAnswer") {
      autoAnswer = message.enabled
      sendResponse({ success: true })
    }

    if (message.action === "setMode") {
      mode = message.mode
      sendResponse({ success: true })
    }

    if (message.action === "scanForMCQs") {
      const mcqs = findMCQs()
      lastMCQ = mcqs.length > 0 ? mcqs[0] : null
      sendResponse({
        success: true,
        count: mcqs.length,
        lastMCQ: lastMCQ,
      })

      // Update stats
      stats.found = mcqs.length
      chrome.storage.sync.set({ stats })

      // Send stats update to popup
      chrome.runtime.sendMessage({
        action: "updateStats",
        stats: stats,
      })
    }

    if (message.action === "captureScreen") {
      captureScreen()
        .then((imageData) => {
          // Perform OCR on the captured screen
          chrome.runtime.sendMessage(
            {
              action: "performOCR",
              imageData: imageData,
              language: ocrLanguage,
            },
            (response) => {
              if (response && response.success) {
                sendResponse({
                  success: true,
                  ocrText: response.text,
                })
              } else {
                sendResponse({
                  success: false,
                  error: response ? response.error : "OCR failed",
                })
              }
            },
          )
        })
        .catch((error) => {
          sendResponse({
            success: false,
            error: error.message,
          })
        })

      return true // Indicates async response
    }

    return true
  })
} else {
  console.warn("Chrome runtime API not available. Message listener will not be active.")
}

// Initialize the bot
function initBot() {
  if (debugMode) {
    console.log("AI MCQ Bot initialized with settings:", {
      mode,
      autoAnswer,
      answerDelay,
      maxAnswerDelay,
      retryWrong,
      maxRetries,
      voiceEnabled,
      voiceRate,
      autoScroll,
      highlightAnswers,
      safeMode,
      detectWebcam,
      detectFullscreen,
      detectVM,
      stealthMode,
      domDetection,
      ocrEnabled,
      ocrLanguage,
      shadowDomDetection,
      imageDetection,
      mathDetection,
    })
  } else {
    console.log("AI MCQ Bot initialized")
  }

  // Check if we're in a proctored environment
  if (safeMode && isInProctoredEnvironment()) {
    console.log("Proctored environment detected, disabling bot")
    return
  }

  // Start observing DOM changes
  startObserver()

  // Initial scan for MCQs
  scanAndAnswerMCQs()
}

// Check if we're in a proctored environment
function isInProctoredEnvironment() {
  let isProctoredEnvironment = false

  // Check if we're in fullscreen mode
  if (
    detectFullscreen &&
    (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement)
  ) {
    console.log("Fullscreen mode detected")
    isProctoredEnvironment = true
  }

  // Check if webcam is active
  if (detectWebcam) {
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        const videoInputs = devices.filter((device) => device.kind === "videoinput")
        if (videoInputs.length > 0) {
          // This doesn't guarantee the webcam is active, just that it exists
          // A more accurate check would require permission to access the webcam
          console.log("Webcam detected")
        }
      })
      .catch((err) => {
        console.error("Error checking webcam:", err)
      })
  }

  // Check for Safe Exam Browser
  if (window.navigator.userAgent.includes("SEB") || document.documentElement.classList.contains("seb")) {
    console.log("Safe Exam Browser detected")
    isProctoredEnvironment = true
  }

  // Check for virtual machine
  if (detectVM) {
    // This is a basic check and not foolproof
    const screenWidth = window.screen.width
    const screenHeight = window.screen.height

    // Common VM resolutions
    const vmResolutions = [
      { width: 800, height: 600 },
      { width: 1024, height: 768 },
      { width: 1280, height: 720 },
      { width: 1280, height: 800 },
      { width: 1280, height: 1024 },
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 1600, height: 900 },
      { width: 1680, height: 1050 },
      { width: 1920, height: 1080 },
    ]

    // Check if current resolution matches a common VM resolution
    const isCommonVMResolution = vmResolutions.some((res) => res.width === screenWidth && res.height === screenHeight)

    // Check for other VM indicators
    const hasLowColorDepth = window.screen.colorDepth <= 24
    const hasLowDevicePixelRatio = window.devicePixelRatio === 1

    // If multiple indicators are present, it might be a VM
    if (isCommonVMResolution && hasLowColorDepth && hasLowDevicePixelRatio) {
      console.log("Virtual machine detected")
      isProctoredEnvironment = true
    }
  }

  return isProctoredEnvironment && mode === "safe"
}

// Start MutationObserver to detect new MCQs
function startObserver() {
  const observer = new MutationObserver((mutations) => {
    let shouldScan = false

    for (const mutation of mutations) {
      if (mutation.type === "childList" || mutation.type === "attributes") {
        shouldScan = true
        break
      }
    }

    if (shouldScan && botEnabled) {
      scanAndAnswerMCQs()
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "disabled"],
  })
}

// Scan for MCQs and answer them
function scanAndAnswerMCQs() {
  if (!botEnabled) return

  const mcqs = findMCQs()

  if (mcqs.length > 0) {
    if (debugMode) {
      console.log(`Found ${mcqs.length} MCQs:`, mcqs)
    } else {
      console.log(`Found ${mcqs.length} MCQs`)
    }

    // Update stats
    stats.found = mcqs.length
    chrome.storage.sync.set({ stats })

    // Send stats update to popup
    chrome.runtime.sendMessage({
      action: "updateStats",
      stats: stats,
    })

    mcqs.forEach((mcq, index) => {
      // Add a delay to make it look more natural
      setTimeout(() => {
        processMCQ(mcq)
      }, index * 1000) // Process one MCQ per second
    })
  }
}

// Find MCQs on the page
function findMCQs() {
  const mcqs = []

  // Method 1: Find radio button groups (if DOM detection is enabled)
  if (domDetection) {
    const radioGroups = findRadioGroups()
    mcqs.push(...radioGroups)

    // Method 2: Find checkbox groups
    const checkboxGroups = findCheckboxGroups()
    mcqs.push(...checkboxGroups)

    // Method 3: Find select dropdowns
    const selectDropdowns = findSelectDropdowns()
    mcqs.push(...selectDropdowns)

    // Method 4: Find common MCQ patterns in HTML
    const htmlPatterns = findHTMLPatterns()
    mcqs.push(...htmlPatterns)

    // Method 5: Find MCQs in shadow DOM (if enabled)
    if (shadowDomDetection) {
      const shadowDomMCQs = findShadowDomMCQs()
      mcqs.push(...shadowDomMCQs)
    }

    // Method 6: Find MCQs using custom selectors
    if (customSelectors) {
      const customMCQs = findCustomMCQs()
      mcqs.push(...customMCQs)
    }
  }

  // Method 7: Use OCR to find MCQs in images (if enabled)
  if (ocrEnabled) {
    findMCQsWithOCR().then((ocrMcqs) => {
      mcqs.push(...ocrMcqs)
    })
  }

  // Method 8: Find image-based MCQs (if enabled)
  if (imageDetection) {
    const imageMCQs = findImageMCQs()
    mcqs.push(...imageMCQs)
  }

  // Method 9: Find math equation MCQs (if enabled)
  if (mathDetection) {
    const mathMCQs = findMathMCQs()
    mcqs.push(...mathMCQs)
  }

  return mcqs
}

// Find radio button groups
function findRadioGroups() {
  const radioGroups = []
  const radioButtons = document.querySelectorAll('input[type="radio"]')
  const groupedRadios = {}

  // Group radio buttons by name
  radioButtons.forEach((radio) => {
    const name = radio.name
    if (!name) return

    if (!groupedRadios[name]) {
      groupedRadios[name] = []
    }

    groupedRadios[name].push(radio)
  })

  // Process each group
  for (const name in groupedRadios) {
    const radios = groupedRadios[name]

    if (radios.length < 2) continue // Skip groups with only one option

    // Find the question text
    let questionText = ""

    // Method 1: Look for a label or heading before the radio group
    const firstRadio = radios[0]
    let currentElement = firstRadio.parentElement

    while (currentElement && !questionText) {
      // Look for headings, paragraphs, or divs with text
      const headings = currentElement.querySelectorAll("h1, h2, h3, h4, h5, h6, p, div")

      for (const heading of headings) {
        const text = heading.textContent.trim()
        if (text && text.length > 10 && text.includes("?")) {
          questionText = text
          break
        }
      }

      currentElement = currentElement.parentElement

      // Prevent infinite loop
      if (currentElement === document.body) break
    }

    // Method 2: Look for a fieldset legend
    if (!questionText) {
      const fieldset = firstRadio.closest("fieldset")
      if (fieldset) {
        const legend = fieldset.querySelector("legend")
        if (legend) {
          questionText = legend.textContent.trim()
        }
      }
    }

    // Method 3: Look for a div with a question-like class
    if (!questionText) {
      const questionDiv = document.querySelector(".question, .question-text, .quiz-question, .mcq-question")
      if (questionDiv) {
        questionText = questionDiv.textContent.trim()
      }
    }

    // If we still don't have a question, use a generic one
    if (!questionText) {
      questionText = `Question for options: ${radios
        .map((r) => {
          const label = document.querySelector(`label[for="${r.id}"]`)
          return label ? label.textContent.trim() : ""
        })
        .filter(Boolean)
        .join(", ")}`
    }

    // Get the options
    const options = radios.map((radio) => {
      let optionText = ""

      // Method 1: Look for a label with matching 'for' attribute
      if (radio.id) {
        const label = document.querySelector(`label[for="${radio.id}"]`)
        if (label) {
          optionText = label.textContent.trim()
        }
      }

      // Method 2: Look for a label wrapping the radio
      if (!optionText) {
        const parentLabel = radio.closest("label")
        if (parentLabel) {
          optionText = parentLabel.textContent.trim()
          // Remove the radio button text if any
          optionText = optionText.replace(/^\s*[\u25CB\u25CF\u25EF\u26AB\u26AA]\s*/, "")
        }
      }

      // Method 3: Look for text next to the radio
      if (!optionText) {
        const nextSibling = radio.nextSibling
        if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
          optionText = nextSibling.textContent.trim()
        }
      }

      return {
        element: radio,
        text: optionText,
      }
    })

    // Only add if we have a question and options with text
    if (questionText && options.some((opt) => opt.text)) {
      radioGroups.push({
        type: "radio",
        question: questionText,
        options: options.filter((opt) => opt.text),
        answered: radios.some((radio) => radio.checked),
      })
    }
  }

  return radioGroups
}

// Find checkbox groups
function findCheckboxGroups() {
  const checkboxGroups = []
  const checkboxes = document.querySelectorAll('input[type="checkbox"]')

  // Group checkboxes by their container
  const containers = new Set()

  checkboxes.forEach((checkbox) => {
    // Find the closest container
    const container = checkbox.closest("form, fieldset, div.question, div.mcq, div.quiz-question")
    if (container) {
      containers.add(container)
    }
  })

  // Process each container
  containers.forEach((container) => {
    const containerCheckboxes = container.querySelectorAll('input[type="checkbox"]')

    if (containerCheckboxes.length < 2) return // Skip containers with only one checkbox

    // Find the question text
    let questionText = ""

    // Method 1: Look for a heading or paragraph in the container
    const headings = container.querySelectorAll("h1, h2, h3, h4, h5, h6, p, legend")

    for (const heading of headings) {
      const text = heading.textContent.trim()
      if (text && text.length > 10) {
        questionText = text
        break
      }
    }

    // Method 2: Look for a div with a question-like class
    if (!questionText) {
      const questionDiv = container.querySelector(".question, .question-text, .quiz-question, .mcq-question")
      if (questionDiv) {
        questionText = questionDiv.textContent.trim()
      }
    }

    // If we still don't have a question, use a generic one
    if (!questionText) {
      questionText = `Question for checkboxes: ${Array.from(containerCheckboxes)
        .map((cb) => {
          const label = document.querySelector(`label[for="${cb.id}"]`)
          return label ? label.textContent.trim() : ""
        })
        .filter(Boolean)
        .join(", ")}`
    }

    // Get the options
    const options = Array.from(containerCheckboxes).map((checkbox) => {
      let optionText = ""

      // Method 1: Look for a label with matching 'for' attribute
      if (checkbox.id) {
        const label = document.querySelector(`label[for="${checkbox.id}"]`)
        if (label) {
          optionText = label.textContent.trim()
        }
      }

      // Method 2: Look for a label wrapping the checkbox
      if (!optionText) {
        const parentLabel = checkbox.closest("label")
        if (parentLabel) {
          optionText = parentLabel.textContent.trim()
          // Remove the checkbox text if any
          optionText = optionText.replace(/^\s*[\u2610\u2611\u2612]\s*/, "")
        }
      }

      // Method 3: Look for text next to the checkbox
      if (!optionText) {
        const nextSibling = checkbox.nextSibling
        if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
          optionText = nextSibling.textContent.trim()
        }
      }

      return {
        element: checkbox,
        text: optionText,
      }
    })

    // Only add if we have a question and options with text
    if (questionText && options.some((opt) => opt.text)) {
      checkboxGroups.push({
        type: "checkbox",
        question: questionText,
        options: options.filter((opt) => opt.text),
        answered: Array.from(containerCheckboxes).some((checkbox) => checkbox.checked),
      })
    }
  })

  return checkboxGroups
}

// Find select dropdowns
function findSelectDropdowns() {
  const selectDropdowns = []
  const selects = document.querySelectorAll("select")

  selects.forEach((select) => {
    // Skip selects with less than 2 options
    if (select.options.length < 2) return

    // Find the question text
    let questionText = ""

    // Method 1: Look for a label with matching 'for' attribute
    if (select.id) {
      const label = document.querySelector(`label[for="${select.id}"]`)
      if (label) {
        questionText = label.textContent.trim()
      }
    }

    // Method 2: Look for a label wrapping the select
    if (!questionText) {
      const parentLabel = select.closest("label")
      if (parentLabel) {
        questionText = parentLabel.textContent.trim()
        // Remove the select text if any
        questionText = questionText.replace(select.textContent.trim(), "").trim()
      }
    }

    // Method 3: Look for a heading or paragraph before the select
    if (!questionText) {
      let currentElement = select.previousElementSibling

      while (currentElement && !questionText) {
        if (currentElement.tagName.match(/^H[1-6]$/) || currentElement.tagName === "P") {
          questionText = currentElement.textContent.trim()
        }

        currentElement = currentElement.previousElementSibling

        // Prevent infinite loop
        if (!currentElement) break
      }
    }

    // If we still don't have a question, use a generic one
    if (!questionText) {
      questionText = `Question for dropdown: ${select.name || "Unnamed dropdown"}`
    }

    // Get the options
    const options = Array.from(select.options)
      .map((option) => {
        return {
          element: option,
          text: option.textContent.trim(),
        }
      })
      .filter((opt) => opt.text && !opt.text.includes("Select") && !opt.text.includes("Choose"))

    // Only add if we have a question and options with text
    if (questionText && options.length > 0) {
      selectDropdowns.push({
        type: "select",
        question: questionText,
        options: options,
        answered: select.selectedIndex > 0,
      })
    }
  })

  return selectDropdowns
}

// Find common MCQ patterns in HTML
function findHTMLPatterns() {
  const patterns = []

  // Pattern 1: Common quiz platforms (Google Forms, etc.)
  const googleFormQuestions = document.querySelectorAll(".freebirdFormviewerComponentsQuestionBaseRoot")

  googleFormQuestions.forEach((question) => {
    const questionText = question.querySelector(".freebirdFormviewerComponentsQuestionBaseTitle")?.textContent.trim()

    if (!questionText) return

    // Check for radio buttons
    const radioOptions = question.querySelectorAll('input[type="radio"]')

    if (radioOptions.length > 0) {
      const options = Array.from(radioOptions)
        .map((radio) => {
          const label = radio.closest(".docssharedWizToggleLabeledContainer")
          return {
            element: radio,
            text: label ? label.textContent.trim() : "",
          }
        })
        .filter((opt) => opt.text)

      if (options.length > 0) {
        patterns.push({
          type: "radio",
          question: questionText,
          options: options,
          answered: Array.from(radioOptions).some((radio) => radio.checked),
        })
      }
    }

    // Check for checkboxes
    const checkboxOptions = question.querySelectorAll('input[type="checkbox"]')

    if (checkboxOptions.length > 0) {
      const options = Array.from(checkboxOptions)
        .map((checkbox) => {
          const label = checkbox.closest(".docssharedWizToggleLabeledContainer")
          return {
            element: checkbox,
            text: label ? label.textContent.trim() : "",
          }
        })
        .filter((opt) => opt.text)

      if (options.length > 0) {
        patterns.push({
          type: "checkbox",
          question: questionText,
          options: options,
          answered: Array.from(checkboxOptions).some((checkbox) => checkbox.checked),
        })
      }
    }
  })

  // Pattern 2: Common quiz/test platforms
  const quizQuestions = document.querySelectorAll(".question, .mcq, .multiple-choice, .quiz-question")

  quizQuestions.forEach((question) => {
    let questionText = ""

    // Find question text
    const questionTextElement = question.querySelector(".question-text, .stem, h3, h4, p")
    if (questionTextElement) {
      questionText = questionTextElement.textContent.trim()
    } else {
      // Try to find the first text node or paragraph
      for (const child of question.childNodes) {
        if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
          questionText = child.textContent.trim()
          break
        } else if (child.tagName === "P" && child.textContent.trim()) {
          questionText = child.textContent.trim()
          break
        }
      }
    }

    if (!questionText) return

    // Find options
    const optionElements = question.querySelectorAll(".option, .answer, .choice, li, label")

    if (optionElements.length > 0) {
      const options = Array.from(optionElements)
        .map((option) => {
          // Check if this option contains a radio or checkbox
          const input = option.querySelector('input[type="radio"], input[type="checkbox"]')

          return {
            element: input || option,
            text: option.textContent.trim(),
          }
        })
        .filter((opt) => opt.text)

      if (options.length > 0) {
        patterns.push({
          type: "pattern",
          question: questionText,
          options: options,
          answered: false, // We can't easily determine if it's answered
        })
      }
    }
  })

  return patterns
}

// Find MCQs in shadow DOM
function findShadowDomMCQs() {
  const shadowMCQs = []

  // Function to recursively search for shadow roots
  function searchShadowRoots(element) {
    // Check if the element has a shadow root
    const shadowRoot = element.shadowRoot

    if (shadowRoot) {
      // Search for MCQs in this shadow root

      // Look for radio buttons
      const radioButtons = shadowRoot.querySelectorAll('input[type="radio"]')
      if (radioButtons.length > 0) {
        // Group by name
        const groupedRadios = {}
        radioButtons.forEach((radio) => {
          const name = radio.name
          if (!name) return

          if (!groupedRadios[name]) {
            groupedRadios[name] = []
          }

          groupedRadios[name].push(radio)
        })

        // Process each group
        for (const name in groupedRadios) {
          const radios = groupedRadios[name]

          if (radios.length < 2) continue // Skip groups with only one option

          // Find question text (similar to findRadioGroups)
          let questionText = ""

          // Look for headings or paragraphs
          const headings = shadowRoot.querySelectorAll("h1, h2, h3, h4, h5, h6, p")
          for (const heading of headings) {
            const text = heading.textContent.trim()
            if (text && text.length > 10) {
              questionText = text
              break
            }
          }

          // If no question found, use a generic one
          if (!questionText) {
            questionText = `Question in shadow DOM for options: ${radios.map((r) => r.value || "Option").join(", ")}`
          }

          // Get options
          const options = radios.map((radio) => {
            let optionText = ""

            // Try to find label
            if (radio.id) {
              const label = shadowRoot.querySelector(`label[for="${radio.id}"]`)
              if (label) {
                optionText = label.textContent.trim()
              }
            }

            // If no label found, use value or generic text
            if (!optionText) {
              optionText = radio.value || `Option ${radio.id || ""}`
            }

            return {
              element: radio,
              text: optionText,
            }
          })

          // Add to shadow MCQs
          shadowMCQs.push({
            type: "shadow-radio",
            question: questionText,
            options: options,
            answered: radios.some((radio) => radio.checked),
            shadowRoot: shadowRoot,
          })
        }
      }

      // Look for checkboxes (similar approach as radio buttons)
      const checkboxes = shadowRoot.querySelectorAll('input[type="checkbox"]')
      if (checkboxes.length > 2) {
        // At least 2 checkboxes to be an MCQ
        // Find question text
        let questionText = ""

        // Look for headings or paragraphs
        const headings = shadowRoot.querySelectorAll("h1, h2, h3, h4, h5, h6, p")
        for (const heading of headings) {
          const text = heading.textContent.trim()
          if (text && text.length > 10) {
            questionText = text
            break
          }
        }

        // If no question found, use a generic one
        if (!questionText) {
          questionText = `Question in shadow DOM with multiple checkboxes`
        }

        // Get options
        const options = Array.from(checkboxes).map((checkbox) => {
          let optionText = ""

          // Try to find label
          if (checkbox.id) {
            const label = shadowRoot.querySelector(`label[for="${checkbox.id}"]`)
            if (label) {
              optionText = label.textContent.trim()
            }
          }

          // If no label found, use value or generic text
          if (!optionText) {
            optionText = checkbox.value || `Option ${checkbox.id || ""}`
          }

          return {
            element: checkbox,
            text: optionText,
          }
        })

        // Add to shadow MCQs
        shadowMCQs.push({
          type: "shadow-checkbox",
          question: questionText,
          options: options,
          answered: Array.from(checkboxes).some((checkbox) => checkbox.checked),
          shadowRoot: shadowRoot,
        })
      }

      // Look for select elements
      const selects = shadowRoot.querySelectorAll("select")
      selects.forEach((select) => {
        if (select.options.length < 2) return // Skip selects with less than 2 options

        // Find question text
        let questionText = ""

        // Look for label
        if (select.id) {
          const label = shadowRoot.querySelector(`label[for="${select.id}"]`)
          if (label) {
            questionText = label.textContent.trim()
          }
        }

        // If no question found, use a generic one
        if (!questionText) {
          questionText = `Question in shadow DOM for dropdown`
        }

        // Get options
        const options = Array.from(select.options)
          .map((option) => ({
            element: option,
            text: option.textContent.trim(),
          }))
          .filter((opt) => opt.text && !opt.text.includes("Select") && !opt.text.includes("Choose"))

        // Add to shadow MCQs
        if (options.length > 0) {
          shadowMCQs.push({
            type: "shadow-select",
            question: questionText,
            options: options,
            answered: select.selectedIndex > 0,
            shadowRoot: shadowRoot,
          })
        }
      })

      // Continue searching in all child elements of the shadow root
      shadowRoot.querySelectorAll("*").forEach((child) => {
        searchShadowRoots(child)
      })
    }

    // Continue searching in all child elements
    element.querySelectorAll("*").forEach((child) => {
      searchShadowRoots(child)
    })
  }

  // Start searching from the document body
  searchShadowRoots(document.body)

  return shadowMCQs
}

// Find MCQs using custom selectors
function findCustomMCQs() {
  const customMCQs = []

  if (!customSelectors) return customMCQs

  // Split custom selectors by newline
  const selectors = customSelectors.split("\n").filter((s) => s.trim())

  selectors.forEach((selector) => {
    try {
      // Find elements matching the selector
      const elements = document.querySelectorAll(selector.trim())

      elements.forEach((element) => {
        // Try to find a question and options
        let questionText = ""

        // Look for question text in headings, paragraphs, or divs
        const questionElements = element.querySelectorAll("h1, h2, h3, h4, h5, h6, p, div.question, .question-text")
        for (const qElement of questionElements) {
          const text = qElement.textContent.trim()
          if (text && text.length > 10) {
            questionText = text
            break
          }
        }

        // If no question found, use the element's text
        if (!questionText) {
          questionText = element.textContent.trim().substring(0, 100)
        }

        // Look for options
        const optionElements = element.querySelectorAll(
          "li, .option, .answer, .choice, label, input[type='radio'], input[type='checkbox']",
        )

        if (optionElements.length > 0) {
          const options = Array.from(optionElements)
            .map((optElement) => {
              // If it's an input, try to find its label
              if (optElement.tagName === "INPUT") {
                if (optElement.id) {
                  const label = document.querySelector(`label[for="${optElement.id}"]`)
                  if (label) {
                    return {
                      element: optElement,
                      text: label.textContent.trim(),
                    }
                  }
                }

                // If no label found, use parent's text
                const parent = optElement.parentElement
                if (parent) {
                  return {
                    element: optElement,
                    text: parent.textContent.trim(),
                  }
                }

                // Fallback to value
                return {
                  element: optElement,
                  text: optElement.value || "Option",
                }
              }

              // For other elements, use their text content
              return {
                element: optElement,
                text: optElement.textContent.trim(),
              }
            })
            .filter((opt) => opt.text)

          if (options.length > 1) {
            customMCQs.push({
              type: "custom",
              question: questionText,
              options: options,
              answered: false, // Can't easily determine
            })
          }
        }
      })
    } catch (error) {
      console.error(`Error with custom selector "${selector}":`, error)
    }
  })

  return customMCQs
}

// Find MCQs using OCR
async function findMCQsWithOCR() {
  if (!ocrEnabled) return []

  const mcqs = []

  try {
    // Take a screenshot of the visible area
    const imageData = await captureScreen()

    // Send to background script for OCR
    if (typeof chrome !== "undefined" && chrome.runtime) {
      const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            action: "performOCR",
            imageData: imageData,
            language: ocrLanguage,
            detectBounds: true,
          },
          resolve,
        )
      })

      if (!result.success) {
        console.error("OCR failed:", result.error)
        return []
      }

      // Parse the OCR text to find questions and options
      const lines = result.text.split("\n").filter((line) => line.trim())

      // Look for question patterns
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()

        // Check if this line looks like a question (ends with ? or has question-like words)
        if (line.endsWith("?") || /what|which|when|where|why|how/i.test(line)) {
          const questionText = line
          const options = []

          // Look for options in the next few lines
          for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
            const optionLine = lines[j].trim()

            // Check if this line looks like an option (starts with A., B., 1., 2., etc.)
            if (/^[A-Za-z0-9][.)]\s+/.test(optionLine)) {
              // Find the corresponding element on the page
              const optionElement = findElementByText(optionLine)

              options.push({
                element: optionElement,
                text: optionLine,
              })
            }
          }

          // If we found options, add this as an MCQ
          if (options.length >= 2) {
            mcqs.push({
              type: "ocr",
              question: questionText,
              options: options,
              answered: false, // We can't easily determine if it's answered
            })

            // Skip ahead to avoid processing the same options as questions
            i += options.length
          }
        }
      }

      // Use the words with bounding boxes to find MCQs
      if (result.words && result.words.length > 0) {
        // Group words by line
        const lines = []
        let currentLine = []
        let lastTop = -1

        result.words.forEach((word) => {
          if (lastTop === -1 || Math.abs(word.bbox.y0 - lastTop) < 10) {
            // Same line
            currentLine.push(word)
          } else {
            // New line
            if (currentLine.length > 0) {
              lines.push(currentLine)
            }
            currentLine = [word]
          }

          lastTop = word.bbox.y0
        })

        if (currentLine.length > 0) {
          lines.push(currentLine)
        }

        // Look for question patterns
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          const lineText = line
            .map((word) => word.text)
            .join(" ")
            .trim()

          // Check if this line looks like a question
          if (lineText.endsWith("?") || /what|which|when|where|why|how/i.test(lineText)) {
            const questionText = lineText
            const options = []

            // Look for options in the next few lines
            for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
              const optionLine = lines[j]
              const optionText = optionLine
                .map((word) => word.text)
                .join(" ")
                .trim()

              // Check if this line looks like an option
              if (/^[A-Za-z0-9][.)]\s+/.test(optionText)) {
                // Calculate the center of the option text
                const firstWord = optionLine[0]
                const lastWord = optionLine[optionLine.length - 1]

                const centerX = (firstWord.bbox.x0 + lastWord.bbox.x1) / 2
                const centerY = (firstWord.bbox.y0 + lastWord.bbox.y1) / 2

                // Find the element at this position
                const element = document.elementFromPoint(centerX, centerY)

                options.push({
                  element: element,
                  text: optionText,
                  bbox: {
                    x0: firstWord.bbox.x0,
                    y0: firstWord.bbox.y0,
                    x1: lastWord.bbox.x1,
                    y1: lastWord.bbox.y1,
                  },
                })
              }
            }

            // If we found options, add this as an MCQ
            if (options.length >= 2) {
              mcqs.push({
                type: "ocr",
                question: questionText,
                options: options,
                answered: false,
              })

              // Skip ahead
              i += options.length
            }
          }
        }
      }
    } else {
      console.warn("Chrome runtime API not available. OCR will not be performed.")
    }
  } catch (error) {
    console.error("Error in OCR MCQ detection:", error)
  }

  return mcqs
}

// Find image-based MCQs
function findImageMCQs() {
  const imageMCQs = []

  if (!imageDetection) return imageMCQs

  try {
    // Look for common patterns of image-based MCQs

    // Pattern 1: Images inside option elements
    const optionsWithImages = document.querySelectorAll(".option img, .choice img, li img, label img")
    const imageOptionContainers = new Set()

    optionsWithImages.forEach((img) => {
      // Find the container of this image option
      const container = img.closest(".question, .mcq, .quiz-question, form, fieldset")
      if (container) {
        imageOptionContainers.add(container)
      }
    })

    // Process each container
    imageOptionContainers.forEach((container) => {
      // Find the question text
      let questionText = ""

      // Look for question text in headings, paragraphs, or divs
      const questionElements = container.querySelectorAll("h1, h2, h3, h4, h5, h6, p, div.question, .question-text")
      for (const qElement of questionElements) {
        const text = qElement.textContent.trim()
        if (text && text.length > 10) {
          questionText = text
          break
        }
      }

      // If no question found, use a generic one
      if (!questionText) {
        questionText = "Question with image options"
      }

      // Find all image options
      const imageOptions = container.querySelectorAll("img")

      if (imageOptions.length >= 2) {
        const options = Array.from(imageOptions).map((img) => {
          // Try to find text associated with this image
          let optionText = ""

          // Check alt text
          if (img.alt && img.alt.trim()) {
            optionText = img.alt.trim()
          }

          // Check parent element text
          if (!optionText && img.parentElement) {
            const parentText = img.parentElement.textContent.trim()
            if (parentText) {
              optionText = parentText
            }
          }

          // If still no text, use a generic description
          if (!optionText) {
            optionText = `Image option (${img.src.split("/").pop()})`
          }

          return {
            element: img,
            text: optionText,
            isImage: true,
            src: img.src,
          }
        })

        imageMCQs.push({
          type: "image",
          question: questionText,
          options: options,
          answered: false, // Can't easily determine
        })
      }
    })

    // Pattern 2: Question with image and text options
    const questionsWithImage = document.querySelectorAll(".question img, .quiz-question img, .stem img")

    questionsWithImage.forEach((img) => {
      // Find the container
      const container = img.closest(".question, .mcq, .quiz-question, form, fieldset")
      if (!container) return

      // Find the question text
      let questionText = ""

      // Look for question text in headings, paragraphs, or divs
      const questionElements = container.querySelectorAll("h1, h2, h3, h4, h5, h6, p, div.question, .question-text")
      for (const qElement of questionElements) {
        const text = qElement.textContent.trim()
        if (text && text.length > 10) {
          questionText = text
          break
        }
      }

      // If no question found, use the image alt or a generic one
      if (!questionText) {
        questionText = img.alt || "Question with image"
      }

      // Enhance question text to indicate it has an image
      questionText = `[Image Question] ${questionText}`

      // Find options (text-based)
      const optionElements = container.querySelectorAll(
        ".option, .choice, li, label, input[type='radio'], input[type='checkbox']",
      )

      if (optionElements.length >= 2) {
        const options = Array.from(optionElements)
          .map((optElement) => {
            // If it's an input, try to find its label
            if (optElement.tagName === "INPUT") {
              if (optElement.id) {
                const label = document.querySelector(`label[for="${optElement.id}"]`)
                if (label) {
                  return {
                    element: optElement,
                    text: label.textContent.trim(),
                  }
                }
              }

              // If no label found, use parent's text
              const parent = optElement.parentElement
              if (parent) {
                return {
                  element: optElement,
                  text: parent.textContent.trim(),
                }
              }

              // Fallback to value
              return {
                element: optElement,
                text: optElement.value || "Option",
              }
            }

            // For other elements, use their text content
            return {
              element: optElement,
              text: optElement.textContent.trim(),
            }
          })
          .filter((opt) => opt.text)

        if (options.length >= 2) {
          imageMCQs.push({
            type: "image-question",
            question: questionText,
            options: options,
            questionImage: img.src,
            answered: false, // Can't easily determine
          })
        }
      }
    })
  } catch (error) {
    console.error("Error in image MCQ detection:", error)
  }

  return imageMCQs
}

// Find math equation MCQs
function findMathMCQs() {
  const mathMCQs = []

  if (!mathDetection) return mathMCQs

  try {
    // Look for common math equation containers
    const mathContainers = document.querySelectorAll(
      ".math, .equation, .MathJax, .katex, [class*='math'], [class*='equation']",
    )

    mathContainers.forEach((mathContainer) => {
      // Find the container of this math element
      const container = mathContainer.closest(".question, .mcq, .quiz-question, form, fieldset")
      if (!container) return

      // Find the question text
      let questionText = ""

      // Look for question text in headings, paragraphs, or divs
      const questionElements = container.querySelectorAll("h1, h2, h3, h4, h5, h6, p, div.question, .question-text")
      for (const qElement of questionElements) {
        const text = qElement.textContent.trim()
        if (text && text.length > 10) {
          questionText = text
          break
        }
      }

      // If no question found, use the math container text or a generic one
      if (!questionText) {
        questionText = mathContainer.textContent.trim() || "Math equation question"
      }

      // Enhance question text to indicate it has math
      questionText = `[Math Question] ${questionText}`

      // Find options
      const optionElements = container.querySelectorAll(
        ".option, .choice, li, label, input[type='radio'], input[type='checkbox']",
      )

      if (optionElements.length >= 2) {
        const options = Array.from(optionElements)
          .map((optElement) => {
            // Check if this option contains math
            const hasMath =
              optElement.querySelector(".math, .equation, .MathJax, .katex, [class*='math'], [class*='equation']") !==
              null

            // If it's an input, try to find its label
            if (optElement.tagName === "INPUT") {
              if (optElement.id) {
                const label = document.querySelector(`label[for="${optElement.id}"]`)
                if (label) {
                  return {
                    element: optElement,
                    text: label.textContent.trim(),
                    hasMath: hasMath,
                  }
                }
              }

              // If no label found, use parent's text
              const parent = optElement.parentElement
              if (parent) {
                return {
                  element: optElement,
                  text: parent.textContent.trim(),
                  hasMath: hasMath,
                }
              }

              // Fallback to value
              return {
                element: optElement,
                text: optElement.value || "Option",
                hasMath: hasMath,
              }
            }

            // For other elements, use their text content
            return {
              element: optElement,
              text: optElement.textContent.trim(),
              hasMath: hasMath,
            }
          })
          .filter((opt) => opt.text)

        if (options.length >= 2) {
          mathMCQs.push({
            type: "math",
            question: questionText,
            options: options,
            mathElement: mathContainer,
            answered: false, // Can't easily determine
          })
        }
      }
    })

    // Also look for questions with math symbols
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
    const mathPatterns = [
      /\d+\s*[+\-×÷=<>]\s*\d+/, // Basic operations
      /$$\s*\d+\s*[+\-×÷]\s*\d+\s*$$/, // Parentheses
      /\d+\s*\/\s*\d+/, // Fractions
      /\d+\s*\^\s*\d+/, // Exponents
      /sqrt\s*$$\s*\d+\s*$$/, // Square roots
      /\d+\s*\*\s*\d+/, // Multiplication
    ]

    // Find all question-like elements
    const questionElements = document.querySelectorAll(".question, .mcq, .quiz-question, form, fieldset")

    questionElements.forEach((questionElement) => {
      // Skip if we already processed this element
      if (
        mathMCQs.some(
          (mcq) =>
            mcq.mathElement &&
            mcq.mathElement.closest(".question, .mcq, .quiz-question, form, fieldset") === questionElement,
        )
      ) {
        return
      }

      // Get the question text
      const questionText = questionElement.textContent.trim()

      // Check if it contains math symbols or patterns
      const containsMathSymbols = mathSymbols.some((symbol) => questionText.includes(symbol))
      const containsMathPatterns = mathPatterns.some((pattern) => pattern.test(questionText))

      if (containsMathSymbols || containsMathPatterns) {
        // Find options
        const optionElements = questionElement.querySelectorAll(
          ".option, .choice, li, label, input[type='radio'], input[type='checkbox']",
        )

        if (optionElements.length >= 2) {
          const options = Array.from(optionElements)
            .map((optElement) => {
              // Check if this option contains math
              const optionText = optElement.textContent.trim()
              const hasMath =
                mathSymbols.some((symbol) => optionText.includes(symbol)) ||
                mathPatterns.some((pattern) => pattern.test(optionText))

              // If it's an input, try to find its label
              if (optElement.tagName === "INPUT") {
                if (optElement.id) {
                  const label = document.querySelector(`label[for="${optElement.id}"]`)
                  if (label) {
                    return {
                      element: optElement,
                      text: label.textContent.trim(),
                      hasMath: hasMath,
                    }
                  }
                }

                // If no label found, use parent's text
                const parent = optElement.parentElement
                if (parent) {
                  return {
                    element: optElement,
                    text: parent.textContent.trim(),
                    hasMath: hasMath,
                  }
                }

                // Fallback to value
                return {
                  element: optElement,
                  text: optElement.value || "Option",
                  hasMath: hasMath,
                }
              }

              // For other elements, use their text content
              return {
                element: optElement,
                text: optionText,
                hasMath: hasMath,
              }
            })
            .filter((opt) => opt.text)

          if (options.length >= 2) {
            mathMCQs.push({
              type: "math-symbols",
              question: `[Math Question] ${questionText.substring(0, 100)}${questionText.length > 100 ? "..." : ""}`,
              options: options,
              answered: false, // Can't easily determine
            })
          }
        }
      }
    })
  } catch (error) {
    console.error("Error in math MCQ detection:", error)
  }

  return mathMCQs
}

// Find an element by its text content
function findElementByText(text) {
  // Create a text node iterator
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.textContent.trim() === text.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
  })

  // Find the first matching text node
  const textNode = walker.nextNode()

  if (textNode) {
    // Return the parent element
    return textNode.parentElement
  }

  // Try to find elements that contain this text
  const elements = Array.from(document.querySelectorAll("*")).filter((el) => el.textContent.trim() === text.trim())

  return elements[0] || null
}

// Capture the screen as a data URL
async function captureScreen() {
  return new Promise((resolve, reject) => {
    try {
      // Create a canvas element
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")

      // Set canvas dimensions to match the viewport
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight

      // Draw the current view to the canvas
      context.drawImage(document.documentElement, 0, 0, canvas.width, canvas.height)

      // Get the image data as a data URL
      const imageData = canvas.toDataURL("image/png")
      resolve(imageData)
    } catch (error) {
      reject(error)
    }
  })
}

// Process an MCQ
async function processMCQ(mcq) {
  if (!botEnabled || mcq.answered) return

  if (debugMode) {
    console.log("Processing MCQ:", mcq)
  } else {
    console.log("Processing MCQ:", mcq.question)
  }

  // Update lastMCQ
  lastMCQ = mcq

  // Send update to popup
  chrome.runtime.sendMessage({
    action: "updateLastMCQ",
    mcq: {
      question: mcq.question,
      answer: null,
    },
  })

  // Speak the question if voice narration is enabled
  if (voiceEnabled) {
    speakText(mcq.question)
  }

  // Get the options text
  const optionsText = mcq.options.map((opt) => opt.text)

  // Prepare image data for image-based questions
  let imageData = null
  if (mcq.type === "image-question" && mcq.questionImage) {
    try {
      // Fetch the image and convert to base64
      const response = await fetch(mcq.questionImage)
      const blob = await response.blob()
      imageData = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      console.error("Error fetching question image:", error)
    }
  }

  // Send to AI for prediction
  const prediction = await predictAnswer(mcq.question, optionsText, imageData)

  if (!prediction.success) {
    console.error("Failed to predict answer:", prediction.error)
    return
  }

  console.log("Predicted answer:", prediction.answer)

  // Update lastMCQ with the answer
  lastMCQ.answer = prediction.answer

  // Send update to popup
  chrome.runtime.sendMessage({
    action: "updateLastMCQ",
    mcq: {
      question: mcq.question,
      answer: prediction.answer,
    },
  })

  // Speak the answer if voice narration is enabled
  if (voiceEnabled) {
    speakText(`The answer is: ${prediction.answer}`)
  }

  // Find the matching option
  const matchingOptions = findMatchingOptions(mcq.options, prediction.answer)

  if (matchingOptions.length === 0) {
    console.error("No matching option found for:", prediction.answer)
    return
  }

  // Save to history if enabled
  if (saveHistory) {
    saveToHistory(mcq.question, prediction.answer)
  }

  // Auto-answer if enabled
  if (autoAnswer) {
    // Add a random delay to make it look more natural
    const delay = Math.random() * (maxAnswerDelay - answerDelay) + answerDelay

    setTimeout(() => {
      selectOptions(mcq, matchingOptions)

      // Update stats
      stats.answered++
      stats.accuracy = Math.round((stats.correct / stats.answered) * 100) || 0
      chrome.storage.sync.set({ stats })

      // Send stats update to popup
      chrome.runtime.sendMessage({
        action: "updateStats",
        stats: stats,
      })
    }, delay * 1000)
  }
}

// Predict answer using AI
async function predictAnswer(question, options, imageData = null) {
  return new Promise((resolve, reject) => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({
        action: "predictAnswer",
        question: question,
        options: options,
        imageData: imageData,
      }, (result) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        if (!result || !result.success) {
          reject(new Error(result ? result.error : "Unknown error"))
        } else {
          resolve(result)
        }
      })
    } else {
      console.warn("Chrome runtime API not available. Answer prediction will not be performed.")
      resolve({ success: false, error: "Chrome runtime API not available." })
    }
  })
}

// Find options that match the predicted answer
function findMatchingOptions(options, predictedAnswer) {
  const matches = []

  // Normalize the predicted answer
  const normalizedPrediction = predictedAnswer.toLowerCase().trim()

  // Check for exact matches first
  for (const option of options) {
    const normalizedOption = option.text.toLowerCase().trim()

    if (normalizedOption === normalizedPrediction) {
      matches.push(option)
    }
  }

  // If no exact matches, check for partial matches
  if (matches.length === 0) {
    for (const option of options) {
      const normalizedOption = option.text.toLowerCase().trim()

      if (normalizedOption.includes(normalizedPrediction) || normalizedPrediction.includes(normalizedOption)) {
        matches.push(option)
      }
    }
  }

  // If still no matches, check for option indicators (A, B, C, 1, 2, 3, etc.)
  if (matches.length === 0) {
    // Check for letter indicators (A, B, C, etc.)
    const letterMatch = normalizedPrediction.match(/^[a-z](\)|\.|\s|$)/)

    if (letterMatch) {
      const letterIndex = letterMatch[0].charCodeAt(0) - "a".charCodeAt(0)

      if (letterIndex >= 0 && letterIndex < options.length) {
        matches.push(options[letterIndex])
      }
    }

    // Check for number indicators (1, 2, 3, etc.)
    const numberMatch = normalizedPrediction.match(/^(\d+)(\)|\.|\s|$)/)

    if (numberMatch) {
      const numberIndex = Number.parseInt(numberMatch[1]) - 1

      if (numberIndex >= 0 && numberIndex < options.length) {
        matches.push(options[numberIndex])
      }
    }
  }

  // If still no matches, use fuzzy matching
  if (matches.length === 0) {
    let bestMatch = null
    let bestScore = 0

    for (const option of options) {
      const score = calculateSimilarity(option.text.toLowerCase(), normalizedPrediction)

      if (score > bestScore) {
        bestScore = score
        bestMatch = option
      }
    }

    if (bestMatch && bestScore > 0.5) {
      matches.push(bestMatch)
    }
  }

  return matches
}

// Calculate similarity between two strings (simple Levenshtein distance)
function calculateSimilarity(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const dp = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));
  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  // Similarity: 1 - normalized edit distance
  const maxLen = Math.max(len1, len2);
  return maxLen === 0 ? 1 : 1 - dp[len1][len2] / maxLen;
}
