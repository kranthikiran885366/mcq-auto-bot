import os
import json
import base64
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
from selenium.webdriver.common.action_chains import ActionChains
import time
import re
from typing import List, Dict, Optional
import logging
import random
import difflib
import unicodedata
import string

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AdvancedMCQBot:
    def __init__(self):
        self.driver = None
        self.openai_client = None
        self.genai_client = None
        self.config = {
            'auto_answer': True,
            'answer_delay': 3,
            'max_retries': 3,
            'stealth_mode': True,
            'human_like_behavior': True
        }
        
    def setup_stealth_driver(self, headless=True):
        """Setup Chrome driver with advanced stealth options"""
        chrome_options = Options()
        
        if headless:
            chrome_options.add_argument('--headless=new')
        
        # Advanced stealth options
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_argument('--disable-extensions')
        chrome_options.add_argument('--disable-plugins')
        chrome_options.add_argument('--disable-images')
        chrome_options.add_argument('--disable-javascript')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        # Random user agent
        user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        ]
        chrome_options.add_argument(f'--user-agent={random.choice(user_agents)}')
        
        self.driver = webdriver.Chrome(options=chrome_options)
        
        # Execute stealth scripts
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        self.driver.execute_script("Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]})")
        self.driver.execute_script("Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']})")
        
    def human_like_delay(self, min_delay=1, max_delay=3):
        """Add human-like random delays"""
        delay = random.uniform(min_delay, max_delay)
        time.sleep(delay)
        
    def human_like_scroll(self):
        """Simulate human-like scrolling behavior"""
        scroll_pause_time = random.uniform(0.5, 1.5)
        
        # Get scroll height
        last_height = self.driver.execute_script("return document.body.scrollHeight")
        
        # Scroll down in chunks
        for i in range(0, last_height, random.randint(200, 400)):
            self.driver.execute_script(f"window.scrollTo(0, {i});")
            time.sleep(scroll_pause_time)
            
        # Scroll back to top
        self.driver.execute_script("window.scrollTo(0, 0);")
        time.sleep(scroll_pause_time)
    
    def detect_advanced_mcqs(self, url=None):
        """Advanced MCQ detection with multiple strategies"""
        if url:
            self.driver.get(url)
            self.human_like_delay(2, 4)
            self.human_like_scroll()
        
        mcqs = []
        
        # Strategy 1: Form-based detection
        mcqs.extend(self._detect_form_mcqs())
        
        # Strategy 2: List-based detection
        mcqs.extend(self._detect_list_mcqs())
        
        # Strategy 3: Table-based detection
        mcqs.extend(self._detect_table_mcqs())
        
        # Strategy 4: Custom pattern detection
        mcqs.extend(self._detect_pattern_mcqs())
        
        # Remove duplicates
        unique_mcqs = []
        seen_questions = set()
        
        for mcq in mcqs:
            question_key = mcq['question'].strip().lower()
            if question_key not in seen_questions:
                seen_questions.add(question_key)
                unique_mcqs.append(mcq)
        
        return unique_mcqs
    
    def _detect_form_mcqs(self):
        """Detect MCQs within form elements"""
        mcqs = []
        
        try:
            forms = self.driver.find_elements(By.TAG_NAME, "form")
            
            for form in forms:
                # Find radio button groups
                radio_groups = {}
                radios = form.find_elements(By.CSS_SELECTOR, "input[type='radio']")
                
                for radio in radios:
                    name = radio.get_attribute('name')
                    if name:
                        if name not in radio_groups:
                            radio_groups[name] = []
                        radio_groups[name].append(radio)
                
                # Process each radio group as potential MCQ
                for group_name, group_radios in radio_groups.items():
                    if len(group_radios) >= 2:
                        mcq_data = self._extract_mcq_from_group(group_radios, 'radio')
                        if mcq_data:
                            mcqs.append(mcq_data)
                
                # Find checkbox groups
                checkboxes = form.find_elements(By.CSS_SELECTOR, "input[type='checkbox']")
                if len(checkboxes) >= 2:
                    mcq_data = self._extract_mcq_from_group(checkboxes, 'checkbox')
                    if mcq_data:
                        mcqs.append(mcq_data)
        
        except Exception as e:
            logger.error(f"Error in form-based detection: {e}")
        
        return mcqs
    
    def _detect_list_mcqs(self):
        """Detect MCQs in list structures"""
        mcqs = []
        
        try:
            # Look for ordered and unordered lists
            lists = self.driver.find_elements(By.CSS_SELECTOR, "ol, ul")
            
            for list_elem in lists:
                list_items = list_elem.find_elements(By.TAG_NAME, "li")
                
                if len(list_items) >= 2:
                    # Check if list items contain radio buttons or checkboxes
                    has_inputs = any(
                        item.find_elements(By.CSS_SELECTOR, "input[type='radio'], input[type='checkbox']")
                        for item in list_items
                    )
                    
                    if has_inputs:
                        mcq_data = self._extract_mcq_from_list(list_elem, list_items)
                        if mcq_data:
                            mcqs.append(mcq_data)
        
        except Exception as e:
            logger.error(f"Error in list-based detection: {e}")
        
        return mcqs
    
    def _detect_table_mcqs(self):
        """Detect MCQs in table structures"""
        mcqs = []
        
        try:
            tables = self.driver.find_elements(By.TAG_NAME, "table")
            
            for table in tables:
                rows = table.find_elements(By.TAG_NAME, "tr")
                
                for row in rows:
                    cells = row.find_elements(By.CSS_SELECTOR, "td, th")
                    
                    # Check if row contains input elements
                    inputs = row.find_elements(By.CSS_SELECTOR, "input[type='radio'], input[type='checkbox']")
                    
                    if len(inputs) >= 2:
                        mcq_data = self._extract_mcq_from_table_row(row, inputs)
                        if mcq_data:
                            mcqs.append(mcq_data)
        
        except Exception as e:
            logger.error(f"Error in table-based detection: {e}")
        
        return mcqs
    
    def _detect_pattern_mcqs(self):
        """Detect MCQs using text patterns"""
        mcqs = []
        
        try:
            # Look for common MCQ patterns in text
            page_text = self.driver.find_element(By.TAG_NAME, "body").text
            
            # Pattern: Question followed by A) B) C) D) options
            pattern = r'(.+\?)\s*\n\s*A\)\s*(.+?)\s*\n\s*B\)\s*(.+?)\s*\n\s*C\)\s*(.+?)(?:\s*\n\s*D\)\s*(.+?))?'
            matches = re.finditer(pattern, page_text, re.MULTILINE | re.DOTALL)
            
            for match in matches:
                question = match.group(1).strip()
                options = [
                    {'text': match.group(2).strip(), 'value': 'A'},
                    {'text': match.group(3).strip(), 'value': 'B'},
                    {'text': match.group(4).strip(), 'value': 'C'}
                ]
                
                if match.group(5):
                    options.append({'text': match.group(5).strip(), 'value': 'D'})
                
                mcqs.append({
                    'question': question,
                    'options': options,
                    'type': 'pattern',
                    'container': None
                })
        
        except Exception as e:
            logger.error(f"Error in pattern-based detection: {e}")
        
        return mcqs
    
    def _extract_mcq_from_group(self, input_elements, input_type):
        """Extract MCQ data from a group of input elements"""
        try:
            # Find the question by looking for nearby text
            question_text = ""
            
            # Look for question in various places
            for element in input_elements:
                # Check parent elements for question text
                parent = element
                for _ in range(5):
                    try:
                        parent = parent.find_element(By.XPATH, "..")
                        text = parent.text.strip()
                        
                        if '?' in text and len(text) > 10:
                            # Extract the question part
                            question_candidates = [line.strip() for line in text.split('\n') if '?' in line]
                            if question_candidates:
                                question_text = question_candidates[0]
                                break
                    except:
                        break
                
                if question_text:
                    break
            
            # Extract options
            options = []
            for element in input_elements:
                option_text = ""
                
                # Try to get text from associated label
                try:
                    element_id = element.get_attribute('id')
                    if element_id:
                        label = self.driver.find_element(By.CSS_SELECTOR, f"label[for='{element_id}']")
                        option_text = label.text.strip()
                except:
                    pass
                
                # Try to get text from parent or sibling elements
                if not option_text:
                    try:
                        parent = element.find_element(By.XPATH, "..")
                        option_text = parent.text.strip()
                        
                        # Remove question text if it's included
                        if question_text and question_text in option_text:
                            option_text = option_text.replace(question_text, "").strip()
                    except:
                        pass
                
                # Try to get value attribute
                if not option_text:
                    option_text = element.get_attribute('value') or f"Option {len(options) + 1}"
                
                if option_text and len(option_text) > 0:
                    options.append({
                        'text': option_text,
                        'element': element,
                        'value': element.get_attribute('value') or option_text
                    })
            
            if question_text and len(options) >= 2:
                return {
                    'question': question_text,
                    'options': options,
                    'type': input_type,
                    'container': input_elements[0].find_element(By.XPATH, "../..")
                }
        
        except Exception as e:
            logger.error(f"Error extracting MCQ from group: {e}")
        
        return None
    
    def _extract_mcq_from_list(self, list_elem, list_items):
        """Extract MCQ data from list structure"""
        try:
            # Look for question before the list
            question_text = ""
            
            # Check previous siblings for question
            try:
                prev_element = list_elem.find_element(By.XPATH, "preceding-sibling::*[1]")
                if '?' in prev_element.text:
                    question_text = prev_element.text.strip()
            except:
                pass
            
            # Check parent for question
            if not question_text:
                try:
                    parent_text = list_elem.find_element(By.XPATH, "..").text
                    if '?' in parent_text:
                        lines = parent_text.split('\n')
                        for line in lines:
                            if '?' in line:
                                question_text = line.strip()
                                break
                except:
                    pass
            
            # Extract options from list items
            options = []
            for item in list_items:
                input_elem = item.find_elements(By.CSS_SELECTOR, "input[type='radio'], input[type='checkbox']")
                
                if input_elem:
                    option_text = item.text.strip()
                    
                    # Clean up option text
                    if option_text:
                        options.append({
                            'text': option_text,
                            'element': input_elem[0],
                            'value': input_elem[0].get_attribute('value') or option_text
                        })
            
            if question_text and len(options) >= 2:
                input_type = 'radio' if options[0]['element'].get_attribute('type') == 'radio' else 'checkbox'
                
                return {
                    'question': question_text,
                    'options': options,
                    'type': input_type,
                    'container': list_elem
                }
        
        except Exception as e:
            logger.error(f"Error extracting MCQ from list: {e}")
        
        return None
    
    def _extract_mcq_from_table_row(self, row, inputs):
        """Extract MCQ data from table row"""
        try:
            # Get question from first cell or previous row
            question_text = ""
            
            cells = row.find_elements(By.CSS_SELECTOR, "td, th")
            if cells:
                first_cell_text = cells[0].text.strip()
                if '?' in first_cell_text:
                    question_text = first_cell_text
            
            # If no question in current row, check previous rows
            if not question_text:
                try:
                    table = row.find_element(By.XPATH, "ancestor::table")
                    rows = table.find_elements(By.TAG_NAME, "tr")
                    
                    current_row_index = rows.index(row)
                    
                    for i in range(current_row_index - 1, -1, -1):
                        prev_row_text = rows[i].text.strip()
                        if '?' in prev_row_text:
                            question_text = prev_row_text
                            break
                except:
                    pass
            
            # Extract options
            options = []
            for input_elem in inputs:
                # Get option text from the cell containing the input
                try:
                    cell = input_elem.find_element(By.XPATH, "ancestor::td | ancestor::th")
                    option_text = cell.text.strip()
                    
                    if option_text:
                        options.append({
                            'text': option_text,
                            'element': input_elem,
                            'value': input_elem.get_attribute('value') or option_text
                        })
                except:
                    pass
            
            if question_text and len(options) >= 2:
                input_type = 'radio' if inputs[0].get_attribute('type') == 'radio' else 'checkbox'
                
                return {
                    'question': question_text,
                    'options': options,
                    'type': input_type,
                    'container': row
                }
        
        except Exception as e:
            logger.error(f"Error extracting MCQ from table row: {e}")
        
        return None
    
    def smart_answer_selection(self, mcq, answer_index):
        """Intelligently select answers with human-like behavior"""
        try:
            if mcq['type'] == 'pattern':
                logger.info(f"Pattern-based MCQ - Answer: {mcq['options'][answer_index]['text']}")
                return True
            
            option = mcq['options'][answer_index]
            element = option['element']
            
            # Scroll to element with human-like behavior
            self.driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", element)
            self.human_like_delay(0.5, 1.5)
            
            # Move mouse to element (if not headless)
            try:
                actions = ActionChains(self.driver)
                actions.move_to_element(element).perform()
                self.human_like_delay(0.2, 0.8)
            except:
                pass
            
            # Try multiple click strategies
            success = False
            
            # Strategy 1: Regular click
            try:
                if element.is_enabled() and element.is_displayed():
                    element.click()
                    success = True
                    logger.info(f"Selected option via regular click: {option['text']}")
            except:
                pass
            
            # Strategy 2: JavaScript click
            if not success:
                try:
                    self.driver.execute_script("arguments[0].click();", element)
                    success = True
                    logger.info(f"Selected option via JS click: {option['text']}")
                except:
                    pass
            
            # Strategy 3: Action chains click
            if not success:
                try:
                    actions = ActionChains(self.driver)
                    actions.click(element).perform()
                    success = True
                    logger.info(f"Selected option via action chains: {option['text']}")
                except:
                    pass
            
            # Strategy 4: Set checked attribute
            if not success:
                try:
                    self.driver.execute_script("arguments[0].checked = true;", element)
                    success = True
                    logger.info(f"Selected option via checked attribute: {option['text']}")
                except:
                    pass
            
            # Add human-like delay after selection
            if success:
                self.human_like_delay(0.5, 2.0)
            
            return success
                
        except Exception as e:
            logger.error(f"Error selecting answer: {e}")
            return False
    
    def process_mcqs_with_intelligence(self, url, ai_provider='openai'):
        """Process MCQs with advanced intelligence and human-like behavior"""
        results = []
        
        try:
            # Navigate to URL with human-like behavior
            if url:
                self.driver.get(url)
                self.human_like_delay(3, 6)
                self.human_like_scroll()
            
            # Detect MCQs using advanced methods
            mcqs = self.detect_advanced_mcqs()
            
            logger.info(f"Found {len(mcqs)} MCQs using advanced detection")
            
            # Process each MCQ with intelligence
            for i, mcq in enumerate(mcqs):
                logger.info(f"Processing MCQ {i+1}/{len(mcqs)}: {mcq['question'][:50]}...")
                
                # Add random delay between questions
                if i > 0:
                    self.human_like_delay(2, 5)
                
                # Get AI answer with retry logic
                answer_index = None
                for attempt in range(self.config['max_retries']):
                    try:
                        answer_index = self.get_ai_answer(mcq['question'], mcq['options'], ai_provider)
                        if answer_index is not None:
                            break
                    except Exception as e:
                        logger.warning(f"AI answer attempt {attempt + 1} failed: {e}")
                        if attempt < self.config['max_retries'] - 1:
                            time.sleep(2)
                
                if answer_index is not None and 0 <= answer_index < len(mcq['options']):
                    # Add configured delay for natural behavior
                    delay = self.config['answer_delay'] + random.uniform(-1, 2)
                    time.sleep(max(1, delay))
                    
                    # Select answer with intelligence
                    success = self.smart_answer_selection(mcq, answer_index)
                    
                    results.append({
                        'question': mcq['question'],
                        'selected_answer': mcq['options'][answer_index]['text'],
                        'success': success,
                        'answer_index': answer_index,
                        'attempt': i + 1
                    })
                else:
                    results.append({
                        'question': mcq['question'],
                        'selected_answer': None,
                        'success': False,
                        'error': 'Could not determine answer after retries',
                        'attempt': i + 1
                    })
        
        except Exception as e:
            logger.error(f"Error processing MCQs: {e}")
        
        return results
    
    def get_ai_answer(self, question, options, provider='openai'):
        """Get AI answer with improved prompting and enhanced matching logic"""
        options_text = '\n'.join([f"{chr(65+i)}. {opt['text']}" for i, opt in enumerate(options)])
        prompt = f"""
        You are an expert at answering multiple choice questions. Analyze the following question and options carefully.

        Question: {question}

        Options:
        {options_text}

        Instructions:
        1. Read the question carefully and understand what is being asked.
        2. Analyze each option thoroughly.
        3. Use your knowledge to determine the most accurate answer.
        4. Respond ONLY with the letter of the correct option (A, B, C, or D).
        5. Do not provide any explanation, just the letter.

        Answer:
        """
        def clean_text(s):
            s = s.strip().lower()
            s = unicodedata.normalize('NFKD', s)
            s = s.translate(str.maketrans('', '', string.punctuation))
            s = s.replace('  ', ' ')
            return s
        def fuzzy_match(a, b):
            return difflib.SequenceMatcher(None, a, b).ratio()
        try:
            if provider == 'openai' and self.openai_client:
                response = self.openai_client.chat.completions.create(
                    model="gpt-4",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1,
                    max_tokens=5
                )
                answer = response.choices[0].message.content.strip().upper()
            elif provider == 'gemini' and self.genai_client:
                response = self.genai_client.generate_content(prompt)
                answer = response.text.strip().upper()
            else:
                return None
            import re
            # 1. Letter (A-D)
            match = re.search(r'\b([A-D])\b', answer)
            if match:
                idx = ord(match.group(1)) - ord('A')
                if 0 <= idx < len(options):
                    logger.info(f"Matched by letter: {match.group(1)}")
                    return idx
            # 2. Number (1-9)
            match = re.search(r'\b([1-9])\b', answer)
            if match:
                idx = int(match.group(1)) - 1
                if 0 <= idx < len(options):
                    logger.info(f"Matched by number: {match.group(1)}")
                    return idx
            # 3. Option text exact
            for i, opt in enumerate(options):
                opt_clean = clean_text(opt['text'])
                if opt_clean == clean_text(answer):
                    logger.info(f"Matched by exact text: {opt['text']}")
                    return i
            # 4. Option text substring
            for i, opt in enumerate(options):
                opt_clean = clean_text(opt['text'])
                if opt_clean in clean_text(answer) or clean_text(answer) in opt_clean:
                    logger.info(f"Matched by substring: {opt['text']}")
                    return i
            # 5. Fuzzy match
            for i, opt in enumerate(options):
                opt_clean = clean_text(opt['text'])
                score = fuzzy_match(opt_clean, clean_text(answer))
                if score > 0.8:
                    logger.info(f"Matched by fuzzy ({score:.2f}): {opt['text']}")
                    return i
            # 6. Patterns like 'option a', 'option 1', 'the answer is ...'
            match = re.search(r'option\s*([A-D1-9])', answer)
            if match:
                val = match.group(1)
                if val.isalpha():
                    idx = ord(val) - ord('A')
                else:
                    idx = int(val) - 1
                if 0 <= idx < len(options):
                    logger.info(f"Matched by pattern 'option': {val}")
                    return idx
            match = re.search(r'the answer is\s*([A-D1-9])', answer)
            if match:
                val = match.group(1)
                if val.isalpha():
                    idx = ord(val) - ord('A')
                else:
                    idx = int(val) - 1
                if 0 <= idx < len(options):
                    logger.info(f"Matched by pattern 'the answer is': {val}")
                    return idx
            # 7. Patterns like 'A (Paris)', 'B (London)' etc.
            match = re.search(r'([A-D])\s*\([^)]+\)', answer)
            if match:
                idx = ord(match.group(1)) - ord('A')
                if 0 <= idx < len(options):
                    logger.info(f"Matched by pattern 'A (Option)': {match.group(1)}")
                    return idx
            # 8. Try matching after removing all spaces
            answer_no_space = clean_text(answer).replace(' ', '')
            for i, opt in enumerate(options):
                opt_no_space = clean_text(opt['text']).replace(' ', '')
                if opt_no_space == answer_no_space:
                    logger.info(f"Matched by no-space exact: {opt['text']}")
                    return i
            logger.warning(f"No match found for answer: {answer}")
            return None
        except Exception as e:
            logger.error(f"Error getting AI answer: {e}")
        return None
    
    def setup_ai_clients(self, openai_key=None, gemini_key=None, gemini_model=None):
        """Setup AI clients with error handling"""
        try:
            if openai_key:
                self.openai_client = openai.OpenAI(api_key=openai_key)
                logger.info("OpenAI client initialized successfully")
        except Exception as e:
            logger.error(f"Error setting up OpenAI client: {e}")
        
        try:
            if gemini_key:
                genai.configure(api_key=gemini_key)
                model_name = gemini_model or 'gemini-pro'
                self.genai_client = genai.GenerativeModel(model_name)
                logger.info(f"Gemini client initialized successfully with model: {model_name}")
        except Exception as e:
            logger.error(f"Error setting up Gemini client: {e}")
    
    def close(self):
        """Safely close the driver"""
        try:
            if self.driver:
                self.driver.quit()
                logger.info("Driver closed successfully")
        except Exception as e:
            logger.error(f"Error closing driver: {e}")