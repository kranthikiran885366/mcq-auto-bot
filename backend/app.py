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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

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
        if image_data:
            # Decode base64 image
            image_bytes = base64.b64decode(image_data.split(',')[1])
            nparr = np.frombuffer(image_bytes, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        else:
            # Take screenshot
            screenshot = self.driver.get_screenshot_as_png()
            nparr = np.frombuffer(screenshot, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Preprocess image for better OCR
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        gray = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
        
        # Extract text using OCR
        text = pytesseract.image_to_string(gray, config='--psm 6')
        
        # Parse MCQs from text
        mcqs = self.parse_mcqs_from_text(text)
        return mcqs
    
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
    """Detect MCQs using OCR"""
    data = request.json
    image_data = data.get('image_data')
    
    try:
        mcqs = bot.detect_mcqs_ocr(image_data)
        
        return jsonify({
            'success': True,
            'mcqs': mcqs,
            'count': len(mcqs)
        })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

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