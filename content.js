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
let humanMouseMovement = false

// Stats
let stats = {
  found: 0,
  answered: 0,
  correct: 0,
  accuracy: 0,
}

// Last MCQ processed
let lastMCQ = null

// Fake cursor overlay for visible simulated movement
let fakeCursor = null;
function setupFakeCursor() {
  if (fakeCursor) return;
  fakeCursor = document.createElement('div');
  fakeCursor.style.position = 'fixed';
  fakeCursor.style.width = '24px';
  fakeCursor.style.height = '24px';
  fakeCursor.style.background = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\'><polygon points=\'2,2 22,12 12,14 10,22\' fill=\'black\'/></svg>") no-repeat center/contain';
  fakeCursor.style.pointerEvents = 'none';
  fakeCursor.style.zIndex = 999999;
  fakeCursor.style.transition = 'left 0.2s, top 0.2s';
  fakeCursor.style.left = '0px';
  fakeCursor.style.top = '0px';
  document.body.appendChild(fakeCursor);
}
function moveFakeCursor(x, y) {
  if (!fakeCursor) setupFakeCursor();
  fakeCursor.style.left = x + 'px';
  fakeCursor.style.top = y + 'px';
}

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
    humanMouseMovement = result.humanMouseMovement || false

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
      injectOCRStyle();
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
      console.log("[Content] captureScreen requested");
      throttledCaptureScreen()
        .then((imageData) => {
          console.log("[Content] captureScreen success, sending to OCR");
          chrome.runtime.sendMessage(
            {
              action: "performOCR",
              imageData: imageData,
              language: ocrLanguage,
            },
            (response) => {
              console.log("[Content] OCR response:", response);
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
          console.log("[Content] captureScreen error:", error);
          sendResponse({
            success: false,
            error: error.message,
          })
        })

      return true // Indicates async response
    }

    if (message.action === "performOCR") {
      (async () => {
        try {
          console.log("[Content] Received performOCR:", message);
          const { imageData, language } = message;
          try {
            const result = await runOCRWithTesseract(imageData, language || ocrLanguage, true);
            console.log("[Content] Tesseract.js OCR result:", result);
            if (result && result.success) {
              const mcqs = parseMCQsFromOCRText(result.text);
              console.log("[Content] Parsed MCQs from OCR text:", mcqs);
              sendResponse({ success: true, text: result.text, confidence: result.confidence, mcqs });
              return;
            } else {
              throw new Error(result && result.error ? result.error : "Tesseract.js OCR failed");
            }
          } catch (err) {
            console.warn("[Content] Tesseract.js OCR failed, falling back to backend OCR:", err);
            // Fallback: Use backend OCR API
            try {
              const response = await fetch('http://localhost:5000/api/ocr-detect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_data: imageData, language: language || ocrLanguage })
              });
              const data = await response.json();
              console.log('[Content] Backend OCR response:', data);
              if (data.success) {
                sendResponse({ success: true, text: data.text || '', mcqs: data.mcqs || [] });
              } else {
                sendResponse({ success: false, error: data.error || 'Backend OCR failed.' });
              }
            } catch (serverErr) {
              console.error('[Content] Backend OCR error:', serverErr);
              sendResponse({ success: false, error: serverErr.message || String(serverErr) });
            }
          }
        } catch (err) {
          console.error('[Content] Error in performOCR handler:', err);
          sendResponse({ success: false, error: err.message || String(err) });
        }
      })();
      return true; // async
    }

    if (message.action === "getLastCaptureDataUrl") {
      sendResponse({ dataUrl: lastCaptureDataUrl });
      return true;
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

  // Use robust universal MCQ detection
  const mcqs = findAllMCQs();

  if (mcqs.length > 0) {
    if (debugMode) {
      console.log(`Found ${mcqs.length} MCQs:`, mcqs)
    } else {
      console.log(`Found ${mcqs.length} MCQs`)
    }

    // Log all MCQs and their options for debugging
    mcqs.forEach((mcq, idx) => {
      console.log(`MCQ ${idx + 1}: ${mcq.question}`);
      mcq.options.forEach((opt, oidx) => {
        console.log(`  Option ${oidx + 1}: ${opt.text}`);
      });
    });

    // Update stats
    stats.found = mcqs.length
    chrome.storage.sync.set({ stats })

    // Send stats update to popup
    chrome.runtime.sendMessage({
      action: "updateStats",
      stats: stats,
    })

    // Throttle: Use 2 seconds per MCQ to avoid captureVisibleTab quota
    mcqs.forEach((mcq, index) => {
      setTimeout(async () => {
        try {
          await processMCQ(mcq)
        } catch (error) {
          console.error("Error processing MCQ (caught):", error)
          chrome.runtime.sendMessage({ action: "aiError", error: error.message || String(error) })
        }
      }, index * 2000) // 2 seconds per MCQ
    })
  }
}

// Helper to robustly find the question text for an input
function getQuestionForInput(input) {
  // Look for heading or bold text above the input
  let node = input;
  while (node) {
    // Check previous siblings for text ending with '?'
    let prev = node.previousElementSibling;
    while (prev) {
      if (
        prev.textContent &&
        prev.textContent.trim().length > 5 &&
        prev.textContent.includes("?")
      ) {
        return prev.textContent.trim();
      }
      prev = prev.previousElementSibling;
    }
    // Check parent for question
    node = node.parentElement;
    if (
      node &&
      node.textContent &&
      node.textContent.trim().length > 5 &&
      node.textContent.includes("?")
    ) {
      return node.textContent.trim();
    }
  }
  // Fallback: look for text node above
  node = input;
  while (node && node.previousSibling) {
    if (
      node.previousSibling.nodeType === 3 &&
      node.previousSibling.textContent.trim().includes("?")
    ) {
      return node.previousSibling.textContent.trim();
    }
    node = node.previousSibling;
  }
  return "";
}

// Find MCQs on the page using multiple detection strategies
function findMCQs() {
  console.log('[MCQ] ===== Starting MCQ Detection =====');
  console.log('[MCQ] Document URL:', window.location.href);
  const mcqs = [];
  const seen = new Set();
  let detectionCount = 0;
  
  // Debug: Log basic page structure
  console.log('[MCQ] Page title:', document.title);
  console.log('[MCQ] Number of forms on page:', document.forms.length);
  console.log('[MCQ] Number of radio buttons:', document.querySelectorAll('input[type="radio"]').length);
  console.log('[MCQ] Number of checkboxes:', document.querySelectorAll('input[type="checkbox"]').length);
  console.log('[MCQ] Number of select dropdowns:', document.querySelectorAll('select').length);
  
  // Debug: Log first few form elements if they exist
  const forms = Array.from(document.forms).slice(0, 3);
  forms.forEach((form, i) => {
    console.log(`[MCQ] Form ${i + 1} ID:`, form.id || 'no-id', 'Classes:', form.className);
    console.log(`[MCQ] Form ${i + 1} elements:`, form.elements.length);
  });

  // Helper to add unique MCQs
  function addUniqueMCQ(mcq, source) {
    if (!mcq) {
      console.log(`[MCQ] ${source}: Skipping null/undefined MCQ`);
      return false;
    }
    
    if (!mcq.question) {
      console.log(`[MCQ] ${source}: Skipping MCQ with no question`);
      return false;
    }
    
    if (!mcq.options || mcq.options.length < 2) {
      console.log(`[MCQ] ${source}: Skipping MCQ with insufficient options (${mcq.options ? mcq.options.length : 0})`);
      return false;
    }
    
    const key = `${mcq.question}:${mcq.options.map(o => o.text).join(',')}`;
    if (seen.has(key)) {
      console.log(`[MCQ] ${source}: Skipping duplicate MCQ`);
      return false;
    }
    
    seen.add(key);
    mcqs.push(mcq);
    detectionCount++;
    console.log(`[MCQ] ${source}: Added MCQ with ${mcq.options.length} options`);
    return true;
  }

  // 1. Find radio button groups (single-select MCQs)
  console.log('[MCQ] 1. Looking for radio button groups...');
  const radioGroups = findRadioGroups();
  console.log(`[MCQ] Found ${radioGroups.length} radio groups`);
  radioGroups.forEach((group, i) => {
    console.log(`[MCQ] Processing radio group ${i + 1}/${radioGroups.length}`);
    addUniqueMCQ(group, 'Radio Group');
  });

  // 2. Find checkbox groups (multi-select MCQs)
  console.log('\n[MCQ] 2. Looking for checkbox groups...');
  const checkboxGroups = findCheckboxGroups();
  console.log(`[MCQ] Found ${checkboxGroups.length} checkbox groups`);
  checkboxGroups.forEach((group, i) => {
    console.log(`[MCQ] Processing checkbox group ${i + 1}/${checkboxGroups.length}`);
    addUniqueMCQ(group, 'Checkbox Group');
  });

  // 3. Find select dropdowns
  console.log('\n[MCQ] 3. Looking for select dropdowns...');
  const selectGroups = findSelectDropdowns();
  console.log(`[MCQ] Found ${selectGroups.length} select dropdowns`);
  selectGroups.forEach((group, i) => {
    console.log(`[MCQ] Processing select dropdown ${i + 1}/${selectGroups.length}`);
    addUniqueMCQ(group, 'Select Dropdown');
  });

  // 4. Find HTML patterns
  console.log('\n[MCQ] 4. Looking for HTML patterns...');
  const htmlPatterns = findHTMLPatterns();
  console.log(`[MCQ] Found ${htmlPatterns.length} HTML patterns`);
  htmlPatterns.forEach((pattern, i) => {
    console.log(`[MCQ] Processing HTML pattern ${i + 1}/${htmlPatterns.length}`);
    addUniqueMCQ(pattern, 'HTML Pattern');
  });

  // 5. Find custom MCQs
  console.log('\n[MCQ] 5. Looking for custom MCQs...');
  const customMCQs = findCustomMCQs();
  console.log(`[MCQ] Found ${customMCQs.length} custom MCQs`);
  customMCQs.forEach((mcq, i) => {
    console.log(`[MCQ] Processing custom MCQ ${i + 1}/${customMCQs.length}`);
    addUniqueMCQ(mcq, 'Custom MCQ');
  });

  console.log(`\n[MCQ] ===== MCQ Detection Complete =====`);
  console.log(`[MCQ] Total unique MCQs found: ${mcqs.length}`);
  
  // If no MCQs found, try to diagnose why
  if (mcqs.length === 0) {
    console.warn('[MCQ] WARNING: No MCQs found. Possible reasons:');
    
    // Check for iframes that might contain the questions
    const iframes = document.querySelectorAll('iframe');
    console.log(`[MCQ] Found ${iframes.length} iframes on the page`);
    if (iframes.length > 0) {
      console.warn('[MCQ] WARNING: Page contains iframes. The MCQs might be inside an iframe.');
      iframes.forEach((iframe, i) => {
        try {
          console.log(`[MCQ] Iframe ${i + 1} src:`, iframe.src || 'no-src', 
                     'sandbox:', iframe.sandbox, 
                     'srcdoc:', iframe.srcdoc ? 'has-srcdoc' : 'no-srcdoc');
        } catch (e) {
          console.log(`[MCQ] Could not access iframe ${i + 1} due to CORS`);
        }
      });
    }
    
    // Check for common question containers
    const questionContainers = document.querySelectorAll('.question, .mcq, .quiz-question, .question-text, [role="question"]');
    console.log(`[MCQ] Found ${questionContainers.length} potential question containers`);
    
    // Check for form elements that might be part of MCQs
    const formElements = document.querySelectorAll('input[type="radio"], input[type="checkbox"], select');
    console.log(`[MCQ] Found ${formElements.length} form elements that could be part of MCQs`);
    
    // Log the first few form elements for debugging
    Array.from(formElements).slice(0, 5).forEach((el, i) => {
      console.log(`[MCQ] Form element ${i + 1}:`, {
        tag: el.tagName,
        type: el.type,
        id: el.id || 'no-id',
        name: el.name || 'no-name',
        classes: el.className || 'no-class',
        parent: el.parentElement ? el.parentElement.tagName + (el.parentElement.id ? `#${el.parentElement.id}` : '') : 'no-parent'
      });
    });
  }
  
  console.log('[MCQ] MCQs found:', mcqs);
  return mcqs;
}

// Enhanced radio button group detection with better question and option extraction
function findRadioGroups() {
  console.log('[MCQ] ===== Starting Radio Group Detection =====');
  const radioGroups = [];
  const radioButtons = Array.from(document.querySelectorAll('input[type="radio"]'));
  console.log(`[MCQ] Found ${radioButtons.length} radio buttons`);
  
  if (radioButtons.length === 0) {
    console.warn('[MCQ] WARNING: No radio buttons found on the page');
    return [];
  }
  
  // Debug: Log first few radio buttons
  radioButtons.slice(0, 3).forEach((radio, i) => {
    console.log(`[MCQ] Radio button ${i + 1}:`, {
      id: radio.id || 'no-id',
      name: radio.name || 'no-name',
      value: radio.value || 'no-value',
      form: radio.form ? (radio.form.id || 'form-no-id') : 'no-form',
      parent: radio.parentElement ? radio.parentElement.tagName : 'no-parent',
      classes: radio.className || 'no-classes'
    });
  });
  
  const processedGroups = new Set();

  // Group radio buttons by name and form context
  const groupedRadios = {};
  console.log('[MCQ] Grouping radio buttons by name and form...');
  radioButtons.forEach((radio) => {
    const name = radio.name;
    if (!name) return;
    const formId = radio.form ? radio.form.id || 'no-form' : 'no-form';
    const groupKey = `${formId}:${name}`;
    
    if (!groupedRadios[groupKey]) {
      groupedRadios[groupKey] = [];
    }
    groupedRadios[groupKey].push(radio);
  });

  // Process each group
  const groupKeys = Object.keys(groupedRadios);
  console.log(`[MCQ] Found ${groupKeys.length} radio groups`);
  
  if (groupKeys.length === 0) {
    console.warn('[MCQ] WARNING: No valid radio groups found (all groups have < 2 options)');
  }
  
  for (const [groupKey, radios] of Object.entries(groupedRadios)) {
    console.log(`\n[MCQ] Processing group "${groupKey}" with ${radios.length} radios`);
    
    if (radios.length < 2) {
      console.warn(`[MCQ] WARNING: Group "${groupKey}" has only ${radios.length} radio button(s) (needs at least 2)`);
      continue;
    }
    
    // Debug: Log first radio in group
    const firstRadio = radios[0];
    console.log('[MCQ] First radio in group:', {
      id: firstRadio.id || 'no-id',
      name: firstRadio.name || 'no-name',
      value: firstRadio.value || 'no-value',
      form: firstRadio.form ? (firstRadio.form.id || 'form-no-id') : 'no-form'
    });
    const groupId = `radio-group-${groupKey}`;
    if (processedGroups.has(groupId)) continue;
    processedGroups.add(groupId);

    // Find the question text using multiple strategies
    console.log('[MCQ] Looking for question text...');
    let questionText = findQuestionText(firstRadio, {
      questionMarkRequired: true,
      minLength: 5,
      maxSiblingDepth: 5,
      searchParents: true
    });
    console.log('[MCQ] Found question text:', questionText ? questionText.substring(0, 50) + '...' : 'none');

    // Get options with better text extraction
    const options = [];
    const seenOptions = new Set();
    console.log('[MCQ] Extracting options...');
    
    for (const radio of radios) {
      // Skip duplicates (same value)
      if (seenOptions.has(radio.value)) {
        console.log('[MCQ] Skipping duplicate option with value:', radio.value);
        continue;
      }
      
      let optionText = extractOptionText(radio);
      console.log('[MCQ] Raw option text:', optionText);
      if (!optionText) {
        console.log('[MCQ] No text found for radio:', radio);
        continue;
      }
      
      // Clean up option text
      const originalText = optionText;
      optionText = optionText
        .replace(/^\s*[A-Za-z0-9][.)]\s*/, '')  // Remove A), 1., etc.
        .replace(/^[\s•○●▪■□◻◼◽◾⬜⬛]\s*/, '')  // Remove bullet points
        .trim();
      
      console.log('[MCQ] Cleaned option text:', optionText, '(from:', originalText + ')');
      
      if (!optionText) {
        console.log('[MCQ] Empty option text after cleaning');
        continue;
      }
      
      if (seenOptions.has(optionText)) {
        console.log('[MCQ] Skipping duplicate option text:', optionText);
        continue;
      }
      
      seenOptions.add(optionText);
      options.push({
        element: radio,
        text: optionText,
        value: radio.value
      });
    }

    // Only add if we have a valid question and at least 2 options
    if (questionText && options.length >= 2) {
      radioGroups.push({
        type: 'radio',
        question: questionText,
        options,
        answered: radios.some(r => r.checked),
        source: 'radio-group',
        groupId
      });
    }
  }

  console.log(`[MCQ] Radio group detection complete. Found ${radioGroups.length} valid groups`);
  return radioGroups;
}

// Helper function to extract question text from an input element
function findQuestionText(element, options = {}) {
  console.log('[MCQ] findQuestionText called for element:', element);
  
  const defaults = {
    questionMarkRequired: true,
    minLength: 5,
    maxSiblingDepth: 5,
    searchParents: true,
    searchSiblings: true
  };
  const settings = { ...defaults, ...options };
  console.log('[MCQ] findQuestionText settings:', settings);
  
  // Check if element is valid
  if (!element || !element.nodeType || element.nodeType !== Node.ELEMENT_NODE) {
    console.log('[MCQ] Invalid element provided');
    return '';
  }
  
  let questionText = '';
  let source = '';
  
  // 1. Check for data-question attribute
  if (element.hasAttribute('data-question')) {
    questionText = element.getAttribute('data-question').trim();
    console.log('[MCQ] Found data-question attribute:', questionText);
    if (questionText && (!settings.questionMarkRequired || questionText.includes('?'))) {
      console.log('[MCQ] Using data-question as question text');
      return questionText;
    }
  }
  
  // 2. Check for aria-label or aria-labelledby
  if (!questionText) {
    if (element.hasAttribute('aria-label')) {
      questionText = element.getAttribute('aria-label').trim();
      source = 'aria-label';
      console.log(`[MCQ] Found aria-label: ${questionText}`);
    } else if (element.hasAttribute('aria-labelledby')) {
      const labelId = element.getAttribute('aria-labelledby');
      const labelElement = document.getElementById(labelId);
      if (labelElement) {
        questionText = labelElement.textContent.trim();
        source = 'aria-labelledby';
        console.log(`[MCQ] Found aria-labelledby (${labelId}): ${questionText}`);
      }
    }
    
    if (questionText && (!settings.questionMarkRequired || questionText.includes('?'))) {
      console.log(`[MCQ] Using ${source} as question text`);
      return questionText;
    }
  }
  
  // 3. Check for associated label
  if (!questionText && element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) {
      questionText = label.textContent.trim();
      console.log('[MCQ] Found associated label:', questionText);
      if (questionText && (!settings.questionMarkRequired || questionText.includes('?'))) {
        console.log('[MCQ] Using associated label as question text');
        return questionText;
      }
    } else {
      console.log(`[MCQ] No label found for element with id: ${element.id}`);
    }
  } else if (!element.id) {
    console.log('[MCQ] Element has no ID, cannot look up by label[for]');
  }
  
  // 4. Check parent elements for question text
  if (settings.searchParents) {
    console.log('[MCQ] Searching parent elements for question text...');
    let current = element.parentElement;
    let depth = 0;
    
    while (current && depth < 10) {
      console.log(`[MCQ] Checking parent ${depth}:`, current.tagName, current.className);
      
      // Check for common question containers
      if (current.matches && 
          (current.matches('.question, .mcq, .quiz-question, .question-text, [role="heading"], h1, h2, h3, h4, h5, h6, p, div') ||
           current.getAttribute('aria-label') ||
           current.getAttribute('aria-labelledby'))) {
        
        let text = current.textContent.trim();
        console.log(`[MCQ] Found potential container with text (${text.length} chars):`, text.substring(0, 100) + (text.length > 100 ? '...' : ''));
        
        // Clean up text
        text = text.replace(/\s+/g, ' ');
        
        // Check if text looks like a question
        if (text.length >= settings.minLength) {
          const hasQuestionMark = text.includes('?');
          const isReasonableLength = text.length < 200 || hasQuestionMark;
          
          console.log(`[MCQ] Text check - Length: ${text.length}, Has ?: ${hasQuestionMark}, Reasonable: ${isReasonableLength}`);
          
          if ((!settings.questionMarkRequired || hasQuestionMark) && isReasonableLength) {
            questionText = text;
            source = `parent ${depth} (${current.tagName}${current.id ? '#' + current.id : ''}${current.className ? '.' + current.className.replace(/\s+/g, '.') : ''})`;
            console.log(`[MCQ] Using text from ${source}: ${text.substring(0, 50)}...`);
            break;
          }
        }
      }
      
      current = current.parentElement;
      depth++;
    }
  }
  
  // 5. Check previous siblings for question text
  if (!questionText && settings.searchSiblings) {
    console.log('[MCQ] Searching previous siblings for question text...');
    let current = element.previousElementSibling;
    let depth = 0;
    
    while (current && depth < settings.maxSiblingDepth) {
      console.log(`[MCQ] Checking sibling ${depth}:`, current.tagName, current.className);
      
      let text = current.textContent.trim();
      console.log(`[MCQ] Sibling text (${text.length} chars):`, text.substring(0, 100) + (text.length > 100 ? '...' : ''));
      
      text = text.replace(/\s+/g, ' ');
      
      if (text.length >= settings.minLength) {
        const hasQuestionMark = text.includes('?');
        const isReasonableLength = text.length < 200 || hasQuestionMark;
        
        console.log(`[MCQ] Sibling text check - Length: ${text.length}, Has ?: ${hasQuestionMark}, Reasonable: ${isReasonableLength}`);
        
        if ((!settings.questionMarkRequired || hasQuestionMark) && isReasonableLength) {
          questionText = text;
          source = `sibling ${depth} (${current.tagName}${current.id ? '#' + current.id : ''}${current.className ? '.' + current.className.replace(/\s+/g, '.') : ''})`;
          console.log(`[MCQ] Using text from ${source}: ${text.substring(0, 50)}...`);
          break;
        }
      }
      
      current = current.previousElementSibling;
      depth++;
    }
  }

  // 6. Check for data-question attribute
  const dataQuestion = element.closest('[data-question]');
  if (dataQuestion) {
    const text = dataQuestion.getAttribute('data-question');
    if (isQuestionLike(text)) return text;
  }

  return '';
}

// Enhanced option text extraction with detailed debugging
function extractOptionText(input) {
  console.log('[MCQ] extractOptionText called for input:', input);
  
  if (!input) {
    console.log('[MCQ] No input element provided');
    return '';
  }
  
  let optionText = '';
  let source = '';
  
  // 1. Check for associated label (for attribute)
  if (input.id) {
    const selector = `label[for="${input.id}"]`;
    console.log(`[MCQ] Looking for label with selector: ${selector}`);
    const label = document.querySelector(selector);
    
    if (label) {
      optionText = label.textContent.trim();
      source = 'label[for]';
      console.log(`[MCQ] Found label[for]: "${optionText}"`);
    } else {
      console.log(`[MCQ] No label found with selector: ${selector}`);
    }
  } else {
    console.log('[MCQ] Input has no ID, cannot look up by label[for]');
  }
  
  // 2. Check if input is inside a label
  if (!optionText && input.parentElement && input.parentElement.tagName === 'LABEL') {
    const parentText = input.parentElement.textContent.trim();
    const inputValue = input.value || '';
    optionText = parentText.replace(inputValue, '').trim();
    source = 'parent label text';
    console.log(`[MCQ] Found parent label text: "${optionText}"`);
  }
  
  // 3. Check for sibling label
  if (!optionText && input.parentElement) {
    console.log('[MCQ] Looking for sibling labels...');
    const labels = input.parentElement.querySelectorAll('label');
    console.log(`[MCQ] Found ${labels.length} sibling labels`);
    
    for (const label of labels) {
      const text = label.textContent.trim();
      if (text) {
        optionText = text;
        source = 'sibling label';
        console.log(`[MCQ] Using sibling label: "${optionText}"`);
        break;
      }
    }
  }
  
  // 4. Check for aria-label or title
  if (!optionText) {
    const ariaLabel = input.getAttribute('aria-label');
    if (ariaLabel) {
      optionText = ariaLabel.trim();
      source = 'aria-label';
      console.log(`[MCQ] Using aria-label: "${optionText}"`);
    } else {
      const title = input.getAttribute('title');
      if (title) {
        optionText = title.trim();
        source = 'title';
        console.log(`[MCQ] Using title: "${optionText}"`);
      }
    }
  }
  
  // 5. Check for value attribute
  if (!optionText && input.value) {
    optionText = input.value.trim();
    source = 'value attribute';
    console.log(`[MCQ] Using value: "${optionText}"`);
  }
  
  // 6. Check for text content in parent or nearby elements
  if (!optionText && input.parentElement) {
    console.log('[MCQ] Looking for text in parent elements...');
    
    // Try to find the closest text node that might contain the option text
    let currentNode = input;
    let depth = 0;
    
    while (currentNode && depth < 3) { // Limit depth to prevent going too far
      const text = currentNode.textContent.trim();
      if (text && text.length > 0) {
        // Try to extract just the relevant part of the text
        const lines = text.split(/\n/).map(line => line.trim()).filter(line => line.length > 0);
        if (lines.length > 0) {
          optionText = lines[0];
          source = `parent text (depth ${depth})`;
          console.log(`[MCQ] Using text from ${source}: "${optionText}"`);
          break;
        }
      }
      
      if (currentNode.parentElement) {
        currentNode = currentNode.parentElement;
        depth++;
      } else {
        break;
      }
    }
  }
  
  // Clean up the extracted text
  if (optionText) {
    const originalText = optionText;
    
    // Remove common prefixes like A), 1., •, etc.
    optionText = optionText
      .replace(/^\s*[A-Za-z0-9][.)]\s*/, '')  // A), 1., etc.
      .replace(/^[\s•○●▪■□◻◼◽◾⬜⬛]\s*/, '')  // Bullet points
      .replace(/^[-*]\s*/, '')                // Dashes and asterisks
      .replace(/^\s+/, '')                    // Leading whitespace
      .replace(/\s+$/, '')                    // Trailing whitespace
      .replace(/\s+/g, ' ');                  // Multiple spaces
    
    if (optionText !== originalText) {
      console.log(`[MCQ] Cleaned option text: "${originalText}" -> "${optionText}"`);
    }
  }
  
  if (optionText) {
    console.log(`[MCQ] Extracted option text (${source}): "${optionText}"`);
  } else {
    console.log('[MCQ] Could not extract option text');
  }
  
  return optionText || '';
}

// Enhanced checkbox group detection with better container and option handling
function findCheckboxGroups() {
  console.log('\n[MCQ] ===== Starting Checkbox Group Detection =====');
  const checkboxGroups = [];
  const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
  console.log(`[MCQ] Found ${checkboxes.length} checkboxes`);
  
  if (checkboxes.length === 0) {
    console.warn('[MCQ] WARNING: No checkboxes found on the page');
    return [];
  }
  
  // Debug: Log first few checkboxes
  checkboxes.slice(0, 3).forEach((cb, i) => {
    console.log(`[MCQ] Checkbox ${i + 1}:`, {
      id: cb.id || 'no-id',
      name: cb.name || 'no-name',
      value: cb.value || 'no-value',
      form: cb.form ? (cb.form.id || 'form-no-id') : 'no-form',
      parent: cb.parentElement ? cb.parentElement.tagName : 'no-parent',
      classes: cb.className || 'no-classes'
    });
  });
  
  const processedGroups = new Set();
  console.log('[MCQ] Looking for checkbox containers...');

  // Find all potential container elements
  const containerSelectors = [
    'form', 'fieldset', '.question', '.mcq', '.quiz-question',
    '.question-container', '.mcq-container', '.quiz-container',
    '[role="group"]', '.form-group', '.options-container'
  ];

  // Group checkboxes by their container
  const containerMap = new Map();
  
  checkboxes.forEach(checkbox => {
    // Find the closest container or create a virtual one for standalone checkboxes
    let container = null;
    for (const selector of containerSelectors) {
      const candidate = checkbox.closest(selector);
      if (candidate) {
        container = candidate;
        break;
      }
    }
    
    // If no container found, use a virtual container based on proximity
    if (!container) {
      container = findVirtualContainer(checkbox, checkboxes);
    }
    
    if (!containerMap.has(container)) {
      containerMap.set(container, []);
    }
    containerMap.get(container).push(checkbox);
  });

  // Process each container
  console.log(`[MCQ] Found ${containerMap.size} checkbox containers`);
  let containerIndex = 0;
  
  if (containerMap.size === 0) {
    console.warn('[MCQ] WARNING: No valid checkbox containers found');
    // Try to find any potential container with checkboxes
    const potentialContainers = {};
    checkboxes.forEach(cb => {
      let parent = cb.parentElement;
      for (let i = 0; i < 5 && parent; i++) { // Check up to 5 levels up
        const containerId = parent.id || parent.className || parent.tagName;
        if (!potentialContainers[containerId]) {
          potentialContainers[containerId] = [];
        }
        potentialContainers[containerId].push(cb);
        parent = parent.parentElement;
      }
    });
    
    // Log potential containers with multiple checkboxes
    Object.entries(potentialContainers).forEach(([id, cbs]) => {
      if (cbs.length > 1) {
        console.warn(`[MCQ] Potential container with ${cbs.length} checkboxes:`, id);
      }
    });
  }
  
  for (const [container, containerCheckboxes] of containerMap.entries()) {
    containerIndex++;
    console.log(`\n[MCQ] Processing container ${containerIndex}/${containerMap.size}`);
    
    if (!container) {
      console.warn('[MCQ] WARNING: Found null container');
      continue;
    }
    
    console.log('[MCQ] Container element:', {
      tag: container.tagName,
      id: container.id || 'no-id',
      classes: container.className || 'no-classes',
      'data-* attributes': Object.fromEntries(
        Array.from(container.attributes || [])
          .filter(attr => attr.name.startsWith('data-'))
          .map(attr => [attr.name, attr.value])
      )
    });
    
    if (containerCheckboxes.length < 2) {
      console.warn(`[MCQ] WARNING: Container has only ${containerCheckboxes.length} checkbox(es) (needs at least 2)`);
      continue;
    }
    
    const containerId = container.id || container.className || 'container-' + Math.random().toString(36).substr(2, 9);
    if (processedGroups.has(containerId)) continue;
    processedGroups.add(containerId);

    // Find the question text using multiple strategies
    const firstCheckbox = containerCheckboxes[0];
    console.log('[MCQ] Looking for question text in container...');
    let questionText = findQuestionText(firstCheckbox, {
      questionMarkRequired: false,  // Checkbox questions might not end with ?
      minLength: 5,
      maxSiblingDepth: 5,
      searchParents: true
    });

    // If no question found, try to find a common question pattern
    if (!questionText) {
      console.log('[MCQ] No question found near first checkbox, trying common patterns...');
      questionText = findCommonQuestionText(container, containerCheckboxes);
    }
    
    console.log('[MCQ] Found question text:', questionText ? questionText.substring(0, 50) + '...' : 'none');

    // Get options with better text extraction
    const options = [];
    const seenOptions = new Set();
    console.log('[MCQ] Extracting options from checkboxes...');
    
    for (const checkbox of containerCheckboxes) {
      let optionText = extractOptionText(checkbox);
      console.log('[MCQ] Raw checkbox text:', optionText);
      if (!optionText) {
        console.log('[MCQ] No text found for checkbox:', checkbox);
        continue;
      }
      
      // Clean up option text
      const originalText = optionText;
      optionText = optionText
        .replace(/^\s*[A-Za-z0-9][.)]\s*/, '')  // Remove A), 1., etc.
        .replace(/^[\s•○●▪■□◻◼◽◾⬜⬛]\s*/, '')  // Remove bullet points
        .trim();
      
      console.log('[MCQ] Cleaned option text:', optionText, '(from:', originalText + ')');
      
      // Skip empty or duplicate options
      if (!optionText) {
        console.log('[MCQ] Empty option text after cleaning');
        continue;
      }
      
      if (seenOptions.has(optionText)) {
        console.log('[MCQ] Skipping duplicate option text:', optionText);
        continue;
      }
      
      seenOptions.add(optionText);
      options.push({
        element: checkbox,
        text: optionText,
        value: checkbox.value
      });
    }

    // Only add if we have a valid question and at least 2 options
    if (questionText && options.length >= 2) {
      checkboxGroups.push({
        type: 'checkbox',
        question: questionText,
        options,
        answered: containerCheckboxes.some(cb => cb.checked),
        source: 'checkbox-group',
        containerId
      });
    }
  }

  console.log(`[MCQ] Checkbox group detection complete. Found ${checkboxGroups.length} valid groups`);
  return checkboxGroups;
}

// Find a virtual container for checkboxes that aren't in a clear container
function findVirtualContainer(checkbox, allCheckboxes) {
  // Create a virtual container for this checkbox
  const virtualContainer = document.createElement('div');
  virtualContainer.className = 'mcq-virtual-container';
  
  // Find nearby checkboxes (within 3 levels up and down in the DOM)
  const nearbyCheckboxes = [checkbox];
  let parent = checkbox.parentElement;
  let depth = 0;
  
  // Look for sibling checkboxes
  while (parent && depth < 3) {
    const siblings = Array.from(parent.children).filter(el => 
      el.tagName === 'INPUT' && el.type === 'checkbox' && 
      !nearbyCheckboxes.includes(el) && 
      allCheckboxes.includes(el)
    );
    
    nearbyCheckboxes.push(...siblings);
    parent = parent.parentElement;
    depth++;
  }
  
  // If we found multiple checkboxes, use them as a group
  if (nearbyCheckboxes.length > 1) {
    nearbyCheckboxes.forEach(cb => virtualContainer.appendChild(cb.cloneNode(true)));
    return virtualContainer;
  }
  
  return null;
}

// Find common question text for a group of checkboxes
function findCommonQuestionText(container, checkboxes) {
  // Get all text nodes in the container
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    const text = node.textContent.trim();
    if (text && text.length > 10) {
      textNodes.push({
        node,
        text,
        depth: getNodeDepth(node)
      });
    }
  }
  
  // Sort by depth (shallow first)
  textNodes.sort((a, b) => a.depth - b.depth);
  
  // Look for text that appears before all checkboxes
  const firstCheckbox = checkboxes[0];
  for (const {node, text} of textNodes) {
    if (node.compareDocumentPosition(firstCheckbox) & Node.DOCUMENT_POSITION_FOLLOWING) {
      return text;
    }
  }
  
  // Fallback: use container text
  return container.textContent.trim().split('\n')[0] || '';
}

// Helper to get node depth in the DOM tree
function getNodeDepth(node) {
  let depth = 0;
  while (node.parentNode) {
    depth++;
    node = node.parentNode;
  }
  return depth;
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

// Helper to robustly extract option text for checkboxes/radios
function extractOptionText(input) {
  let optionText = '';
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) optionText = label.textContent.trim();
  }
  if (!optionText) {
    const parentLabel = input.closest('label');
    if (parentLabel) optionText = parentLabel.textContent.trim();
  }
  if (!optionText && input.nextSibling && input.nextSibling.nodeType === Node.TEXT_NODE) {
    optionText = input.nextSibling.textContent.trim();
  }
  if (!optionText && input.parentElement) optionText = input.parentElement.textContent.trim();
  // If input is an image
  if (!optionText && input.type === 'image') {
    optionText = input.alt || input.src || '';
  }
  return optionText;
}

// Find MCQs using custom selectors
function findCustomMCQs() {
  const mcqs = []
  if (!customSelectors) return mcqs
  const containers = document.querySelectorAll(customSelectors)
  containers.forEach(container => {
    let questionText = ''
    // Try to find question in headings, labels, b, span
    const questionEl = container.querySelector('h1, h2, h3, h4, h5, h6, .question, .question-text, .quiz-question, .mcq-question, label, b, span')
    if (questionEl) questionText = questionEl.textContent.trim()
    // Fallback: check for <b>, <span>, or text node above first option
    const firstOption = container.querySelector('input[type="radio"], input[type="checkbox"]')
    if (!questionText && firstOption) {
      let node = firstOption.previousSibling
      for (let i = 0; i < 5 && node; i++) {
        if (node.nodeType === Node.ELEMENT_NODE && (node.tagName === 'B' || node.tagName === 'SPAN')) {
          questionText = node.textContent.trim()
            break
          }
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 5) {
          questionText = node.textContent.trim()
          break
        }
        node = node.previousSibling
      }
    }
    if (!questionText) questionText = container.textContent.trim().split('\n')[0]
    const options = Array.from(container.querySelectorAll('input[type="radio"], input[type="checkbox"]')).map(input => {
      return { element: input, text: extractOptionText(input) }
            })
    if (questionText && options.some(opt => opt.text)) {
      mcqs.push({
        type: options[0]?.element.type || 'unknown',
              question: questionText,
        options: options.filter(opt => opt.text),
        answered: options.some(opt => opt.element.checked),
      })
    }
  })
  return mcqs
}

// --- Global throttling for screen capture ---
let lastCaptureTime = 0;
const MIN_CAPTURE_INTERVAL = 1200; // 1.2 seconds
async function throttledCaptureScreen() {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    const timeSinceLast = now - lastCaptureTime;
    const doCapture = () => {
      lastCaptureTime = Date.now();
      captureScreen().then((dataUrl) => {
        lastCaptureDataUrl = dataUrl;
        resolve(dataUrl);
      }).catch(reject);
    };
    if (timeSinceLast >= MIN_CAPTURE_INTERVAL) {
      doCapture();
    } else {
      setTimeout(doCapture, MIN_CAPTURE_INTERVAL - timeSinceLast);
    }
  });
}

// --- TESSERACT.JS INJECTION UTILITY ---
async function ensureTesseractLoaded() {
  if (window.Tesseract) return true;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('tesseract.min.js');
    script.onload = () => {
      if (window.Tesseract) resolve(true);
      else {
        console.error('[MCQ-BOT] Tesseract.js failed to load after script injection.');
        chrome.runtime.sendMessage({ action: 'ocrError', error: 'Tesseract.js failed to load.' });
        reject(new Error('Tesseract.js failed to load'));
      }
    };
    script.onerror = () => {
      console.error('[MCQ-BOT] Failed to inject Tesseract.js script.');
      chrome.runtime.sendMessage({ action: 'ocrError', error: 'Failed to inject Tesseract.js script.' });
      reject(new Error('Failed to load Tesseract.js'));
    };
    document.head.appendChild(script);
  });
}

// Enhanced runOCRWithTesseract with better error handling
async function runOCRWithTesseract(imageData, language = "eng", detectBounds = true) {
  await ensureTesseractLoaded();
  if (!window.Tesseract) {
    chrome.runtime.sendMessage({ action: 'ocrError', error: 'Tesseract.js is not loaded in content script.' });
    throw new Error("Tesseract.js is not loaded in content script.");
  }
  if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image')) {
    chrome.runtime.sendMessage({ action: 'ocrError', error: 'Invalid image data for OCR.' });
    throw new Error('Invalid image data for OCR.');
  }
  let worker;
  try {
    worker = await window.Tesseract.createWorker();
    await worker.loadLanguage(language);
    await worker.initialize(language);
    const { data } = await worker.recognize(imageData);
    const result = {
      success: true,
      text: data.text,
      confidence: data.confidence,
    };
    if (detectBounds) {
      const { data: boxData } = await worker.recognize(imageData, {
        rectangle: { top: 0, left: 0, width: 0, height: 0 },
      });
      result.words = boxData.words;
      result.lines = boxData.lines;
      result.paragraphs = boxData.paragraphs;
    }
    await worker.terminate();
    return result;
  } catch (err) {
    if (worker) await worker.terminate();
    chrome.runtime.sendMessage({ action: 'ocrError', error: '[MCQ-BOT] Tesseract.js error: ' + err.message });
    throw err;
  }
}

// Enhanced findMCQsWithOCR with more robust fallback and error logging
async function findMCQsWithOCR() {
  if (!ocrEnabled) return [];
  const mcqs = [];
  try {
    const imageData = await captureScreen();
    chrome.runtime.sendMessage({ action: "ocrError", error: "[MCQ-BOT] Image data captured." });
    let result = null;
    try {
      await ensureTesseractLoaded();
      if (window.Tesseract) {
        result = await runOCRWithTesseract(imageData, ocrLanguage, true);
        chrome.runtime.sendMessage({ action: "ocrError", error: `[MCQ-BOT] Tesseract.js result: ${result && result.success ? 'Success' : 'Error'}${result && result.error ? ' - ' + result.error : ''}` });
      }
    } catch (e) {
      chrome.runtime.sendMessage({ action: "ocrError", error: `[MCQ-BOT] Tesseract.js error: ${e.message}` });
      try {
        const response = await fetch('http://localhost:8000/api/ocr-detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_data: imageData })
        });
        const data = await response.json();
        chrome.runtime.sendMessage({ action: "ocrError", error: `[MCQ-BOT] Backend OCR result: ${data && data.success ? 'Success' : 'Error'}${data && data.error ? ' - ' + data.error : ''}` });
        if (data.success && data.mcqs) return data.mcqs;
        chrome.runtime.sendMessage({ action: "ocrError", error: data.error || "Server OCR failed." });
        return [];
      } catch (serverErr) {
        chrome.runtime.sendMessage({ action: "ocrError", error: `[MCQ-BOT] Backend unreachable or error: ${serverErr.message}` });
        return [];
      }
    }
    if (!result || !result.success) {
      chrome.runtime.sendMessage({ action: "ocrError", error: result && result.error ? result.error : "OCR failed." });
      return [];
    }
    // ... (rest of your MCQ extraction logic from OCR text)
    const lines = result.text.split("\n").filter((line) => line.trim());
      // Look for question patterns
      for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
        if (line.endsWith("?") || /what|which|when|where|why|how/i.test(line)) {
        const questionText = line;
        const options = [];
          for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          const optionLine = lines[j].trim();
            if (/^[A-Za-z0-9][.)]\s+/.test(optionLine)) {
            const optionElement = findElementByText(optionLine);
              options.push({
                element: optionElement,
                text: optionLine,
            });
            }
          }
          if (options.length >= 2) {
            mcqs.push({
              type: "ocr",
              question: questionText,
              options: options,
            answered: false,
          });
          i += options.length;
          }
        }
      }
    // ... (rest of your MCQ extraction logic from OCR bounding boxes, if needed)
      if (result.words && result.words.length > 0) {
        // Group words by line
      const lines = [];
      let currentLine = [];
      let lastTop = -1;
        result.words.forEach((word) => {
          if (lastTop === -1 || Math.abs(word.bbox.y0 - lastTop) < 10) {
            currentLine.push(word)
          } else {
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
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
        const lineText = line.map((word) => word.text).join(" ").trim()
          if (lineText.endsWith("?") || /what|which|when|where|why|how/i.test(lineText)) {
            const questionText = lineText
            const options = []
            for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
              const optionLine = lines[j]
            const optionText = optionLine.map((word) => word.text).join(" ").trim()
              if (/^[A-Za-z0-9][.)]\s+/.test(optionText)) {
                const firstWord = optionLine[0]
                const lastWord = optionLine[optionLine.length - 1]
                const centerX = (firstWord.bbox.x0 + lastWord.bbox.x1) / 2
                const centerY = (firstWord.bbox.y0 + lastWord.bbox.y1) / 2
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
            if (options.length >= 2) {
              mcqs.push({
                type: "ocr",
                question: questionText,
                options: options,
                answered: false,
              })
              i += options.length
            }
          }
        }
    }
  } catch (error) {
    chrome.runtime.sendMessage({ action: "ocrError", error: error.message || "Error in OCR MCQ detection." });
  }
  return mcqs;
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

// Robust screen capture function
async function captureScreen() {
  return new Promise((resolve, reject) => {
    if (window.location.protocol === 'file:') {
      const msg = 'Screen capture will fail on file:// URLs. Please use http://localhost/ or a real server.';
      sendPopupMessage({ action: "ocrError", error: msg });
      reject(new Error(msg));
      return;
    }
    chrome.runtime.sendMessage({ action: "captureTabScreenshot", timestamp: Date.now() }, (response) => {
      if (chrome.runtime.lastError) {
        const msg = "Screen capture failed: " + chrome.runtime.lastError.message;
        sendPopupMessage({ action: "ocrError", error: msg });
        reject(new Error(msg));
        return;
      }
      if (!response || !response.success || !response.dataUrl) {
        const msg = "Capture failed: " + (response && response.error ? response.error : "No image data received from capture");
        sendPopupMessage({ action: "ocrError", error: msg });
        reject(new Error(msg));
        return;
      }
      resolve(response.dataUrl);
    });
  });
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

  // Send to AI for prediction (with error handling)
  let prediction = null
  try {
    prediction = await predictAnswer(mcq.question, optionsText, imageData)
  } catch (error) {
    console.error("Failed to predict answer (caught):", error)
    chrome.runtime.sendMessage({ action: "aiError", error: error.message || String(error) })
    return
  }

  if (!prediction.success) {
    console.error("Failed to predict answer:", prediction.error)
    chrome.runtime.sendMessage({ action: "aiError", error: prediction.error || "Unknown error" })
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
        try {
        if (chrome.runtime && chrome.runtime.lastError) {
            if (typeof chrome !== "undefined" && chrome.runtime) {
              chrome.runtime.sendMessage({
                action: "aiError",
                error: chrome.runtime.lastError.message
              });
            }
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        if (!result || !result.success) {
            if (typeof chrome !== "undefined" && chrome.runtime) {
              chrome.runtime.sendMessage({
                action: "aiError",
                error: result ? result.error : "Unknown error"
              });
            }
          reject(new Error(result ? result.error : "Unknown error"))
        } else {
          resolve(result)
          }
        } catch (err) {
          reject(err)
        }
      })
    } else {
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage({
          action: "aiError",
          error: "Chrome runtime API not available."
        });
      }
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

// In findMCQs, call the new methods:
function findFallbackMCQs() {
  const mcqs = []
  const inputs = document.querySelectorAll('input[type="radio"], input[type="checkbox"]')
  const seen = new Set()
  inputs.forEach(input => {
    if (seen.has(input)) return
    let group = [input]
    let parent = input.parentElement
    // Try to find siblings of the same type
    if (parent) {
      const siblings = parent.querySelectorAll('input[type="radio"], input[type="checkbox"]')
      siblings.forEach(sib => { if (!seen.has(sib)) group.push(sib); });
    }
    group.forEach(i => seen.add(i));
    // Try to find question text above
    let questionText = ''
    let node = input
    for (let i = 0; i < 3 && node; i++) {
      node = node.previousSibling
      if (node && node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 5) {
        questionText = node.textContent.trim()
        break
      }
    }
    if (!questionText && parent) questionText = parent.textContent.trim().split('\n')[0]
    const options = group.map(i => ({ element: i, text: extractOptionText(i) }))
    if (questionText && options.some(opt => opt.text)) {
      mcqs.push({
        type: input.type,
        question: questionText,
        options: options.filter(opt => opt.text),
        answered: group.some(i => i.checked),
      })
    }
  })
  return mcqs
}

// Helper for focus and capture
function focusAndCaptureTabScreenshot(tabId, windowId, callback) {
  if (typeof chrome !== "undefined" && chrome.runtime) {
    chrome.runtime.sendMessage({
      action: "focusAndCaptureTabScreenshot",
      tabId: tabId,
      windowId: windowId
    }, (response) => {
      callback(response);
    });
  } else {
    callback({ success: false, error: "Chrome runtime API not available." });
  }
}

// Example: Add to settings UI (pseudo-code, integrate with your actual UI logic)
// <label><input type="checkbox" id="humanMouseMovementToggle"> Human-like Mouse Movement</label>
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('humanMouseMovementToggle');
  if (toggle) {
    toggle.checked = humanMouseMovement;
    toggle.addEventListener('change', (e) => {
      humanMouseMovement = e.target.checked;
      if (humanMouseMovement) startHumanMouseMovement();
    });
  }
});

// Simulate random mouse movement, clicks, and scrolling
function startHumanMouseMovement() {
  if (!humanMouseMovement) return;
  setupFakeCursor();
  function moveMouseRandomly() {
    if (!humanMouseMovement) return;
    const x = Math.floor(Math.random() * window.innerWidth);
    const y = Math.floor(Math.random() * window.innerHeight);
    // Move fake cursor
    moveFakeCursor(x, y);
    // Move mouse event
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: x,
      clientY: y,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(mouseMoveEvent);
    // Occasionally click
    if (Math.random() < 0.2) { // 20% chance
      const mouseClickEvent = new MouseEvent('click', {
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true
      });
      document.elementFromPoint(x, y)?.dispatchEvent(mouseClickEvent);
    }
    // Occasionally scroll
    if (Math.random() < 0.3) { // 30% chance
      const scrollY = Math.floor(Math.random() * window.innerHeight * 0.5);
      window.scrollBy({ top: scrollY - window.innerHeight / 4, behavior: 'smooth' });
    }
    setTimeout(moveMouseRandomly, 1000 + Math.random() * 2000); // Move every 1-3 seconds
  }
  moveMouseRandomly();
}

// Text-to-speech function
function speakText(text, rate = 1) {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported');
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  window.speechSynthesis.speak(utterance);
}

// Automatically process and answer MCQs using backend AI
function processAndAnswerMCQs() {
  // Use universal MCQ detection
  const mcqs = findAllMCQs();
  // Deduplicate MCQs for logging and processing
  function normalizeText(text) {
    return text.toLowerCase().replace(/[^a-z0-9? ]/g, '').replace(/\s+/g, ' ').trim();
  }
  const seen = new Set();
  const uniqueMcqs = mcqs.filter(mcq => {
    const normQ = normalizeText(mcq.question);
    const normOpts = mcq.options.map(o => normalizeText(o.text)).join('|');
    const key = normQ + '|' + normOpts;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Debug: Log all unique MCQs and their options
  console.log(`Detected ${uniqueMcqs.length} unique MCQs:`);
  uniqueMcqs.forEach((mcq, idx) => {
    console.log(`MCQ ${idx + 1}: ${mcq.question}`);
    mcq.options.forEach((opt, oidx) => {
      console.log(`  Option ${oidx + 1}: ${opt.text}`);
    });
  });
  // Process all unique MCQs
  uniqueMcqs.forEach((mcq, idx) => {
    fetch('http://localhost:5000/api/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: mcq.question,
        options: mcq.options.map(opt => opt.text),
        provider: 'openai' // or 'gemini', etc.
      })
    })
    .then(res => res.json())
    .then(data => {
      if (typeof data.answer_index === 'number' && mcq.options[data.answer_index]) {
        // Try to click/select the answer for all types
        if (mcq.options[data.answer_index].input instanceof HTMLElement) {
          mcq.options[data.answer_index].input.click();
        } else if (mcq.type === 'select') {
          mcq.options[data.answer_index].input.selected = true;
          mcq.options[data.answer_index].input.parentElement.dispatchEvent(new Event('change', { bubbles: true }));
        }
        console.log(`Answered: ${mcq.question} -> ${mcq.options[data.answer_index].text}`);
      } else {
        console.warn('No valid answer received for:', mcq.question);
      }
    })
    .catch(err => {
      console.error('Error getting answer:', err);
    });
  });
  console.log(`Total unique MCQs processed: ${uniqueMcqs.length}`);
}

// Improved: Find checkbox groups by container (for MCQs like 'Select all prime numbers')
function findCheckboxGroupsByContainer() {
  const mcqs = [];
  document.querySelectorAll('.mcq-block, .question, .quiz-question, .multiple-choice, div').forEach(container => {
    const checkboxes = Array.from(container.querySelectorAll("input[type='checkbox']"));
    if (checkboxes.length >= 2) {
      // Find the question in <b>, <span>, heading, or first text node
      let question = '';
      const qElem = container.querySelector('b,span,h1,h2,h3,h4,h5,h6');
      if (qElem && qElem.textContent.trim().length > 5) {
        question = qElem.textContent.trim();
      } else if (container.childNodes[0] && container.childNodes[0].textContent) {
        question = container.childNodes[0].textContent.trim();
      }
      // Get options
      const options = checkboxes.map(input => {
        let label = document.querySelector(`label[for='${input.id}']`);
        let optionText = label ? label.textContent.trim() : (input.parentElement && input.parentElement.tagName === "LABEL" ? input.parentElement.textContent.trim() : input.value || "");
        return { input, text: optionText };
      });
      if (question && options.length > 1) {
        mcqs.push({ question, options, type: 'checkbox' });
      }
    }
  });
  return mcqs;
}

// Universal MCQ detection supporting any format
function findAllMCQs() {
  const mcqs = [];
  const seen = new Set();
  // Helper to check if an MCQ is duplicate
  function isDuplicate(question, options) {
    const key = question + '|' + options.map(o => o.text).join('|');
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  }
  // 1. Standard radio/checkbox groups (already handled)
  findMCQs().forEach(mcq => {
    if (!isDuplicate(mcq.question, mcq.options)) {
      mcq.source = 'findMCQs';
      mcq.options = mcq.options.filter(opt => opt.text && !/^[A-D]$/.test(opt.text));
      if (mcq.options.length > 1) mcqs.push(mcq);
    }
  });
  // 1b. Improved: Checkbox groups by container
  findCheckboxGroupsByContainer().forEach(mcq => {
    if (!isDuplicate(mcq.question, mcq.options)) {
      mcq.source = 'findCheckboxGroupsByContainer';
      mcq.options = mcq.options.filter(opt => opt.text && !/^[A-D]$/.test(opt.text));
      if (mcq.options.length > 1) mcqs.push(mcq);
    }
  });
  // 1c. Fallback: Loose checkbox groups
  findLooseCheckboxGroups().forEach(mcq => {
    if (!isDuplicate(mcq.question, mcq.options)) {
      mcq.source = 'findLooseCheckboxGroups';
      mcq.options = mcq.options.filter(opt => opt.text && !/^[A-D]$/.test(opt.text));
      if (mcq.options.length > 1) mcqs.push(mcq);
    }
  });
  // 2. Select/dropdown MCQs
  document.querySelectorAll('select').forEach(select => {
    let question = getQuestionForInput(select);
    const options = Array.from(select.options).map(opt => ({ input: opt, text: opt.text })).filter(opt => opt.text && !/^[A-D]$/.test(opt.text));
    if (question && options.length > 1 && !isDuplicate(question, options)) {
      mcqs.push({ question, options, type: 'select', source: 'select' });
    }
  });
  // 3. Custom containers (e.g., .mcq-block, .question, .quiz-question, .multiple-choice)
  document.querySelectorAll('.mcq-block, .question, .quiz-question, .multiple-choice').forEach(block => {
    let question = '';
    const qElem = block.querySelector('h1,h2,h3,h4,h5,h6,b,strong,span');
    if (qElem && qElem.textContent.trim().length > 5) {
      question = qElem.textContent.trim();
    } else if (block.childNodes[0] && block.childNodes[0].textContent) {
      question = block.childNodes[0].textContent.trim();
    }
    const options = [];
    block.querySelectorAll('label,button,div.option,img').forEach(optElem => {
      let text = optElem.alt || optElem.textContent.trim();
      if (text && text.length > 0 && !/^[A-D]$/.test(text)) {
        options.push({ input: optElem, text });
      }
    });
    if (question && options.length > 1 && !isDuplicate(question, options)) {
      mcqs.push({ question, options, type: 'custom', source: 'custom-container' });
    }
  });
  // 4. List-based MCQs (ul/ol with options)
  document.querySelectorAll('ul,ol').forEach(list => {
    let prev = list.previousElementSibling;
    let question = '';
    while (prev) {
      if (prev.textContent && prev.textContent.trim().length > 5) {
        question = prev.textContent.trim();
        break;
      }
      prev = prev.previousElementSibling;
    }
    const options = Array.from(list.querySelectorAll('li')).map(li => ({ input: li, text: li.textContent.trim() })).filter(opt => opt.text && !/^[A-D]$/.test(opt.text));
    if (question && options.length > 1 && !isDuplicate(question, options)) {
      mcqs.push({ question, options, type: 'list', source: 'list' });
    }
  });
  // 5. Fallback: Any block with 2+ clickable options and a nearby question (add more heuristics as needed)
  return mcqs;
}

// Fallback: Find loose checkbox groups that are close in the DOM
function findLooseCheckboxGroups() {
  const mcqs = [];
  const allCheckboxes = Array.from(document.querySelectorAll("input[type='checkbox']"));
  let group = [];
  let lastParent = null;

  allCheckboxes.forEach((cb, idx) => {
    // Group by parent or by being close in the DOM
    const parent = cb.parentElement;
    if (lastParent && parent !== lastParent) {
      if (group.length >= 2) {
        // Try to find question above the first checkbox in the group
        let question = getQuestionForInput(group[0]);
        const options = group.map(input => {
          let label = document.querySelector(`label[for='${input.id}']`);
          let optionText = label ? label.textContent.trim() : (input.parentElement && input.parentElement.tagName === "LABEL" ? input.parentElement.textContent.trim() : input.value || "");
          return { input, text: optionText };
        });
        if (question && options.length > 1) {
          mcqs.push({ question, options, type: 'checkbox' });
        }
      }
      group = [];
    }
    group.push(cb);
    lastParent = parent;
  });
  // Handle last group
  if (group.length >= 2) {
    let question = getQuestionForInput(group[0]);
    const options = group.map(input => {
      let label = document.querySelector(`label[for='${input.id}']`);
      let optionText = label ? label.textContent.trim() : (input.parentElement && input.parentElement.tagName === "LABEL" ? input.parentElement.textContent.trim() : input.value || "");
      return { input, text: optionText };
    });
    if (question && options.length > 1) {
      mcqs.push({ question, options, type: 'checkbox' });
    }
  }
  return mcqs;
}

// Utility to convert data URL to HTMLImageElement
function dataUrlToImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Utility to check if popup is open (by sending a ping and expecting a response)
async function isPopupOpen() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "ping" }, (response) => {
      resolve(response && response.pong === true);
    });
  });
}

// When sending updateStats, updateLastMCQ, aiError, ocrError, first check if popup is open
async function sendPopupMessage(message) {
  if (await isPopupOpen()) {
    chrome.runtime.sendMessage(message);
  }
}

// Store the last captured image dataUrl for debugging
let lastCaptureDataUrl = null;

// --- Parse MCQs from OCR text ---
function parseMCQsFromOCRText(text) {
  const mcqs = [];
  if (!text || typeof text !== 'string') return mcqs;
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  let currentQuestion = '';
  let currentOptions = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Simple heuristic: question ends with ? or is long and contains what/which/who/when/where/why/how
    if (line.endsWith('?') || (/\b(what|which|who|when|where|why|how)\b/i.test(line) && line.length > 10)) {
      // Save previous MCQ if valid
      if (currentQuestion && currentOptions.length >= 2) {
        mcqs.push({ question: currentQuestion, options: [...currentOptions] });
      }
      currentQuestion = line;
      currentOptions = [];
    } else if (/^[A-D1-9][.)\-\s]+/.test(line) || (line.length > 0 && line.length < 50)) {
      // Option: starts with A. B. 1. 2. etc. or is a short line
      currentOptions.push(line.replace(/^[A-D1-9][.)\-\s]+/, '').trim());
    }
  }
  // Save last MCQ
  if (currentQuestion && currentOptions.length >= 2) {
    mcqs.push({ question: currentQuestion, options: [...currentOptions] });
  }
  return mcqs;
}

// --- Inject high-contrast, large-font style for better OCR accuracy ---
let ocrStyleInjected = false;
function injectOCRStyle() {
  if (ocrStyleInjected) return;
  const style = document.createElement('style');
  style.id = 'mcq-ocr-style';
  style.textContent = `
    body, .question, .mcq, .quiz-question, label, li, p, h1, h2, h3, h4, h5, h6 {
      font-size: 22px !important;
      color: #000 !important;
      background: #fff !important;
      text-shadow: none !important;
      filter: none !important;
      opacity: 1 !important;
    }
    * {
      text-shadow: none !important;
      filter: none !important;
      opacity: 1 !important;
    }
  `;
  document.head.appendChild(style);
  ocrStyleInjected = true;
  console.log('[MCQ-BOT] OCR style injected for better Tesseract accuracy.');
}

// Heuristic: Find MCQ block (radio/checkbox group with question text)
function findMCQBlock() {
  const candidates = Array.from(document.querySelectorAll('form, div, section, article'));
  for (const el of candidates) {
    const radios = el.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    if (radios.length >= 2) {
      // Optionally, check for question text pattern
      return el;
    }
  }
  return null;
}

function getMCQRect(el) {
  const rect = el.getBoundingClientRect();
  return {
    x: Math.round(rect.left + window.scrollX),
    y: Math.round(rect.top + window.scrollY),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };
}

// Listen for background trigger
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "autoDetectMCQ") {
    const mcqEl = findMCQBlock();
    if (mcqEl) {
      mcqEl.scrollIntoView({behavior: "smooth", block: "center"});
      setTimeout(() => {
        const rect = getMCQRect(mcqEl);
        sendResponse({success: true, rect});
      }, 500); // Wait for scroll
      return true; // async response
    } else {
      sendResponse({success: false, error: "No MCQ block found"});
    }
  }
});
