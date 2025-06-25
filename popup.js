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
  const reOCR = document.getElementById("re-ocr")
  const langSelect = document.getElementById("lang-select")
  const preview = document.getElementById("preview")
  const ocrResult = document.getElementById("ocr-result")

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
    clearError()
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

  startAuto.onclick = () => {
    document.getElementById('status').textContent = "Detecting MCQ...";
    chrome.runtime.sendMessage({type: "startAutoMCQ"}, (resp) => {
      if (!resp || !resp.success) {
        document.getElementById('status').textContent = "Error: " + (resp ? resp.error : "Unknown");
        return;
      }
      lastImage = resp.image;
      document.getElementById('preview').src = lastImage;
      runOCR(lastImage, lastLang, 2);
    });
  };

  reOCR.onclick = () => {
    if (lastImage) runOCR(lastImage, lastLang, 2);
  };

  langSelect.onchange = (e) => {
    lastLang = e.target.value;
    if (lastImage) runOCR(lastImage, lastLang, 2);
  };

  // Add image preprocessing for better OCR accuracy
  function preprocessImage(base64, callback) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      // Grayscale and binarize
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < imageData.data.length; i += 4) {
        const avg = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        const bin = avg > 128 ? 255 : 0;
        imageData.data[i] = imageData.data[i+1] = imageData.data[i+2] = bin;
      }
      ctx.putImageData(imageData, 0, 0);
      callback(canvas.toDataURL('image/png'));
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
    const statusEl = document.getElementById('status');
    if (typeof Tesseract === 'undefined') {
      if (statusEl) statusEl.textContent = 'Tesseract.js is not loaded!';
      console.error('Tesseract.js is not loaded!');
      return;
    }
    if (statusEl) statusEl.textContent = "Running OCR (" + lang + ")...";
    preprocessImage(image, (processedImage) => {
      Tesseract.recognize(processedImage, lang, { logger: m => console.log(m) })
        .then(result => {
          if (!result.data.text.trim() && retries > 0) {
            if (statusEl) statusEl.textContent = "Retrying OCR...";
            runOCR(processedImage, lang, retries - 1);
          } else if (!result.data.text.trim()) {
            // Fallback: send to backend
            if (statusEl) statusEl.textContent = "Trying backend OCR...";
            fetch('http://localhost:5000/api/ocr-detect', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({image: processedImage, lang})
            })
            .then(r => r.json())
            .then(data => {
              if (statusEl) statusEl.textContent = "Backend OCR: " + (data.text || "No text found");
              document.getElementById('ocr-result').textContent = data.text || "";
            })
            .catch(err => {
              const msg = getErrorMessage(err);
              if (statusEl) statusEl.textContent = "Backend OCR error: " + msg;
              console.error('Backend OCR error:', err);
            });
          } else {
            if (statusEl) statusEl.textContent = "OCR Success!";
            document.getElementById('ocr-result').textContent = result.data.text;
          }
        })
        .catch(err => {
          const msg = getErrorMessage(err);
          if (statusEl) statusEl.textContent = "Tesseract error: " + msg;
          console.error('Tesseract error:', err);
        });
    });
  }
})
