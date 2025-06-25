import os
import json
import base64
from flask import Flask, request, jsonify, render_template
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
from PIL import Image, ImageFile, UnidentifiedImageError, ImageEnhance, ImageFilter
import io
from dotenv import load_dotenv

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
        """Parse MCQs from extracted text"""
        mcqs = []
        lines = text.split('\n')
        
        current_question = ""
        current_options = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Check if line is a question (contains ?)
            if '?' in line and len(line) > 10:
                # Save previous MCQ if exists
                if current_question and len(current_options) >= 2:
                    mcqs.append({
                        'question': current_question,
                        'options': [{'text': opt, 'value': opt} for opt in current_options],
                        'type': 'text'
                    })
                
                current_question = line
                current_options = []
            
            # Check if line is an option (starts with A, B, C, D or 1, 2, 3, 4)
            elif re.match(r'^[A-D][\.\)]\s*|^[1-4][\.\)]\s*', line):
                option_text = re.sub(r'^[A-D1-4][\.\)]\s*', '', line)
                if option_text:
                    current_options.append(option_text)
        
        # Add last MCQ
        if current_question and len(current_options) >= 2:
            mcqs.append({
                'question': current_question,
                'options': [{'text': opt, 'value': opt} for opt in current_options],
                'type': 'text'
            })
        
        return mcqs
    
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

@app.route('/api/ocr-detect', methods=['POST'])
def ocr_detect():
    """Detect MCQs using OCR, robust to any image format, with advanced error handling, preprocessing (including deskewing, inversion, whitelisting), debug logging, and fallback OCR logic including EasyOCR, Google Vision API, and Vision-Language AI (Gemini/GPT-4 Vision)."""
    data = request.json
    image_data = data.get('image_data') or data.get('image')  # support both keys
    language = data.get('lang', 'eng')
    try:
        if not image_data:
            logger.error('No image data provided in request.')
            return jsonify({'success': False, 'error': 'No image data provided.'})

        logger.info(f"Received base64 image string (first 100 chars): {image_data[:100]}... (length: {len(image_data)})")
        image_data = image_data.replace('\n', '').replace('\r', '').replace(' ', '')
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        missing_padding = len(image_data) % 4
        if missing_padding:
            image_data += '=' * (4 - missing_padding)
        try:
            image_bytes = base64.b64decode(image_data)
        except Exception as e:
            logger.error(f"Base64 decode error: {e}")
            return jsonify({'success': False, 'error': f'Base64 decode error: {e}'})
        if len(image_bytes) < 100:
            logger.warning(f"Decoded image bytes length is very small: {len(image_bytes)} bytes. Possible corruption.")

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
                    else:
                        img_pil = Image.fromarray(cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB))
                else:
                    logger.error(f'Could not decode image with PIL or OpenCV. Details: {pil_e}')
                    return jsonify({'success': False, 'error': f'Could not decode image with PIL or OpenCV. Details: {pil_e}'})
            except Exception as cv_e:
                logger.error(f'OpenCV also failed to decode image. Details: {cv_e}')
                return jsonify({'success': False, 'error': f'Could not decode image with PIL or OpenCV. Details: {cv_e}'})

        # Advanced preprocessing with deskewing and inversion
        try:
            img_gray = img_pil.convert('L')
            img_gray.save('debug_pre_gray.png')
            enhancer = ImageEnhance.Contrast(img_gray)
            img_contrast = enhancer.enhance(2.0)
            img_contrast.save('debug_pre_contrast.png')
            img_sharp = img_contrast.filter(ImageFilter.SHARPEN)
            img_sharp.save('debug_pre_sharp.png')
            img_denoise = img_sharp.filter(ImageFilter.MedianFilter(size=3))
            img_denoise.save('debug_pre_denoise.png')
            img_np = np.array(img_denoise)
            img_bin = cv2.adaptiveThreshold(img_np, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 2)
            img_bin_pil = Image.fromarray(img_bin)
            img_bin_pil.save('debug_pre_bin.png')
            coords = np.column_stack(np.where(img_bin > 0))
            angle = cv2.minAreaRect(coords)[-1]
            if angle < -45:
                angle = -(90 + angle)
            else:
                angle = -angle
            (h, w) = img_bin.shape[:2]
            M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
            img_deskew = cv2.warpAffine(img_bin, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
            img_deskew_pil = Image.fromarray(img_deskew)
            img_deskew_pil.save('debug_pre_deskew.png')
            if np.mean(img_deskew) > 127:
                img_invert = cv2.bitwise_not(img_deskew)
                img_invert_pil = Image.fromarray(img_invert)
                img_invert_pil.save('debug_pre_invert.png')
                img_bin_pil = img_invert_pil
            else:
                img_bin_pil = img_deskew_pil
            if img_bin_pil.width < 800:
                scale = 800 / img_bin_pil.width
                new_size = (int(img_bin_pil.width * scale), int(img_bin_pil.height * scale))
                img_bin_pil = img_bin_pil.resize(new_size, Image.LANCZOS)
                img_bin_pil.save('debug_pre_resized.png')
        except Exception as pre_e:
            logger.warning(f'Advanced preprocessing (deskew/invert) failed: {pre_e}')
            img_bin_pil = img_pil

        import pytesseract
        best_text = ''
        best_len = 0
        best_psm = None
        best_oem = None
        whitelist = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:;!?()[]{}- \'"\n'
        psm_modes = [6, 3, 11, 12, 4, 7]
        oem_modes = [3, 1]
        for psm in psm_modes:
            for oem in oem_modes:
                try:
                    config = f'--psm {psm} --oem {oem} -c tessedit_char_whitelist="{whitelist}"'
                    text = pytesseract.image_to_string(img_bin_pil, lang=language, config=config)
                    logger.info(f'OCR text (psm={psm}, oem={oem}, first 100 chars): {text[:100]}')
                    if len(text) > best_len:
                        best_text = text
                        best_len = len(text)
                        best_psm = psm
                        best_oem = oem
                except Exception as ocr_e:
                    logger.warning(f'OCR failed for psm={psm}, oem={oem}: {ocr_e}')
        # Fallback: try OCR on the original preprocessed image
        if not best_text.strip():
            logger.warning('All advanced OCR attempts failed. Trying fallback on original preprocessed image...')
            try:
                fallback_text = pytesseract.image_to_string(img_bin_pil, lang=language)
                if fallback_text.strip():
                    logger.info('Fallback OCR on preprocessed image succeeded.')
                    return jsonify({'success': True, 'ocrText': fallback_text, 'warning': 'Fallback OCR on preprocessed image used. Check debug images.'})
            except Exception as fallback_e:
                logger.error(f'Fallback OCR on preprocessed image also failed: {fallback_e}')
        # Fallback: try OCR on the original PIL image
        if not best_text.strip():
            logger.warning('All advanced and preprocessed OCR attempts failed. Trying fallback on original PIL image...')
            try:
                fallback_text2 = pytesseract.image_to_string(img_pil, lang=language)
                if fallback_text2.strip():
                    logger.info('Fallback OCR on original PIL image succeeded.')
                    return jsonify({'success': True, 'ocrText': fallback_text2, 'warning': 'Fallback OCR on original PIL image used. Check debug images.'})
            except Exception as fallback2_e:
                logger.error(f'Fallback OCR on original PIL image also failed: {fallback2_e}')
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
                    return jsonify({'success': True, 'ocrText': easy_text, 'warning': 'EasyOCR fallback used. Check debug images.'})
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
                    return jsonify({'success': True, 'ocrText': vision_text, 'warning': 'Google Vision API fallback used. Check debug images.'})
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
                return jsonify({'success': False, 'error': 'Vision-Language AI fallback (Gemini/GPT-4 Vision) not implemented. Please integrate your API key and endpoint.'})
            except Exception as vla_e:
                logger.error(f'Vision-Language AI fallback failed: {vla_e}')
        if not best_text.strip():
            logger.error('OCR failed for all PSM/OEM modes, fallbacks, and Vision APIs.')
            return jsonify({'success': False, 'error': 'OCR failed for all PSM/OEM modes, fallbacks, and Vision APIs.'})
        if len(best_text.strip()) < 10:
            logger.warning('OCR result is very short. Check debug images for preprocessing quality.')
            return jsonify({'success': True, 'ocrText': best_text, 'warning': 'OCR result is very short. Check debug images for preprocessing quality.'})
        return jsonify({'success': True, 'ocrText': best_text})
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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)