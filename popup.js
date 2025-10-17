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
  const errorMessage = document.getElementById("errorMessage")
  const startAuto = document.getElementById("start-auto")
  const startAutoToggle = document.getElementById("startAutoToggle")
  const reOCR = document.getElementById("re-ocr")
  const langSelect = document.getElementById("lang-select")
  const preview = document.getElementById("preview")
  const ocrResult = document.getElementById("ocr-result")
  const statusDiv = document.getElementById("status")

  let isDarkMode = false
  let lastImage = null
  let lastLang = 'eng'

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

  // Start auto toggle functionality
  startAutoToggle.addEventListener('change', function() {
    const isActive = this.checked;
    
    if (isActive) {
      startAuto.classList.add('active');
      startAuto.textContent = 'Stop Auto Detection';
      showStatus('Auto detection enabled', 'success');
      
      // Enable the bot if not already enabled
      if (!botToggle.checked) {
        botToggle.checked = true;
        updateStatusIndicator(true);
        chrome.storage.sync.set({ botEnabled: true });
      }
    } else {
      startAuto.classList.remove('active');
      startAuto.textContent = 'Auto Detect & OCR';
      showStatus('Auto detection disabled', 'info');
    }
  });
  
  // Start auto detection button
  startAuto.addEventListener("click", async () => {
    console.log('Start Auto button clicked');
    
    // Toggle the auto detection state
    startAutoToggle.checked = !startAutoToggle.checked;
    startAutoToggle.dispatchEvent(new Event('change'));
    
    if (!startAutoToggle.checked) {
      return; // If we just disabled it, don't run the scan
    }
    
    try {
      // Disable button temporarily to prevent multiple clicks
      startAuto.disabled = true;
      const originalText = startAuto.textContent;
      startAuto.textContent = 'Scanning...';
      
      showStatus('Initializing scan...', 'info');
      
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.id) {
        throw new Error('No active tab found');
      }
      
      // Check if the URL is a restricted URL
      if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || 
                      tab.url.startsWith('edge://') || tab.url.startsWith('about:'))) {
        throw new Error('Cannot scan Chrome internal pages. Please open a regular webpage.');
      }
      
      // Try to inject content script if needed
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      } catch (e) {
        console.log('Injecting content script...');
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (injectError) {
          throw new Error('Failed to initialize scanner. Please refresh the page and try again.');
        }
      }
      
      // Trigger the scan
      const response = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { action: 'scanForMCQs' }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(response || { success: false, error: 'No response from content script' });
          }
        });
      });
      
      if (response.success) {
        showStatus(`Found ${response.count || 0} MCQs`, 'success');
        statusText.textContent = `Found ${response.count || 0} MCQs`;
        
        // Update stats
        if (response.stats) {
          mcqsFoundEl.textContent = response.stats.found || 0;
          mcqsAnsweredEl.textContent = response.stats.answered || 0;
          accuracyEl.textContent = `${response.stats.accuracy || 0}%`;
        }
        
        // Show MCQ info if available
        if (response.lastMCQ) {
          mcqInfo.style.display = 'block';
          const questionText = response.lastMCQ.question || '';
          const truncatedQuestion = questionText.length > 100 
            ? questionText.substring(0, 100) + '...' 
            : questionText;
          mcqInfo.querySelector('.mcq-question').textContent = `Question: ${truncatedQuestion}`;
          mcqInfo.querySelector('.mcq-answer').textContent = `Answer: ${response.lastMCQ.answer || 'Processing...'}`;
        }
      } else {
        const errorMsg = response.error || 'Failed to scan for MCQs';
        showStatus(errorMsg, 'error');
        statusText.textContent = 'Scan failed';
        
        // Disable the toggle on error
        startAutoToggle.checked = false;
        startAuto.classList.remove('active');
        startAuto.textContent = 'Auto Detect & OCR';
      }
    } catch (error) {
      console.error('Error in startAuto:', error);
      showStatus('Error: ' + error.message, 'error');
      statusText.textContent = 'Error occurred';
      
      // Disable the toggle on error
      startAutoToggle.checked = false;
      startAuto.classList.remove('active');
      startAuto.textContent = 'Auto Detect & OCR';
    } finally {
      startAuto.disabled = false;
      if (startAutoToggle.checked) {
        startAuto.textContent = 'Stop Auto Detection';
      }
    }
  });

  // Toggle bot status
  botToggle.addEventListener("change", () => {
    const isEnabled = botToggle.checked

    chrome.storage.sync.set({ botEnabled: isEnabled })

    updateStatusIndicator(isEnabled)

    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        console.warn('No active tab to notify about bot toggle')
        return
      }
      const tab = tabs[0]
      if (!tab || !tab.id) {
        console.warn('Active tab object invalid')
        return
      }
      try {
        chrome.tabs.sendMessage(tab.id, {
          action: isEnabled ? "enableBot" : "disableBot",
          mode: modeSelect.value,
        }, (resp) => {
          if (chrome.runtime.lastError) {
            // Content script might not be injected on this page - that's fine
            console.warn('Could not send enable/disable message to tab:', chrome.runtime.lastError.message)
          }
        })
      } catch (err) {
        console.error('Error sending enable/disable message:', err)
      }
    })
  })

  // Toggle voice narration
  voiceToggle.addEventListener("change", () => {
    const isEnabled = voiceToggle.checked

    chrome.storage.sync.set({ voiceEnabled: isEnabled })

    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) return
      const tab = tabs[0]
      if (!tab || !tab.id) return
      try {
        chrome.tabs.sendMessage(tab.id, {
          action: "setVoiceNarration",
          enabled: isEnabled,
        }, () => {
          if (chrome.runtime.lastError) console.warn('Voice toggle message failed:', chrome.runtime.lastError.message)
        })
      } catch (err) {
        console.error('Error sending voice toggle message:', err)
      }
    })
  })

  // Toggle auto-answer
  autoAnswerToggle.addEventListener("change", () => {
    const isEnabled = autoAnswerToggle.checked

    chrome.storage.sync.set({ autoAnswer: isEnabled })

    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) return
      const tab = tabs[0]
      if (!tab || !tab.id) return
      try {
        chrome.tabs.sendMessage(tab.id, {
          action: "setAutoAnswer",
          enabled: isEnabled,
        }, () => {
          if (chrome.runtime.lastError) console.warn('Auto-answer message failed:', chrome.runtime.lastError.message)
        })
      } catch (err) {
        console.error('Error sending auto-answer message:', err)
      }
    })
  })

  // Change mode
  modeSelect.addEventListener("change", () => {
    const mode = modeSelect.value

    chrome.storage.sync.set({ mode: mode })

    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) return
      const tab = tabs[0]
      if (!tab || !tab.id) return
      try {
        chrome.tabs.sendMessage(tab.id, {
          action: "setMode",
          mode: mode,
        }, () => {
          if (chrome.runtime.lastError) console.warn('Set mode message failed:', chrome.runtime.lastError.message)
        })
      } catch (err) {
        console.error('Error sending setMode message:', err)
      }
    })
  })

  // Scan for MCQs button
  scanButton.addEventListener("click", async () => {
    console.log('Scan button clicked');
    clearError();
    statusText.textContent = "Scanning for MCQs...";
    scanButton.disabled = true;
    
    try {
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.id) {
        throw new Error('No active tab found');
      }
      
      // Check if content script is injected
      try {
        // Try to send a ping to the content script
        await chrome.tabs.sendMessage(tab.id, { action: "ping" });
      } catch (e) {
        console.log('Content script not responding, injecting...');
        // If content script is not injected, inject it
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      }
      
      // Send scan message
      const response = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { action: "scanForMCQs" }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error sending message to content script:', chrome.runtime.lastError);
            resolve(null);
          } else {
            resolve(response);
          }
        });
      });
      
      if (response && response.success) {
        console.log(`Found ${response.count} MCQs`, response);
        statusText.textContent = `Found ${response.count} MCQs`;
        mcqsFoundEl.textContent = response.count;

        // Update storage
        const { stats } = await chrome.storage.sync.get(["stats"]);
        const updatedStats = { 
          ...(stats || { found: 0, answered: 0, accuracy: 0 }),
          found: response.count 
        };
        await chrome.storage.sync.set({ stats: updatedStats });

        // Show MCQ info if available
        if (response.lastMCQ) {
          mcqInfo.style.display = "block";
          const questionText = response.lastMCQ.question || '';
          const truncatedQuestion = questionText.length > 100 
            ? questionText.substring(0, 100) + '...' 
            : questionText;
          mcqInfo.querySelector(".mcq-question").textContent = `Question: ${truncatedQuestion}`;
          mcqInfo.querySelector(".mcq-answer").textContent = `Answer: ${response.lastMCQ.answer || "Pending..."}`;
        }
      } else {
        console.log('No MCQs found or error in scanning');
        statusText.textContent = "No MCQs found";
        if (response && response.error) {
          showError(response.error);
        }
      }
    } catch (error) {
      console.error('Error in scan button click handler:', error);
      showError('Failed to scan for MCQs: ' + error.message);
      statusText.textContent = "Error scanning for MCQs";
    } finally {
      scanButton.disabled = false;
    }
  });

  // Capture screen button
  captureButton.addEventListener("click", () => {
    clearError()
    statusText.textContent = "Capturing screen..."
    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "captureScreen" }, (response) => {
        // Enhanced: Log the response for debugging
        console.log("Popup received captureScreen response:", response);
        if (chrome.runtime.lastError) {
          statusText.textContent = "Screen capture failed: " + chrome.runtime.lastError.message;
          return;
        }
        if (response && response.success) {
          statusText.textContent = "Screen captured";
          // Show MCQ info if available
          if (response.ocrText) {
            mcqInfo.style.display = "block"
            mcqInfo.querySelector(".mcq-question").textContent =
              `OCR Text: ${response.ocrText.substring(0, 100)}${response.ocrText.length > 100 ? "..." : ""}`
          }
          // --- Show captured image preview for debugging ---
          let imgPreview = document.getElementById("capturePreview");
          if (!imgPreview) {
            imgPreview = document.createElement("img");
            imgPreview.id = "capturePreview";
            imgPreview.style.maxWidth = "100%";
            imgPreview.style.maxHeight = "200px";
            imgPreview.style.display = "block";
            imgPreview.style.margin = "10px auto";
            statusText.parentNode.insertBefore(imgPreview, statusText.nextSibling);
          }
          // The image dataUrl is not returned in the current response, so request it from the content script
          chrome.tabs.sendMessage(tabs[0].id, { action: "getLastCaptureDataUrl" }, (imgResp) => {
            if (imgResp && imgResp.dataUrl) {
              imgPreview.src = imgResp.dataUrl;
              imgPreview.style.display = "block";
            } else {
              imgPreview.style.display = "none";
            }
          });
        } else {
          statusText.textContent = "Screen capture failed: " + (response && response.error ? response.error : "Unknown error");
        }
      });
    });
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

    if (message.action === "ocrError" || message.action === "aiError") {
      showError(message.error || "Unknown error");
      // Enhanced: Log all errors to the console for debugging
      console.error("[MCQ-BOT] Error:", message.error);
      return;
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

  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.style.display = "block";
    // Enhanced: Log error to console for debugging
    console.error("[MCQ-BOT] Popup error:", msg);
  }

  function clearError() {
    errorMessage.textContent = "";
    errorMessage.style.display = "none";
  }
  
  function showStatus(message, type = 'info') {
    if (statusDiv) {
      statusDiv.textContent = message;
      statusDiv.className = `status-message ${type}`;
      statusDiv.style.display = 'block';
      
      // Auto-hide after 5 seconds for success/error messages
      if (type === 'success' || type === 'error') {
        setTimeout(() => {
          statusDiv.style.display = 'none';
        }, 5000);
      }
    }
  }

  // Note: startAuto has a robust handler earlier (startAuto.addEventListener)
  // Remove duplicate onclick assignment to avoid conflicts.

  // Ensure re-ocr and lang select use addEventListener for consistency
  if (reOCR) {
    reOCR.addEventListener('click', () => {
      if (lastImage) {
        showStatus('Re-running OCR...', 'info');
        runOCR(lastImage, lastLang, 2);
      } else {
        showStatus('No image available for OCR', 'error');
      }
    });
  }

  if (langSelect) {
    langSelect.addEventListener('change', (e) => {
      lastLang = e.target.value;
      showStatus(`Language changed to ${e.target.options[e.target.selectedIndex].text}`, 'info');
      if (lastImage) {
        runOCR(lastImage, lastLang, 2);
      }
    });
  }

  // Enhanced image preprocessing for better OCR accuracy
  function preprocessImage(base64, callback) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Scale up small images for better OCR
      const minWidth = 800;
      const scale = Math.max(1, minWidth / img.width);
      
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      // Draw scaled image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Get image data for processing
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Convert to grayscale and apply contrast enhancement
      for (let i = 0; i < data.length; i += 4) {
        // Calculate grayscale value
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        
        // Apply contrast enhancement
        const enhanced = gray < 128 ? Math.max(0, gray - 30) : Math.min(255, gray + 30);
        
        // Apply binary threshold
        const binary = enhanced > 128 ? 255 : 0;
        
        data[i] = binary;     // Red
        data[i + 1] = binary; // Green
        data[i + 2] = binary; // Blue
        // Alpha channel remains unchanged
      }
      
      // Put processed image data back
      ctx.putImageData(imageData, 0, 0);
      
      // Show preview if element exists
      if (preview) {
        preview.src = canvas.toDataURL('image/png');
        preview.style.display = 'block';
      }
      
      callback(canvas.toDataURL('image/png'));
    };
    
    img.onerror = function() {
      showStatus('Error loading image for preprocessing', 'error');
      callback(base64); // Fallback to original
    };
    
    img.src = base64;
  }

  // Tesseract.js presence check
  if (typeof Tesseract === 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
      const status = document.getElementById('status');
      if (status) {
        status.textContent = 'Tesseract.js is not loaded! Please check your popup.html script order.';
      }
      console.error('Tesseract.js is not loaded!');
    });
  }

  function getErrorMessage(err) {
    if (!err) return 'Unknown error';
    if (typeof err === 'object' && 'message' in err) return err.message;
    if (typeof err === 'string') return err;
    try { return JSON.stringify(err); } catch { return 'Unserializable error'; }
  }

  function runOCR(image, lang, retries) {
    if (typeof Tesseract === 'undefined') {
      showStatus('Tesseract.js is not loaded!', 'error');
      console.error('Tesseract.js is not loaded!');
      return;
    }
    
    showStatus(`Running OCR (${lang})...`, 'info');
    
    preprocessImage(image, (processedImage) => {
      Tesseract.recognize(processedImage, lang, { 
        logger: m => {
          if (m.status === 'recognizing text') {
            showStatus(`OCR Progress: ${Math.round(m.progress * 100)}%`, 'info');
          }
        }
      })
      .then(result => {
        const extractedText = result.data.text.trim();
        
        if (!extractedText && retries > 0) {
          showStatus('Retrying OCR...', 'info');
          runOCR(processedImage, lang, retries - 1);
        } else if (!extractedText) {
          // Fallback: send to backend
          showStatus('Trying backend OCR...', 'info');
          const API_BASE = window.APP_CONFIG ? window.APP_CONFIG.API_BASE : 'https://mcq-bot-backend.railway.app/api';
          fetch(`${API_BASE}/ocr-detect`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({image_data: processedImage, language: lang})
          })
          .then(r => r.json())
          .then(data => {
            if (data.success && data.text) {
              showStatus('Backend OCR completed', 'success');
              if (ocrResult) ocrResult.textContent = data.text;
            } else {
              showStatus('Backend OCR: No text found', 'error');
              if (ocrResult) ocrResult.textContent = 'No text detected';
            }
          })
          .catch(err => {
            const msg = getErrorMessage(err);
            showStatus('Backend OCR error: ' + msg, 'error');
            console.error('Backend OCR error:', err);
          });
        } else {
          showStatus('OCR completed successfully!', 'success');
          if (ocrResult) ocrResult.textContent = extractedText;
          
          // Try to parse MCQs from the text
          const mcqs = parseMCQsFromText(extractedText);
          if (mcqs.length > 0) {
            showStatus(`Found ${mcqs.length} MCQ(s) in text`, 'success');
          }
        }
      })
      .catch(err => {
        const msg = getErrorMessage(err);
        showStatus('Tesseract error: ' + msg, 'error');
        console.error('Tesseract error:', err);
      });
    });
  }
  
  // Simple MCQ parser for OCR text
  function parseMCQsFromText(text) {
    const mcqs = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let currentQuestion = '';
    let currentOptions = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if line looks like a question (ends with ? or contains question words)
      if (line.endsWith('?') || /\b(what|which|who|when|where|why|how)\b/i.test(line)) {
        // Save previous MCQ if we have one
        if (currentQuestion && currentOptions.length >= 2) {
          mcqs.push({
            question: currentQuestion,
            options: currentOptions
          });
        }
        
        currentQuestion = line;
        currentOptions = [];
      }
      // Check if line looks like an option (starts with A), B), 1), etc.)
      else if (/^[A-D1-4][.)\s]/.test(line) || /^[a-d][.)\s]/.test(line)) {
        const optionText = line.replace(/^[A-Da-d1-4][.)\s]+/, '').trim();
        if (optionText) {
          currentOptions.push(optionText);
        }
      }
    }
    
    // Don't forget the last MCQ
    if (currentQuestion && currentOptions.length >= 2) {
      mcqs.push({
        question: currentQuestion,
        options: currentOptions
      });
    }
    
    return mcqs;
  }

  // Example function to answer MCQ using backend
  async function answerMCQWithBackend(question, options) {
    // Get provider from storage
    const settings = await new Promise((resolve) => {
      chrome.storage.sync.get(["apiProvider"], resolve)
    })
    const provider = settings.apiProvider || "openai"
    // POST to backend
    const API_BASE = window.APP_CONFIG ? window.APP_CONFIG.API_BASE : 'https://mcq-bot-backend.railway.app/api';
    const response = await fetch(`${API_BASE}/get-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: question,
        options: options.map(text => ({ text })),
        provider: provider
      })
    })
    const data = await response.json()
    if (data.success) {
      // Show answer in popup UI (implement as needed)
      statusText.textContent = `Answer: ${data.selected_option}`
    } else {
      statusText.textContent = `Error: ${data.error || 'No answer found'}`
    }
  }
})
