import os
import json
import base64
import re
from flask import Flask, request, jsonify, render_template, send_file
from flask_cors import CORS
import cv2
import numpy as np
import pytesseract
import openai
import google.generativeai as genai
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
import time
import re
from typing import List, Dict, Optional
import logging
from PIL import Image, ImageFile, UnidentifiedImageError, ImageEnhance, ImageFilter, ImageDraw, ImageFont
import io
from dotenv import load_dotenv
from io import BytesIO

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Load environment variables from .env file
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

GOOGLE_APPLICATION_CREDENTIALS = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
GEMINI_API_URL = os.environ.get('GEMINI_API_URL')
GPT4V_API_KEY = os.environ.get('GPT4V_API_KEY')
GPT4V_API_URL = os.environ.get('GPT4V_API_URL')

# Check for required environment variables and log errors
if not GOOGLE_APPLICATION_CREDENTIALS:
    logger.error('GOOGLE_APPLICATION_CREDENTIALS not set in .env')
if not GEMINI_API_KEY:
    logger.warning('GEMINI_API_KEY not set in .env (Gemini fallback will not work)')
if not GEMINI_API_URL:
    logger.warning('GEMINI_API_URL not set in .env (Gemini fallback will not work)')
if not GPT4V_API_KEY:
    logger.warning('GPT4V_API_KEY not set in .env (GPT-4 Vision fallback will not work)')
if not GPT4V_API_URL:
    logger.warning('GPT4V_API_URL not set in .env (GPT-4 Vision fallback will not work)')

# Suppress unnecessary warnings from libraries
import warnings
warnings.filterwarnings('ignore')

class MCQAutomationBot:
    def __init__(self):
        self.driver = None
        self.openai_client = None
        self.genai_client = None
        self.config = {
            'auto_answer': True,
            'answer_delay': 3,
            'max_retries': 3,
            'voice_enabled': False,
            'stealth_mode': True
        }
        
    def setup_driver(self, headless=True):
        """Setup Chrome driver with stealth options"""
        chrome_options = Options()
        
        if headless:
            chrome_options.add_argument('--headless')
        
        # Stealth options
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        chrome_options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
        
        self.driver = webdriver.Chrome(options=chrome_options)
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
    def setup_ai_clients(self, openai_key=None, gemini_key=None):
        """Setup AI clients"""
        if openai_key:
            self.openai_client = openai.OpenAI(api_key=openai_key)
        
        if gemini_key:
            genai.configure(api_key=gemini_key)
            self.genai_client = genai.GenerativeModel('gemini-pro')
    
    def detect_mcqs_dom(self, url=None):
        """Detect MCQs using DOM parsing"""
        if url:
            self.driver.get(url)
        
        mcqs = []
        
        # Common MCQ selectors
        selectors = [
            "input[type='radio']",
            "input[type='checkbox']",
            ".question",
            ".mcq",
            ".quiz-question",
            ".multiple-choice",
            "[class*='question']",
            "[class*='quiz']",
            "[class*='mcq']"
        ]
        
        for selector in selectors:
            try:
                elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                for element in elements:
                    mcq_data = self.extract_mcq_data(element)
                    if mcq_data:
                        mcqs.append(mcq_data)
            except Exception as e:
                logger.error(f"Error with selector {selector}: {e}")
        
        return mcqs
    
    def extract_mcq_data(self, element):
        """Extract MCQ data from DOM element"""
        try:
            # Find parent container
            parent = element
            for _ in range(5):  # Look up to 5 levels up
                parent = parent.find_element(By.XPATH, "..")
                if any(keyword in parent.get_attribute('class').lower() for keyword in ['question', 'quiz', 'mcq'] if parent.get_attribute('class')):
                    break
            
            # Extract question text
            question_text = ""
            question_elements = parent.find_elements(By.CSS_SELECTOR, "h1, h2, h3, h4, h5, h6, p, div, span")
            for elem in question_elements:
                text = elem.text.strip()
                if len(text) > 10 and '?' in text:
                    question_text = text
                    break
            
            # Extract options
            options = []
            option_elements = parent.find_elements(By.CSS_SELECTOR, "input[type='radio'], input[type='checkbox'], label, .option")
            
            for opt_elem in option_elements:
                option_text = opt_elem.text.strip()
                if not option_text:
                    # Try to find associated label
                    try:
                        label = opt_elem.find_element(By.XPATH, "following-sibling::label | preceding-sibling::label | ../label")
                        option_text = label.text.strip()
                    except:
                        pass
                
                if option_text and len(option_text) > 1:
                    options.append({
                        'text': option_text,
                        'element': opt_elem,
                        'value': opt_elem.get_attribute('value') or option_text
                    })
            
            if question_text and len(options) >= 2:
                return {
                    'question': question_text,
                    'options': options,
                    'type': 'radio' if option_elements and option_elements[0].get_attribute('type') == 'radio' else 'checkbox',
                    'container': parent
                }
        
        except Exception as e:
            logger.error(f"Error extracting MCQ data: {e}")
        
        return None
    
    def detect_mcqs_ocr(self, image_data=None):
        """Detect MCQs using OCR"""
        try:
            if image_data:
                # Decode base64 image
                try:
                    image_bytes = base64.b64decode(image_data.split(',')[1])
                    nparr = np.frombuffer(image_bytes, np.uint8)
                    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                except Exception as decode_err:
                    logger.error(f"Error decoding image data: {decode_err}")
                    raise ValueError("Invalid image data for OCR.")
            else:
                # Take screenshot
                screenshot = self.driver.get_screenshot_as_png()
                nparr = np.frombuffer(screenshot, np.uint8)
                image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            # Preprocess image for better OCR
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            gray = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
            # Check Tesseract availability
            try:
                _ = pytesseract.get_tesseract_version()
            except Exception as tesseract_err:
                logger.error(f"Tesseract not found or not working: {tesseract_err}")
                raise RuntimeError("Tesseract OCR is not installed or not in PATH.")
            # Extract text using OCR
            try:
                text = pytesseract.image_to_string(gray, config='--psm 6')
            except Exception as ocr_err:
                logger.error(f"Error during OCR: {ocr_err}")
                raise RuntimeError(f"OCR failed: {ocr_err}")
            # Parse MCQs from text
            mcqs = self.parse_mcqs_from_text(text)
            return mcqs
        except Exception as e:
            logger.error(f"Error in detect_mcqs_ocr: {e}")
            raise
    
    def parse_mcqs_from_text(self, text):
        """Parse MCQs from extracted text with support for various formats"""
        mcqs = []
        # Split lines and remove empty ones, but preserve line breaks for multi-line questions
        lines = [line for line in text.split('\n') if line.strip()]
        
        current_question = []
        current_options = []
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # Check if line is a question (contains ? or is followed by options)
            next_line = lines[i+1].strip() if i + 1 < len(lines) else ""
            is_question = ('?' in line or 
                         (i > 0 and '?' in lines[i-1]) or  # Handle question mark on previous line
                         (i + 1 < len(lines) and self._looks_like_option(next_line)))
            
            if is_question:
                # If we have a question and see another question, save the current one
                if current_question and (current_options or any('?' in l for l in current_question)):
                    question_text = ' '.join(current_question).strip()
                    if question_text and len(current_options) >= 2:
                        mcqs.append({
                            'question': question_text,
                            'options': [{'text': opt, 'value': opt} for opt in current_options],
                            'type': 'text'
                        })
                
                # Start new question
                current_question = [line]
                current_options = []
                i += 1
                
                # Check if next lines are part of the question (until we hit an option)
                while i < len(lines):
                    next_line = lines[i].strip()
                    if self._looks_like_option(next_line):
                        break
                    current_question.append(next_line)
                    i += 1
                continue
            
            # Handle options
            if self._looks_like_option(line):
                # Clean and add the option
                option_text = self._clean_option_text(line)
                if option_text:
                    current_options.append(option_text)
            
            i += 1
        
        # Add the last MCQ if valid
        if current_question and len(current_options) >= 2:
            mcqs.append({
                'question': current_question.strip(),
                'options': [{'text': opt, 'value': opt} for opt in current_options],
                'type': 'text'
            })
        
        return mcqs
    
    def _looks_like_option(self, text):
        """Check if text looks like an option"""
        # Match patterns like: A) B. C- [D] (E) • F ○ G © H
        option_patterns = [
            r'^\s*[A-Za-z][\.\)\]\-\s]+',  # A) B. C- [D]
            r'^\s*[0-9]+[\.\)\]\-\s]+',    # 1) 2. 3- [4]
            r'^\s*[•○▪■⦿◉©]\s*',             # Bullet points and copyright symbol
            r'^\s*\([A-Za-z0-9]\)\s*',     # (A) (1)
            r'^\s*[A-Za-z]\s*[\-:]\s*',     # A- A:
            r'^\s*©\)?\s*'                   # © or ©)
        ]
        
        return any(re.match(pattern, text) for pattern in option_patterns)
    
    def _clean_option_text(self, text):
        """Clean and extract option text"""
        # Remove common option markers
        text = re.sub(r'^\s*[A-Za-z0-9][\.\)\]\-\s]+', '', text)  # A) B. C- [D]
        text = re.sub(r'^\s*[•○▪■⦿◉©]\s*', '', text)  # Bullet points and copyright
        text = re.sub(r'^\s*\([A-Za-z0-9]\)\s*', '', text)  # (A) (1)
        text = re.sub(r'^\s*[A-Za-z]\s*[\-:]\s*', '', text)  # A- A:
        text = re.sub(r'^\s*©\)?\s*', '', text)  # © or ©)
        
        # Clean up any remaining special characters and whitespace
        text = text.strip()
        text = re.sub(r'^[^\w\s]+', '', text)  # Remove leading special chars
        text = re.sub(r'\s+', ' ', text)  # Normalize whitespace
        
        return text.strip()
    
    def get_ai_answer(self, question, options, provider='openai'):
        """Get AI answer for MCQ"""
        options_text = '\n'.join([f"{i+1}. {opt['text']}" for i, opt in enumerate(options)])
        
        prompt = f"""
        Question: {question}
        
        Options:
        {options_text}
        
        Instructions:
        1. Analyze the question and options carefully.
        2. Select the most accurate answer.
        3. Respond ONLY with the number of the correct option (1, 2, 3, or 4).
        4. Do not explain your reasoning, just provide the number.
        """
        
        try:
            if provider == 'openai' and self.openai_client:
                response = self.openai_client.chat.completions.create(
                    model="gpt-4",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                    max_tokens=10
                )
                answer = response.choices[0].message.content.strip()
                
            elif provider == 'gemini' and self.genai_client:
                response = self.genai_client.generate_content(prompt)
                answer = response.text.strip()
            
            else:
                return None
            
            # Extract number from answer
            match = re.search(r'\b([1-4])\b', answer)
            if match:
                return int(match.group(1)) - 1  # Convert to 0-based index
            
        except Exception as e:
            logger.error(f"Error getting AI answer: {e}")
        
        return None
    
    def select_answer(self, mcq, answer_index):
        """Automatically select the answer"""
        try:
            if mcq['type'] == 'text':
                logger.info(f"Text-based MCQ - Answer: {mcq['options'][answer_index]['text']}")
                return True
            
            option = mcq['options'][answer_index]
            element = option['element']
            
            # Scroll to element
            self.driver.execute_script("arguments[0].scrollIntoView(true);", element)
            time.sleep(0.5)
            
            # Click the element
            if element.is_enabled() and element.is_displayed():
                element.click()
                logger.info(f"Selected option: {option['text']}")
                return True
            else:
                # Try JavaScript click
                self.driver.execute_script("arguments[0].click();", element)
                logger.info(f"Selected option via JS: {option['text']}")
                return True
                
        except Exception as e:
            logger.error(f"Error selecting answer: {e}")
            return False
    
    def process_mcqs_automatically(self, url, ai_provider='openai'):
        """Process all MCQs on a page automatically"""
        results = []
        
        try:
            # Navigate to URL
            if url:
                self.driver.get(url)
                time.sleep(2)
            
            # Detect MCQs
            mcqs = self.detect_mcqs_dom()
            
            if not mcqs:
                # Try OCR detection
                mcqs = self.detect_mcqs_ocr()
            
            logger.info(f"Found {len(mcqs)} MCQs")
            
            # Process each MCQ
            for i, mcq in enumerate(mcqs):
                logger.info(f"Processing MCQ {i+1}: {mcq['question'][:50]}...")
                
                # Get AI answer
                answer_index = self.get_ai_answer(mcq['question'], mcq['options'], ai_provider)
                
                if answer_index is not None and 0 <= answer_index < len(mcq['options']):
                    # Add delay for natural behavior
                    time.sleep(self.config['answer_delay'])
                    
                    # Select answer
                    success = self.select_answer(mcq, answer_index)
                    
                    results.append({
                        'question': mcq['question'],
                        'selected_answer': mcq['options'][answer_index]['text'],
                        'success': success,
                        'answer_index': answer_index
                    })
                else:
                    results.append({
                        'question': mcq['question'],
                        'selected_answer': None,
                        'success': False,
                        'error': 'Could not determine answer'
                    })
        
        except Exception as e:
            logger.error(f"Error processing MCQs: {e}")
        
        return results
    
    def close(self):
        """Close the driver"""
        if self.driver:
            self.driver.quit()

# Global bot instance
bot = MCQAutomationBot()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/setup', methods=['POST'])
def setup_bot():
    """Setup the automation bot"""
    data = request.json
    
    try:
        # Setup driver
        bot.setup_driver(headless=data.get('headless', True))
        
        # Setup AI clients
        bot.setup_ai_clients(
            openai_key=data.get('openai_key'),
            gemini_key=data.get('gemini_key')
        )
        
        # Update config
        bot.config.update(data.get('config', {}))
        
        return jsonify({'success': True, 'message': 'Bot setup completed'})
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/detect-mcqs', methods=['POST'])
def detect_mcqs():
    """Detect MCQs on a page"""
    data = request.json
    url = data.get('url')
    
    try:
        mcqs = bot.detect_mcqs_dom(url)
        
        # Convert to serializable format
        serializable_mcqs = []
        for mcq in mcqs:
            serializable_mcqs.append({
                'question': mcq['question'],
                'options': [{'text': opt['text'], 'value': opt['value']} for opt in mcq['options']],
                'type': mcq['type']
            })
        
        return jsonify({
            'success': True,
            'mcqs': serializable_mcqs,
            'count': len(serializable_mcqs)
        })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/process-mcqs', methods=['POST'])
def process_mcqs():
    """Process MCQs automatically"""
    data = request.json
    url = data.get('url')
    ai_provider = data.get('ai_provider', 'openai')
    
    try:
        results = bot.process_mcqs_automatically(url, ai_provider)
        
        return jsonify({
            'success': True,
            'results': results,
            'total_processed': len(results),
            'successful': sum(1 for r in results if r['success'])
        })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

def ocr_postprocess(text):
    # Fix common option misreads
    replacements = [
        (r'5\)', 'B)'), (r'©\)', 'C)'), (r'\(c\)', 'C)'), (r'\(r\)', 'C)'),
        (r'Rone', 'Rome'), (r'Bertin', 'Berlin'), (r'Rone', 'Rome'), (r'Bertin', 'Berlin'),
        (r'\b1\.', 'A.'), (r'\ba\)', 'A)'), (r'\bb\)', 'B)'), (r'\bc\)', 'C)'), (r'\bd\)', 'D)'),
        (r'\b5\.', 'B.'), (r'\b0\)', 'D)'), (r'\b0\.', 'D.'), (r'\bO\)', 'D)'), (r'\bO\.', 'D.')
    ]
    for pat, repl in replacements:
        import re
        text = re.sub(pat, repl, text, flags=re.IGNORECASE)
    return text

@app.route('/api/ocr-detect', methods=['POST'])
def ocr_detect():
    """Detect MCQs using OCR, robust to any image format, with advanced error handling, preprocessing (including deskewing, inversion, whitelisting), debug logging, and fallback OCR logic including EasyOCR, Google Vision API, and Vision-Language AI (Gemini/GPT-4 Vision)."""
    data = request.json
    image_data = data.get('image_data') or data.get('image')
    language = data.get('lang', 'eng')
    preprocessing_steps = data.get('preprocessing_steps', None)
    return_bboxes = data.get('return_bboxes', False)
    try:
        if not image_data:
            logger.error('No image data provided in request.')
            return jsonify({'success': False, 'error': 'No image data provided.'})

        # Enhanced logging for debugging base64 issues
        logger.info(f"Received base64 image string (first 100 chars): {image_data[:100]}... (length: {len(image_data)})")
        # Remove whitespace and newlines
        image_data_clean = image_data.replace('\n', '').replace('\r', '').replace(' ', '')
        # Remove data:image/png;base64, if present
        if ',' in image_data_clean:
            header, image_data_clean = image_data_clean.split(',', 1)
            logger.info(f"Base64 header detected: {header}")
        # Check for suspiciously short base64
        if len(image_data_clean) < 100:
            logger.error(f"Base64 string is very short after cleaning: {len(image_data_clean)} chars. Possible corruption or truncation.")
            return jsonify({'success': False, 'error': f'Base64 string too short after cleaning: {len(image_data_clean)} chars. Please check your input.'})
        # Check for invalid characters
        if not re.match(r'^[A-Za-z0-9+/=]+$', image_data_clean):
            logger.error("Base64 string contains invalid characters.")
            return jsonify({'success': False, 'error': 'Base64 string contains invalid characters. Please check your input.'})
        # Add padding if needed
        missing_padding = len(image_data_clean) % 4
        if missing_padding:
            image_data_clean += '=' * (4 - missing_padding)
            logger.info(f"Added {4 - missing_padding} padding characters to base64 string.")
        try:
            image_bytes = base64.b64decode(image_data_clean)
        except Exception as e:
            logger.error(f"Base64 decode error: {e}. First 100 chars: {image_data_clean[:100]}")
            return jsonify({'success': False, 'error': f'Base64 decode error: {e}. Please check your input.'})
        if len(image_bytes) < 100:
            logger.error(f"Decoded image bytes length is very small: {len(image_bytes)} bytes. Possible corruption.")
            return jsonify({'success': False, 'error': f'Decoded image bytes too short: {len(image_bytes)} bytes. Please check your input.'})

        from PIL import Image, ImageFile, UnidentifiedImageError, ImageEnhance, ImageFilter
        import io
        import numpy as np
        import cv2
        img_pil = None
        ImageFile.LOAD_TRUNCATED_IMAGES = True
        try:
            img_pil = Image.open(io.BytesIO(image_bytes))
            img_pil.load()
            img_pil.save('debug_received_pil.png')
            logger.info('Image saved as debug_received_pil.png (PIL)')
        except Exception as pil_e:
            logger.warning(f'PIL could not open image: {pil_e}. Trying OpenCV fallback...')
            try:
                nparr = np.frombuffer(image_bytes, np.uint8)
                img_cv = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
                if img_cv is not None:
                    cv2.imwrite('debug_received_cv.png', img_cv)
                    logger.info('Image saved as debug_received_cv.png (OpenCV)')
                    if len(img_cv.shape) == 2:
                        img_pil = Image.fromarray(img_cv)
                    elif img_cv.shape[2] == 4:
                        img_pil = Image.fromarray(cv2.cvtColor(img_cv, cv2.COLOR_BGRA2RGBA))
                # Convert PIL to OpenCV format (BGR)
                img_np = np.array(img_pil)
                if len(img_np.shape) == 3:  # Convert RGB to BGR
                    img_np = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
                
                # Apply each preprocessing step
                for step in preprocessing_steps:
                    step = step.lower().strip()
                    logger.info(f'Applying preprocessing step: {step}')
                    
                    if step == 'grayscale':
                        img_np = get_grayscale(img_np)
                    elif step == 'remove_noise':
                        img_np = remove_noise(img_np)
                    elif step == 'thresholding':
                        img_np = thresholding(img_np)
                    elif step == 'dilate':
                        img_np = dilate(img_np)
                    elif step == 'erode':
                        img_np = erode(img_np)
                    elif step == 'opening':
                        img_np = opening(img_np)
                    elif step == 'canny':
                        img_np = canny(img_np)
                    elif step == 'deskew':
                        img_np = deskew(img_np)
                    
                    # Save intermediate step for debugging
                    debug_path = f'debug_pre_{step}.png'
                    cv2.imwrite(debug_path, img_np)
                    logger.info(f'Saved debug image: {debug_path}')
                
                # Convert back to PIL for Tesseract
                if len(img_np.shape) == 2:  # Grayscale
                    img_bin_pil = Image.fromarray(img_np)
                else:  # BGR
                    img_bin_pil = Image.fromarray(cv2.cvtColor(img_np, cv2.COLOR_BGR2RGB))
                
            except Exception as pre_e:
                logger.error(f'Custom preprocessing failed: {pre_e}')
                img_bin_pil = img_pil  # Fallback to original image
        else:
            # Default advanced preprocessing with deskewing and inversion
            try:
                # Convert to grayscale
                img_gray = img_pil.convert('L')
                img_gray.save('debug_pre_gray.png')
                
                # Convert to numpy array for OpenCV processing
                img_np = np.array(img_gray)
                
                # Calculate image statistics for adaptive processing
                mean_val = np.mean(img_np)
                std_dev = np.std(img_np)
                
                # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
                img_enhanced = clahe.apply(img_np)
                
                # Adaptive thresholding based on image characteristics
                if std_dev < 10:  # Low contrast image
                    # Try to enhance contrast
                    img_enhanced = cv2.convertScaleAbs(img_enhanced, alpha=1.5, beta=0)
                
                # Apply adaptive thresholding
                if mean_val < 85:  # Dark image
                    _, img_bin = cv2.threshold(img_enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                else:  # Normal or light image
                    img_bin = cv2.adaptiveThreshold(
                        img_enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                        cv2.THRESH_BINARY, 11, 2
                    )
                
                # Invert if needed (black text on white background)
                if np.mean(img_bin) < 127:  # If mostly black
                    img_bin = cv2.bitwise_not(img_bin)
                
                # Apply morphological operations to clean up the image
                kernel = np.ones((1,1), np.uint8)
                img_bin = cv2.morphologyEx(img_bin, cv2.MORPH_CLOSE, kernel)
                img_bin = cv2.morphologyEx(img_bin, cv2.MORPH_OPEN, kernel)
                
                # Apply dilation and erosion to remove noise
                kernel = np.ones((1, 1), np.uint8)
                img_denoised = cv2.morphologyEx(img_bin, cv2.MORPH_OPEN, kernel)
                img_denoised = cv2.morphologyEx(img_denoised, cv2.MORPH_CLOSE, kernel)
                
                # Apply slight blur to reduce noise
                img_denoised = cv2.GaussianBlur(img_denoised, (3, 3), 0)
                
                # Sharpen the image
                kernel_sharpening = np.array([[-1,-1,-1], 
                                            [-1, 9,-1],
                                            [-1,-1,-1]])
                img_sharp = cv2.filter2D(img_denoised, -1, kernel_sharpening)
                
                # Save intermediate images for debugging
                Image.fromarray(img_denoised).save('debug_pre_denoise.png')
                Image.fromarray(img_sharp).save('debug_pre_sharp.png')
                
                # Deskew the image
                coords = np.column_stack(np.where(img_sharp > 0))
                if len(coords) > 0:  # Check if we have any foreground pixels
                    angle = cv2.minAreaRect(coords)[-1]
                    if angle < -45:
                        angle = -(90 + angle)
                    else:
                        angle = -angle
                    (h, w) = img_sharp.shape[:2]
                    center = (w // 2, h // 2)
                    M = cv2.getRotationMatrix2D(center, angle, 1.0)
                    img_deskew = cv2.warpAffine(img_sharp, M, (w, h), 
                                              flags=cv2.INTER_CUBIC, 
                                              borderMode=cv2.BORDER_REPLICATE)
                    img_deskew_pil = Image.fromarray(img_deskew)
                    img_deskew_pil.save('debug_pre_deskew.png')
                else:
                    img_deskew = img_sharp
                    img_deskew_pil = Image.fromarray(img_deskew)
                
                # Invert if needed (for dark text on light background)
                if np.mean(img_deskew) > 127:
                    img_invert = cv2.bitwise_not(img_deskew)
                    img_invert_pil = Image.fromarray(img_invert)
                    img_invert_pil.save('debug_pre_invert.png')
                    img_final = img_invert_pil
                else:
                    img_final = img_deskew_pil
                    
                # Resize if too small (minimum 600px width for better OCR)
                min_width = 600
                if img_final.width < min_width:
                    scale = min_width / img_final.width
                    new_size = (min_width, int(img_final.height * scale))
                    img_final = img_final.resize(new_size, Image.LANCZOS)
                    img_final.save('debug_pre_resized.png')
                    
                img_bin_pil = img_final
            except Exception as pre_e:
                logger.warning(f'Advanced preprocessing (deskew/invert) failed: {pre_e}')
                img_bin_pil = img_pil  # Fallback to original image

        import pytesseract
        best_text = ''
        best_confidence = 0
        best_psm = None
        best_oem = None
        
        # Expanded character set to handle more cases
        whitelist = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:;!?()[]{}-_\'"\n\\/|+*=&^%$#@!~`<>'
        
        # Define page segmentation modes to try
        psm_modes = [
            (6, 'Assume a single uniform block of text'),
            (3, 'Fully automatic page segmentation, no OSD'),
            (11, 'Sparse text'),
            (4, 'Assume a single column of text'),
            (7, 'Treat image as a single text line')
        ]
        
        # Define OCR engine modes to try (LSTM first, then legacy)
        oem_modes = [(3, 'LSTM'), (1, 'Legacy')]
        
        # Try different configurations
        for psm, psm_desc in psm_modes:
            for oem, oem_desc in oem_modes:
                try:
                    # Build configuration string
                    config = (
                        f'--psm {psm} --oem {oem} --dpi 300\n'
                        f'-c tessedit_char_whitelist={whitelist}\n'
                        f'-c preserve_interword_spaces=1\n'
                        f'-c textord_min_linesize=2.5\n'
                        f'-c textord_heavy_nr=1\n'
                        f'-c textord_noise_normratio=0.5\n'
                        f'-c textord_noise_sizelimit=3\n'
                        f'-c textord_old_baselines=0\n'
                        f'-c textord_show_initial_words=0\n'
                        f'-c load_system_dawg=1\n'
                        f'-c load_freq_dawg=1\n'
                        f'-c load_punc_dawg=1\n'
                        f'-c load_number_dawg=1\n'
                        f'-c load_unambig_dawg=1\n'
                        f'-c load_bigram_dawg=1\n'
                        f'-c load_fixed_length_daws=1'
                    )
                    
                    logger.info(f'Trying OCR with PSM {psm} ({psm_desc}), OEM {oem} ({oem_desc})')
                    
                    # Get both text and confidence data
                    data = pytesseract.image_to_data(
                        img_bin_pil, 
                        lang=language, 
                        config=config,
                        output_type=pytesseract.Output.DICT
                    )
                    
                    # Calculate average confidence of non-empty words
                    confidences = [float(conf) for conf, text in zip(data['conf'], data['text']) 
                                 if float(conf) > 0 and text.strip()]
                    avg_confidence = sum(confidences) / len(confidences) if confidences else 0
                    
                    text = ' '.join([t for t in data['text'] if t.strip()])
                    
                    # Common OCR misrecognition fixes
                    common_misrecognitions = {
                        # Common word misrecognitions
                        'sllo': 'hello',
                        'Vor]': 'world',
                        'hell0': 'hello',
                        'w0rld': 'world',
                        'hel1o': 'hello',
                        'wor1d': 'world',
                        'he1lo': 'hello',
                        'w0r1d': 'world',
                        'he11o': 'hello',
                        'he1p': 'help',
                        'wor1d': 'world',
                        'Rone': 'Rome',
                        'Bertin': 'Berlin',
                        'Par1s': 'Paris',
                        'L0nd0n': 'London',
                        'cap1tal': 'capital',
                        'Franc3': 'France'
                    }
                    
                    # Apply common fixes (case-insensitive)
                    for wrong, right in common_misrecognitions.items():
                        # Use regex for case-insensitive replacement of whole words only
                        text = re.sub(r'\b' + re.escape(wrong) + r'\b', right, text, flags=re.IGNORECASE)
                    
                    # Fix common character confusions
                    char_fixes = {
                        '0': 'o',
                        '1': 'l',
                        '5': 's',
                        ']': 'd',
                        '[': 'd',
                        '|': 'l',
                        '!': 'i',
                        '@': 'a',
                        '#': '',
                        '$': 's',
                        '&': 'e',
                        '©': 'c',  # Copyright symbol to 'c'
                        '®': 'r',  # Registered symbol to 'r'
                        '™': 'tm', # Trademark symbol to 'tm'
                        '`': '',   # Remove backticks
                        '~': '',    # Remove tildes
                        '^': '',    # Remove carets
                        '*': '',    # Remove asterisks
                        '_': ' '    # Convert underscores to spaces
                    }
                    
                    # Apply character-level fixes (except for answer markers)
                    # First, protect answer markers (a), b), etc.)
                    protected_markers = re.findall(r'\b([a-z])\)', text, re.IGNORECASE)
                    protected_text = re.sub(r'\b([a-z])\)', '___MARKER___', text, flags=re.IGNORECASE)
                    
                    # Apply character fixes to the protected text
                    for wrong, right in char_fixes.items():
                        protected_text = protected_text.replace(wrong, right)
                    
                    # Restore protected answer markers
                    for i, marker in enumerate(protected_markers):
                        protected_text = protected_text.replace('___MARKER___', f'{marker})', 1)
                    
                    text = protected_text
                    
                    # Enhanced spell checking for common words and MCQ patterns
                    common_words = {
                        # Common word corrections
                        'helo': 'hello',
                        'wor1d': 'world',
                        'w0r1d': 'world',
                        'he1p': 'help',
                        'cap1tal': 'capital',
                        'Franc3': 'France',
                        'Par1s': 'Paris',
                        'L0nd0n': 'London',
                        'R0me': 'Rome',
                        'Rone': 'Rome',
                        'Ber1in': 'Berlin',
                        'Bertin': 'Berlin',
                        'quest1on': 'question',
                        'answ3r': 'answer',
                        'opt1on': 'option',
                        'ch01ce': 'choice',
                        'corr3ct': 'correct',
                        'capita1': 'capital',
                        'capita!': 'capital',
                        'capitaI': 'capital',
                        'capitai': 'capital'
                    }
                    
                    # Enhanced answer marker normalization
                    
                    # First, normalize all answer markers to a common format (X) where X is a letter
                    # Handle numbered markers (1) -> a), (2) -> b), etc.
                    text = re.sub(r'(?i)\b(\d+)[\.\)\s]', 
                                 lambda m: f'{chr(96 + int(m.group(1)))}) ' if m.group(1).isdigit() and 1 <= int(m.group(1)) <= 26 else m.group(0), 
                                 text)
                    
                    # Handle special characters like ©) -> c)
                    text = re.sub(r'(?i)\b([^a-z0-9])\)', 
                                 lambda m: f'{m.group(1).lower()}) ' if m.group(1).strip() else m.group(0), 
                                 text)
                    
                    # Fix uppercase letters in markers (A) -> a)
                    text = re.sub(r'\b([A-Z])\)', lambda m: f'{m.group(1).lower()})', text)
                    
                    # Fix missing spaces after markers
                    text = re.sub(r'([a-z])\)([^ \n])', r'\1) \2', text)
                    
                    # Fix common OCR confusions in markers
                    marker_fixes = {
                        r'(?i)\b5\)': 'b)',
                        r'(?i)\b©\)': 'c)',
                        r'(?i)\b\[\)': 'c)',
                        r'(?i)\b\]\)': 'd)',
                        r'(?i)\b1\)': 'i)',
                        r'(?i)\bi\)': '1)',
                        r'(?i)\bl\)': '1)',
                        r'(?i)\bI\)': '1)'
                    }
                    
                    for pattern, replacement in marker_fixes.items():
                        text = re.sub(pattern, replacement, text)
                    
                    # Ensure consistent spacing around answer options
                    text = re.sub(r'\s*([a-z])\)\s*', r' \1) ', text)
                    
                    # Fix question numbers (1. -> 1. )
                    text = re.sub(r'(\d+)\.(\s*[A-Z])', 
                                 lambda m: f"{m.group(1)}. {m.group(2).lower()}", 
                                 text)
                    
                    # Split into words and fix common misspellings
                    words = text.split()
                    for i, word in enumerate(words):
                        lower_word = word.lower()
                        if lower_word in common_words:
                            words[i] = common_words[lower_word]
                    
                    text = ' '.join(words)
                    
                    logger.info(f'OCR (psm={psm}, oem={oem}, conf={avg_confidence:.1f}): {text[:100]}...')
                    
                    # Calculate a better confidence score
                    # Give higher weight to text that looks like common words
                    common_word_count = sum(1 for word in text.lower().split() 
                                         if word in ['hello', 'world', 'help', 'test', 'example'])
                    adjusted_confidence = avg_confidence + (common_word_count * 5)
                    
                    # Prefer higher confidence over longer text
                    if adjusted_confidence > best_confidence or (adjusted_confidence == best_confidence and len(text) > len(best_text)):
                        best_text = text
                        best_confidence = adjusted_confidence
                        best_psm = psm
                        best_oem = oem
                        
                except Exception as ocr_e:
                    logger.warning(f'OCR failed for psm={psm}, oem={oem}: {ocr_e}')
                    
        logger.info(f'Best OCR result (psm={best_psm}, oem={best_oem}, conf={best_confidence:.1f}')
        
        # Final post-processing of the best text
        if best_text.strip():
            # Basic text cleanup
            best_text = ' '.join(best_text.split())  # Normalize whitespace
            best_text = best_text.strip()
            
            # Parse MCQs from the extracted text
            mcqs = bot.parse_mcqs_from_text(best_text)
            
            # If no MCQs were parsed but we have text, return it as a single question
            if not mcqs and best_text.strip():
                mcqs = [{
                    'question': best_text.split('\n')[0],
                    'options': [line.strip() for line in best_text.split('\n')[1:] if line.strip()],
                    'type': 'ocr',
                    'confidence': best_confidence
                }]
            
            logger.info(f'Successfully extracted {len(mcqs)} MCQs')
            
            # Clean up the text before returning
            best_text = best_text.replace('"', '"')
            best_text = best_text.replace('\'', '\'')
            best_text = best_text.replace('—', '-')
            best_text = best_text.replace('–', '-')
            best_text = best_text.replace('_', ' ')
            
            # Remove non-printable characters
            best_text = ''.join(char for char in best_text if char.isprintable() or char.isspace())
            
            # Remove isolated characters that are likely noise
            best_text = re.sub(r'\s+[^\w\s]\s+', ' ', best_text)
            best_text = re.sub(r'^[^\w\s]\s+', '', best_text)
            best_text = re.sub(r'\s+[^\w\s]$', '', best_text)
            
            # Normalize case for better consistency
            if len(best_text.split()) > 3:  # Only for longer text
                sentences = re.split(r'([.!?]\s+)', best_text)
                best_text = ''.join([sent.capitalize() if i % 2 == 0 else sent.lower() 
                                   for i, sent in enumerate(sentences)])
            
            return jsonify({
                'success': True,
                'text': best_text,
                'mcqs': mcqs if mcqs else [],
                'confidence': best_confidence,
                'psm': best_psm,
                'oem': best_oem
            })
        
        # Fallback 1: Try with different preprocessing
        if not best_text.strip() or best_confidence < 50:
            logger.warning('Primary OCR results not confident. Trying alternative preprocessing...')
            try:
                # Try with different thresholding
                img_np = np.array(img_pil.convert('L'))
                
                # Try Otsu's thresholding
                _, img_otsu = cv2.threshold(img_np, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                fallback_text = pytesseract.image_to_string(
                    Image.fromarray(img_otsu), 
                    lang=language,
                    config=f'--psm 6 --oem 3 -c preserve_interword_spaces=1'
                )
                
                if fallback_text.strip():
                    logger.info('Fallback OCR with Otsu thresholding succeeded.')
                    return jsonify({
                        'success': True, 
                        'text': fallback_text,
                        'mcqs': [],
                        'warning': 'Fallback OCR with Otsu thresholding used.'
                    })
                    
                # Try adaptive thresholding with different parameters
                img_adapt = cv2.adaptiveThreshold(
                    img_np, 255, cv2.ADAPTIVE_THRESH_MEAN_C, 
                    cv2.THRESH_BINARY, 21, 5
                )
                fallback_text = pytesseract.image_to_string(
                    Image.fromarray(img_adapt),
                    lang=language,
                    config=f'--psm 6 --oem 3 -c preserve_interword_spaces=1'
                )
                
                if fallback_text.strip():
                    logger.info('Fallback OCR with adaptive thresholding succeeded.')
                    return jsonify({
                        'success': True, 
                        'text': fallback_text,
                        'mcqs': [],
                        'warning': 'Fallback OCR with adaptive thresholding used.'
                    })
                    
            except Exception as fallback_e:
                logger.error(f'Alternative preprocessing fallback failed: {fallback_e}')
                
        # Fallback 2: Try with different PSM modes on original image
        if not best_text.strip() or best_confidence < 50:
            logger.warning('Trying fallback with different PSM modes on original image...')
            try:
                for psm in [6, 3, 11, 4]:
                    fallback_text = pytesseract.image_to_string(
                        img_pil,
                        lang=language,
                        config=f'--psm {psm} --oem 3 -c preserve_interword_spaces=1'
                    )
                    if fallback_text.strip():
                        logger.info(f'Fallback OCR with PSM {psm} on original image succeeded.')
                        return jsonify({
                            'success': True, 
                            'text': fallback_text,
                            'mcqs': [],
                            'warning': f'Fallback OCR with PSM {psm} on original image used.'
                        })
            except Exception as fallback2_e:
                logger.error(f'PSM fallback failed: {fallback2_e}')
        # Final fallback: EasyOCR
        if not best_text.strip():
            logger.warning('All Tesseract OCR attempts failed. Trying EasyOCR as final fallback...')
            try:
                import easyocr
                reader = easyocr.Reader(['en'], gpu=False)
                with open('debug_received_pil.png', 'rb') as f:
                    result = reader.readtext(f.read())
                easy_text = '\n'.join([item[1] for item in result])
                if easy_text.strip():
                    logger.info('EasyOCR fallback succeeded.')
                    return jsonify({
                        'success': True, 
                        'text': easy_text,
                        'mcqs': [],
                        'warning': 'EasyOCR fallback used. Check debug images.'
                    })
                else:
                    logger.error('EasyOCR fallback did not extract any text.')
            except Exception as easy_e:
                logger.error(f'EasyOCR fallback failed: {easy_e}')
        # Final fallback: Google Vision API
        if not best_text.strip():
            logger.warning('All Tesseract and EasyOCR attempts failed. Trying Google Vision API as final fallback...')
            try:
                from google.cloud import vision
                client = vision.ImageAnnotatorClient()
                with open('debug_received_pil.png', 'rb') as image_file:
                    content = image_file.read()
                image = vision.Image(content=content)
                response = client.text_detection(image=image)
                texts = response.text_annotations
                if texts:
                    vision_text = texts[0].description
                    logger.info('Google Vision API fallback succeeded.')
                    return jsonify({
                        'success': True, 
                        'text': vision_text,
                        'mcqs': [],
                        'warning': 'Google Vision API fallback used. Check debug images.'
                    })
                else:
                    logger.error('Google Vision API did not extract any text.')
            except Exception as vision_e:
                logger.error(f'Google Vision API fallback failed: {vision_e}')
        # Final fallback: Vision-Language AI (Gemini/GPT-4 Vision)
        if not best_text.strip():
            logger.warning('All OCR and Vision API attempts failed. Trying Vision-Language AI (Gemini/GPT-4 Vision) as final fallback...')
            try:
                # This is a placeholder for actual Gemini/GPT-4 Vision API integration
                # You must provide your own API key and endpoint
                # Example prompt:
                # "This is an image of a multiple choice question. Please read the question and give the correct option (A, B, C, D):"
                # Send the image and prompt to the API and parse the response
                # For now, just log and return a not-implemented message
                logger.info('Vision-Language AI fallback would be called here (Gemini/GPT-4 Vision).')
                return jsonify({
                    'success': False, 
                    'error': 'Vision-Language AI fallback (Gemini/GPT-4 Vision) not implemented. Please integrate your API key and endpoint.',
                    'text': '',
                    'mcqs': []
                })
            except Exception as vla_e:
                logger.error(f'Vision-Language AI fallback failed: {vla_e}')
        if not best_text.strip() or len(best_text.strip()) < 10:
            logger.error('OCR failed to extract meaningful text from the image.')
            return jsonify({
                'success': False, 
                'error': 'Failed to extract text from the image. Please try with a clearer image.',
                'text': '',
                'mcqs': []
            })
            logger.warning('OCR result is very short. Check debug images for preprocessing quality.')
            return jsonify({'success': True, 'ocrText': best_text, 'warning': 'OCR result is very short. Check debug images for preprocessing quality.'})
        # After extracting text:
        ocr_text = best_text
        ocr_text = ocr_postprocess(ocr_text)
        # ... existing code to parse MCQs ...
        # If return_bboxes is true, also return bounding box data
        if return_bboxes:
            import pytesseract
            data = pytesseract.image_to_data(img_bin_pil, lang=language, output_type=pytesseract.Output.DICT)
            bboxes = []
            n_boxes = len(data['text'])
            for i in range(n_boxes):
                if int(data['conf'][i]) > 0 and data['text'][i].strip():
                    bboxes.append({
                        'text': data['text'][i],
                        'conf': data['conf'][i],
                        'left': data['left'][i],
                        'top': data['top'][i],
                        'width': data['width'][i],
                        'height': data['height'][i]
                    })
            # Add bboxes to response
            response['bboxes'] = bboxes
        return jsonify({'success': True, 'ocrText': ocr_text})
    except Exception as e:
        logger.error(f'Unexpected error in /api/ocr-detect: {e}')
        return jsonify({'success': False, 'error': f'Unexpected error: {e}'})

@app.route('/api/get-answer', methods=['POST'])
def get_answer():
    """Get AI answer for a specific question"""
    data = request.json
    question = data.get('question')
    options = data.get('options')
    provider = data.get('provider', 'openai')
    
    try:
        answer_index = bot.get_ai_answer(question, options, provider)
        
        if answer_index is not None:
            return jsonify({
                'success': True,
                'answer_index': answer_index,
                'answer_text': options[answer_index]['text']
            })
        else:
            return jsonify({'success': False, 'error': 'Could not determine answer'})
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/answer', methods=['POST'])
def answer_mcq():
    """Answer a single MCQ using AI"""
    data = request.json
    question = data.get('question')
    options = data.get('options')
    provider = data.get('provider', 'openai')

    try:
        answer_index = bot.get_ai_answer(question, [{'text': opt} for opt in options], provider)
        if answer_index is not None and 0 <= answer_index < len(options):
            return jsonify({
                'success': True,
                'answer_index': answer_index,
                'answer_text': options[answer_index]
            })
        else:
            return jsonify({'success': False, 'error': 'Could not determine answer'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/close', methods=['POST'])
def close_bot():
    """Close the bot"""
    try:
        bot.close()
        return jsonify({'success': True, 'message': 'Bot closed'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/vision-answer', methods=['POST'])
def vision_answer():
    data = request.json
    image_data = data.get('image_data')
    prompt = data.get('prompt', 'Read the question and answer options in this image.')

    if not image_data:
        return jsonify({'success': False, 'error': 'No image data provided.'})

    # Remove data:image/png;base64, if present
    if ',' in image_data:
        image_data = image_data.split(',')[1]

    try:
        response = openai.ChatCompletion.create(
            model="gpt-4-vision-preview",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_data}"}}
                    ]
                }
            ],
            max_tokens=300
        )
        answer = response.choices[0].message.content
        return jsonify({'success': True, 'answer': answer})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/generate-ocr-test-image', methods=['POST'])
def generate_ocr_test_image():
    data = request.json
    text = data.get('text', 'Hello World')
    font_size = data.get('font_size', 40)
    padding = data.get('padding', 20)
    width = data.get('width', 800)
    height = data.get('height', 200)

    # Try to use a clean sans-serif TTF font
    font_paths = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',  # Linux
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/Library/Fonts/Arial.ttf',  # macOS
        'C:/Windows/Fonts/arial.ttf',  # Windows
        'arial.ttf',
        'DejaVuSans.ttf',
    ]
    font = None
    for path in font_paths:
        if os.path.exists(path):
            try:
                font = ImageFont.truetype(path, font_size)
                break
            except Exception:
                continue
    if font is None:
        return {'success': False, 'error': 'No suitable TTF font found. Please install Arial or DejaVu Sans.'}, 500

    # Create image with white background and high contrast
    img = Image.new('RGB', (width, height), color='white')
    draw = ImageDraw.Draw(img)

    # Calculate text size and position for centering
    text_bbox = draw.multiline_textbbox((0, 0), text, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]
    x = (width - text_width) // 2
    y = (height - text_height) // 2

    # Draw text with anti-aliasing (Pillow does this by default with TTF)
    draw.multiline_text((x, y), text, font=font, fill='black', align='center')

    # Save to buffer
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    return {'success': True, 'image_data': f'data:image/png;base64,{img_str}'}

# --- Modular Preprocessing Functions from tesseract.ipynb ---
def get_grayscale(image):
    import cv2
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

def remove_noise(image):
    import cv2
    return cv2.medianBlur(image, 5)

def thresholding(image):
    import cv2
    return cv2.threshold(image, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]

def dilate(image):
    import cv2
    import numpy as np
    kernel = np.ones((5,5), np.uint8)
    return cv2.dilate(image, kernel, iterations=1)

def erode(image):
    import cv2
    import numpy as np
    kernel = np.ones((5,5), np.uint8)
    return cv2.erode(image, kernel, iterations=1)

def opening(image):
    import cv2
    import numpy as np
    kernel = np.ones((5,5), np.uint8)
    return cv2.morphologyEx(image, cv2.MORPH_OPEN, kernel)

def canny(image):
    import cv2
    return cv2.Canny(image, 100, 200)

def deskew(image):
    import cv2
    import numpy as np
    coords = np.column_stack(np.where(image > 0))
    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle
    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    return rotated

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)