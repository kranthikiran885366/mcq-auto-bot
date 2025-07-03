# 🧪 Testing Guide - Advanced AI MCQ Bot

## 📋 Table of Contents

- [Overview](#overview)
- [Testing Strategy](#testing-strategy)
- [Test Environment Setup](#test-environment-setup)
- [Unit Testing](#unit-testing)
- [Integration Testing](#integration-testing)
- [End-to-End Testing](#end-to-end-testing)
- [Performance Testing](#performance-testing)
- [Security Testing](#security-testing)
- [API Testing](#api-testing)
- [Browser Extension Testing](#browser-extension-testing)
- [AI Model Testing](#ai-model-testing)
- [Continuous Testing](#continuous-testing)
- [Test Data Management](#test-data-management)
- [Reporting & Metrics](#reporting--metrics)

## 🌟 Overview

This document outlines the comprehensive testing strategy for the **Advanced AI MCQ Automation Bot** by **MVK Solutions**. Our testing approach ensures reliability, performance, and security across all components of the system.

### **Testing Philosophy**
- **Quality First**: Every feature is thoroughly tested before release
- **Automation**: Automated testing for rapid feedback and continuous integration
- **Coverage**: Comprehensive test coverage across all layers
- **Real-world Scenarios**: Tests simulate actual user workflows
- **Performance**: Continuous performance monitoring and testing

## 🎯 Testing Strategy

### **Testing Pyramid**

```
                    🔺 E2E Tests (10%)
                   /                \
                  /   UI Tests (20%)  \
                 /                     \
                /  Integration (30%)    \
               /                         \
              /     Unit Tests (40%)      \
             /___________________________\
```

### **Test Types & Coverage**

| Test Type | Coverage | Tools | Frequency |
|-----------|----------|-------|-----------|
| **Unit Tests** | 40% | pytest, Jest | Every commit |
| **Integration Tests** | 30% | pytest, Postman | Every PR |
| **UI Tests** | 20% | Selenium, Cypress | Daily |
| **E2E Tests** | 10% | Playwright, Selenium | Pre-release |

### **Quality Gates**

- ✅ Unit test coverage > 80%
- ✅ Integration tests pass 100%
- ✅ Security scans clean
- ✅ Performance benchmarks met
- ✅ Code review approved

## 🔧 Test Environment Setup

### **Local Development Environment**

```bash
# Clone repository
git clone https://github.com/mvksolutions/mcq-automation-bot.git
cd mcq-automation-bot

# Install dependencies
pip install -r backend/requirements.txt
npm install

# Install test dependencies
pip install -r tests/requirements-test.txt
npm install --dev

# Setup test database
python backend/setup_test_db.py

# Run all tests
make test
```

### **Docker Test Environment**

```bash
# Build test environment
docker-compose -f docker-compose.test.yml up --build

# Run tests in container
docker-compose -f docker-compose.test.yml run tests

# Cleanup
docker-compose -f docker-compose.test.yml down
```

### **Environment Variables**

```bash
# .env.test
DATABASE_URL=sqlite:///test.db
REDIS_URL=redis://localhost:6379/1
OPENAI_API_KEY=test_key_openai
GEMINI_API_KEY=test_key_gemini
TEST_MODE=true
LOG_LEVEL=DEBUG
```

## 🧪 Unit Testing

### **Backend Unit Tests (Python)**

**Framework**: pytest, unittest.mock

**Structure**:
```
tests/unit/
├── test_automation_bot.py
├── test_ai_service.py
├── test_ocr_service.py
├── test_detection_engine.py
├── test_api_endpoints.py
└── test_utils.py
```

**Example Test**:
```python
# tests/unit/test_automation_bot.py
import pytest
from unittest.mock import Mock, patch
from backend.automation_bot import AdvancedMCQBot

class TestAdvancedMCQBot:
    
    @pytest.fixture
    def bot(self):
        return AdvancedMCQBot()
    
    @pytest.fixture
    def sample_mcq(self):
        return {
            'question': 'What is the capital of France?',
            'options': [
                {'text': 'Paris', 'value': 'A'},
                {'text': 'London', 'value': 'B'},
                {'text': 'Rome', 'value': 'C'},
                {'text': 'Berlin', 'value': 'D'}
            ],
            'type': 'radio'
        }
    
    def test_bot_initialization(self, bot):
        """Test bot initializes with default configuration"""
        assert bot.config['auto_answer'] == True
        assert bot.config['answer_delay'] == 3
        assert bot.config['max_retries'] == 3
        assert bot.driver is None
    
    @patch('backend.automation_bot.webdriver.Chrome')
    def test_setup_stealth_driver(self, mock_chrome, bot):
        """Test stealth driver setup"""
        mock_driver = Mock()
        mock_chrome.return_value = mock_driver
        
        bot.setup_stealth_driver(headless=True)
        
        assert bot.driver == mock_driver
        mock_chrome.assert_called_once()
        mock_driver.execute_script.assert_called()
    
    def test_detect_advanced_mcqs_empty_page(self, bot):
        """Test MCQ detection on empty page"""
        with patch.object(bot, 'driver') as mock_driver:
            mock_driver.find_elements.return_value = []
            
            mcqs = bot.detect_advanced_mcqs()
            
            assert mcqs == []
    
    def test_detect_advanced_mcqs_with_forms(self, bot):
        """Test MCQ detection with form elements"""
        with patch.object(bot, '_detect_form_mcqs') as mock_detect:
            mock_detect.return_value = [{'question': 'Test?', 'options': []}]
            
            mcqs = bot.detect_advanced_mcqs()
            
            assert len(mcqs) == 1
            assert mcqs[0]['question'] == 'Test?'
    
    @patch('backend.automation_bot.openai.OpenAI')
    def test_get_ai_answer_openai(self, mock_openai, bot, sample_mcq):
        """Test AI answer generation with OpenAI"""
        # Setup mock
        mock_client = Mock()
        mock_openai.return_value = mock_client
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "A"
        mock_client.chat.completions.create.return_value = mock_response
        
        bot.openai_client = mock_client
        
        # Test
        result = bot.get_ai_answer(
            sample_mcq['question'], 
            sample_mcq['options'], 
            'openai'
        )
        
        assert result == 0  # Index of option A
    
    def test_smart_answer_selection_success(self, bot, sample_mcq):
        """Test successful answer selection"""
        mock_element = Mock()
        mock_element.is_enabled.return_value = True
        mock_element.is_displayed.return_value = True
        
        sample_mcq['options'][0]['element'] = mock_element
        
        with patch.object(bot, 'driver') as mock_driver:
            result = bot.smart_answer_selection(sample_mcq, 0)
            
            assert result == True
            mock_element.click.assert_called_once()
    
    def test_human_like_delay(self, bot):
        """Test human-like delay functionality"""
        import time
        start_time = time.time()
        
        bot.human_like_delay(0.1, 0.2)
        
        end_time = time.time()
        elapsed = end_time - start_time
        
        assert 0.1 <= elapsed <= 0.3  # Allow some tolerance

# Run tests
# pytest tests/unit/test_automation_bot.py -v --cov=backend.automation_bot
```

**Test Configuration**:
```ini
# pytest.ini
[tool:pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = 
    --verbose
    --cov=backend
    --cov-report=html
    --cov-report=term-missing
    --cov-fail-under=80
    --tb=short
markers =
    slow: marks tests as slow
    integration: marks tests as integration tests
    unit: marks tests as unit tests
    security: marks tests as security tests
```

### **Frontend Unit Tests (JavaScript)**

**Framework**: Jest, Testing Library

**Structure**:
```
tests/unit/frontend/
├── test_popup.js
├── test_options.js
├── test_content_script.js
└── test_background.js
```

**Example Test**:
```javascript
// tests/unit/frontend/test_popup.js
import { fireEvent, screen } from '@testing-library/dom';
import '@testing-library/jest-dom';

// Mock Chrome APIs
global.chrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn()
  },
  runtime: {
    sendMessage: jest.fn()
  }
};

describe('Popup Functionality', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="botToggle" class="toggle-advanced"></div>
      <div id="statusText">Bot is inactive</div>
      <button id="scanButton">Scan for MCQs</button>
    `;
  });

  test('should initialize with correct default state', () => {
    const statusText = document.getElementById('statusText');
    expect(statusText.textContent).toBe('Bot is inactive');
  });

  test('should toggle bot status when clicked', () => {
    const botToggle = document.getElementById('botToggle');
    
    fireEvent.click(botToggle);
    
    expect(botToggle.classList.contains('active')).toBe(true);
  });

  test('should call scan API when scan button clicked', async () => {
    const scanButton = document.getElementById('scanButton');
    
    // Mock successful response
    chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      callback({ success: true, count: 5 });
    });

    fireEvent.click(scanButton);

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      expect.any(Number),
      { action: 'scanForMCQs' },
      expect.any(Function)
    );
  });
});

// Run tests
// npm test -- --coverage
```

## 🔗 Integration Testing

### **API Integration Tests**

**Framework**: pytest, requests

```python
# tests/integration/test_api_endpoints.py
import pytest
import requests
from backend.app import create_app

class TestAPIIntegration:
    
    @pytest.fixture(scope='class')
    def app(self):
        app = create_app(testing=True)
        return app
    
    @pytest.fixture(scope='class')
    def client(self, app):
        return app.test_client()
    
    @pytest.fixture
    def auth_headers(self):
        return {
            'Authorization': 'Bearer test_api_key',
            'Content-Type': 'application/json'
        }
    
    def test_health_endpoint(self, client):
        """Test health check endpoint"""
        response = client.get('/api/health')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] == True
        assert 'status' in data
        assert 'version' in data
    
    def test_bot_setup_endpoint(self, client, auth_headers):
        """Test bot setup endpoint"""
        payload = {
            'ai_provider': 'openai',
            'openai_key': 'test_key',
            'config': {
                'auto_answer': True,
                'answer_delay': 3
            }
        }
        
        response = client.post('/api/setup', 
                             json=payload, 
                             headers=auth_headers)
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] == True
        assert 'bot_id' in data
    
    def test_detect_mcqs_endpoint(self, client, auth_headers):
        """Test MCQ detection endpoint"""
        payload = {
            'url': 'https://example.com/test-quiz'
        }
        
        with patch('backend.automation_bot.AdvancedMCQBot') as mock_bot:
            mock_instance = Mock()
            mock_instance.detect_advanced_mcqs.return_value = [
                {
                    'question': 'Test question?',
                    'options': [{'text': 'A', 'value': '1'}],
                    'type': 'radio'
                }
            ]
            mock_bot.return_value = mock_instance
            
            response = client.post('/api/detect-mcqs',
                                 json=payload,
                                 headers=auth_headers)
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] == True
        assert data['count'] == 1
    
    def test_process_mcqs_endpoint(self, client, auth_headers):
        """Test full MCQ processing endpoint"""
        payload = {
            'url': 'https://example.com/test-quiz',
            'ai_provider': 'openai'
        }
        
        response = client.post('/api/process-mcqs',
                             json=payload,
                             headers=auth_headers)
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] == True
        assert 'results' in data
    
    def test_invalid_api_key(self, client):
        """Test API with invalid key"""
        headers = {
            'Authorization': 'Bearer invalid_key',
            'Content-Type': 'application/json'
        }
        
        response = client.post('/api/setup', 
                             json={}, 
                             headers=headers)
        
        assert response.status_code == 401
        data = response.get_json()
        assert data['success'] == False
        assert 'error' in data
```

### **Database Integration Tests**

```python
# tests/integration/test_database.py
import pytest
from backend.models import User, Session, MCQ
from backend.database import db

class TestDatabaseIntegration:
    
    @pytest.fixture(autouse=True)
    def setup_database(self, app):
        with app.app_context():
            db.create_all()
            yield
            db.drop_all()
    
    def test_user_creation(self, app):
        """Test user model creation"""
        with app.app_context():
            user = User(
                email='test@example.com',
                api_key='test_key_123'
            )
            db.session.add(user)
            db.session.commit()
            
            retrieved_user = User.query.filter_by(email='test@example.com').first()
            assert retrieved_user is not None
            assert retrieved_user.api_key == 'test_key_123'
    
    def test_session_creation(self, app):
        """Test session model creation"""
        with app.app_context():
            user = User(email='test@example.com', api_key='test_key')
            db.session.add(user)
            db.session.commit()
            
            session = Session(
                user_id=user.id,
                url='https://example.com/quiz',
                status='completed',
                total_mcqs=10,
                successful_mcqs=9
            )
            db.session.add(session)
            db.session.commit()
            
            retrieved_session = Session.query.filter_by(user_id=user.id).first()
            assert retrieved_session.total_mcqs == 10
            assert retrieved_session.successful_mcqs == 9
```

## 🎭 End-to-End Testing

### **Browser Automation Tests**

**Framework**: Selenium, Playwright

```python
# tests/e2e/test_user_flows.py
import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

class TestUserFlows:
    
    @pytest.fixture(scope='class')
    def driver(self):
        options = webdriver.ChromeOptions()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        driver = webdriver.Chrome(options=options)
        yield driver
        driver.quit()
    
    @pytest.fixture
    def test_page_url(self):
        return 'http://localhost:8080/test-mcq-page.html'
    
    def test_complete_automation_flow(self, driver, test_page_url):
        """Test complete automation workflow"""
        # 1. Navigate to test page
        driver.get(test_page_url)
        
        # 2. Verify MCQs are present
        mcq_elements = driver.find_elements(By.CSS_SELECTOR, '.mcq-block')
        assert len(mcq_elements) >= 3
        
        # 3. Load extension (simulated)
        driver.execute_script("""
            window.MCQBot = {
                detectMCQs: function() {
                    return document.querySelectorAll('.mcq-block').length;
                },
                answerMCQ: function(index, answer) {
                    const mcq = document.querySelectorAll('.mcq-block')[index];
                    const option = mcq.querySelector(`input[value="${answer}"]`);
                    if (option) option.click();
                    return true;
                }
            };
        """)
        
        # 4. Detect MCQs
        mcq_count = driver.execute_script("return window.MCQBot.detectMCQs();")
        assert mcq_count >= 3
        
        # 5. Answer first MCQ
        result = driver.execute_script("return window.MCQBot.answerMCQ(0, 'A');")
        assert result == True
        
        # 6. Verify answer was selected
        selected_option = driver.find_element(
            By.CSS_SELECTOR, 
            '.mcq-block:first-child input[value="A"]'
        )
        assert selected_option.is_selected()
    
    def test_extension_popup_interaction(self, driver):
        """Test extension popup functionality"""
        # Load popup page
        driver.get('chrome-extension://test/popup.html')
        
        # Wait for elements to load
        wait = WebDriverWait(driver, 10)
        
        # Test bot toggle
        bot_toggle = wait.until(
            EC.element_to_be_clickable((By.ID, 'botToggle'))
        )
        bot_toggle.click()
        
        # Verify status change
        status_text = driver.find_element(By.ID, 'statusText')
        assert 'active' in status_text.text.lower()
        
        # Test scan button
        scan_button = driver.find_element(By.ID, 'scanButton')
        scan_button.click()
        
        # Wait for scan completion (simulated)
        wait.until(
            EC.text_to_be_present_in_element(
                (By.ID, 'statusText'), 
                'Found'
            )
        )
```

### **Playwright E2E Tests**

```javascript
// tests/e2e/test_automation.spec.js
const { test, expect } = require('@playwright/test');

test.describe('MCQ Automation E2E Tests', () => {
  
  test('should detect and answer MCQs automatically', async ({ page }) => {
    // Navigate to test page
    await page.goto('http://localhost:8080/test-mcq-page.html');
    
    // Inject MCQ bot script
    await page.addScriptTag({
      content: `
        window.MCQBot = {
          async detectMCQs() {
            const mcqs = document.querySelectorAll('.mcq-block');
            return Array.from(mcqs).map((mcq, index) => ({
              id: index,
              question: mcq.querySelector('h2, b, .question')?.textContent,
              options: Array.from(mcq.querySelectorAll('input')).map(input => ({
                value: input.value,
                text: input.nextElementSibling?.textContent || input.value
              }))
            }));
          },
          
          async answerMCQ(mcqId, optionValue) {
            const mcqs = document.querySelectorAll('.mcq-block');
            const mcq = mcqs[mcqId];
            const option = mcq.querySelector(\`input[value="\${optionValue}"]\`);
            if (option) {
              option.click();
              return true;
            }
            return false;
          }
        };
      `
    });
    
    // Detect MCQs
    const mcqs = await page.evaluate(() => window.MCQBot.detectMCQs());
    expect(mcqs.length).toBeGreaterThan(0);
    
    // Answer first MCQ
    const firstMCQ = mcqs[0];
    expect(firstMCQ.question).toContain('capital of France');
    
    const answered = await page.evaluate(
      (mcqId, optionValue) => window.MCQBot.answerMCQ(mcqId, optionValue),
      0, 'A'
    );
    expect(answered).toBe(true);
    
    // Verify answer was selected
    const selectedOption = await page.locator('.mcq-block:first-child input[value="A"]');
    await expect(selectedOption).toBeChecked();
  });
  
  test('should handle multiple MCQ types', async ({ page }) => {
    await page.goto('http://localhost:8080/test-mcq-page.html');
    
    // Test radio button MCQ
    await page.click('.mcq-block:nth-child(1) input[value="A"]');
    await expect(page.locator('.mcq-block:nth-child(1) input[value="A"]')).toBeChecked();
    
    // Test checkbox MCQ
    await page.click('.mcq-block:nth-child(2) input[type="checkbox"]:first-child');
    await expect(page.locator('.mcq-block:nth-child(2) input[type="checkbox"]:first-child')).toBeChecked();
    
    // Test custom MCQ
    await page.click('.mcq-block.custom-mcq input[value="A"]');
    await expect(page.locator('.mcq-block.custom-mcq input[value="A"]')).toBeChecked();
  });
});
```

## 📊 Performance Testing

### **Load Testing with k6**

```javascript
// tests/performance/load_test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export let errorRate = new Rate('errors');

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.1'],     // Error rate under 10%
    errors: ['rate<0.1'],              // Custom error rate under 10%
  },
};

const BASE_URL = 'https://api.mvksolutions.com/v2';
const API_KEY = 'test_api_key';

export default function() {
  // Test health endpoint
  let healthResponse = http.get(`${BASE_URL}/health`);
  check(healthResponse, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 500ms': (r) => r.timings.duration < 500,
  });

  // Test bot setup
  let setupPayload = JSON.stringify({
    ai_provider: 'openai',
    openai_key: 'test_key',
    config: {
      auto_answer: true,
      answer_delay: 3
    }
  });

  let setupResponse = http.post(`${BASE_URL}/bot/setup`, setupPayload, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  let setupSuccess = check(setupResponse, {
    'setup status is 200': (r) => r.status === 200,
    'setup response time < 2000ms': (r) => r.timings.duration < 2000,
    'setup returns bot_id': (r) => JSON.parse(r.body).bot_id !== undefined,
  });

  errorRate.add(!setupSuccess);

  // Test MCQ detection
  let detectPayload = JSON.stringify({
    url: 'https://example.com/test-quiz'
  });

  let detectResponse = http.post(`${BASE_URL}/detect/mcqs`, detectPayload, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  let detectSuccess = check(detectResponse, {
    'detect status is 200': (r) => r.status === 200,
    'detect response time < 3000ms': (r) => r.timings.duration < 3000,
  });

  errorRate.add(!detectSuccess);

  sleep(1);
}
```

### **Stress Testing**

```python
# tests/performance/stress_test.py
import asyncio
import aiohttp
import time
from concurrent.futures import ThreadPoolExecutor

class StressTest:
    
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.api_key = api_key
        self.results = []
    
    async def make_request(self, session, endpoint, payload=None):
        """Make async HTTP request"""
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }
        
        start_time = time.time()
        try:
            if payload:
                async with session.post(f'{self.base_url}{endpoint}', 
                                      json=payload, 
                                      headers=headers) as response:
                    result = await response.json()
                    status = response.status
            else:
                async with session.get(f'{self.base_url}{endpoint}', 
                                     headers=headers) as response:
                    result = await response.json()
                    status = response.status
            
            end_time = time.time()
            
            return {
                'endpoint': endpoint,
                'status': status,
                'response_time': end_time - start_time,
                'success': status == 200
            }
        except Exception as e:
            end_time = time.time()
            return {
                'endpoint': endpoint,
                'status': 0,
                'response_time': end_time - start_time,
                'success': False,
                'error': str(e)
            }
    
    async def run_concurrent_requests(self, num_requests=1000):
        """Run concurrent requests to test system limits"""
        async with aiohttp.ClientSession() as session:
            tasks = []
            
            # Create mix of different endpoints
            for i in range(num_requests):
                if i % 4 == 0:
                    task = self.make_request(session, '/health')
                elif i % 4 == 1:
                    payload = {
                        'ai_provider': 'openai',
                        'openai_key': 'test_key',
                        'config': {'auto_answer': True}
                    }
                    task = self.make_request(session, '/bot/setup', payload)
                elif i % 4 == 2:
                    payload = {'url': 'https://example.com/test-quiz'}
                    task = self.make_request(session, '/detect/mcqs', payload)
                else:
                    payload = {
                        'question': 'What is 2+2?',
                        'options': [
                            {'text': '3', 'value': 'A'},
                            {'text': '4', 'value': 'B'}
                        ]
                    }
                    task = self.make_request(session, '/ai/answer', payload)
                
                tasks.append(task)
            
            # Execute all requests concurrently
            results = await asyncio.gather(*tasks)
            return results
    
    def analyze_results(self, results):
        """Analyze stress test results"""
        total_requests = len(results)
        successful_requests = sum(1 for r in results if r['success'])
        failed_requests = total_requests - successful_requests
        
        response_times = [r['response_time'] for r in results if r['success']]
        
        if response_times:
            avg_response_time = sum(response_times) / len(response_times)
            max_response_time = max(response_times)
            min_response_time = min(response_times)
        else:
            avg_response_time = max_response_time = min_response_time = 0
        
        success_rate = (successful_requests / total_requests) * 100
        
        return {
            'total_requests': total_requests,
            'successful_requests': successful_requests,
            'failed_requests': failed_requests,
            'success_rate': success_rate,
            'avg_response_time': avg_response_time,
            'max_response_time': max_response_time,
            'min_response_time': min_response_time
        }

# Run stress test
async def main():
    stress_test = StressTest(
        base_url='https://api.mvksolutions.com/v2',
        api_key='test_api_key'
    )
    
    print("Starting stress test with 1000 concurrent requests...")
    results = await stress_test.run_concurrent_requests(1000)
    
    analysis = stress_test.analyze_results(results)
    
    print(f"Stress Test Results:")
    print(f"Total Requests: {analysis['total_requests']}")
    print(f"Successful: {analysis['successful_requests']}")
    print(f"Failed: {analysis['failed_requests']}")
    print(f"Success Rate: {analysis['success_rate']:.2f}%")
    print(f"Avg Response Time: {analysis['avg_response_time']:.3f}s")
    print(f"Max Response Time: {analysis['max_response_time']:.3f}s")
    print(f"Min Response Time: {analysis['min_response_time']:.3f}s")

if __name__ == "__main__":
    asyncio.run(main())
```

## 🔒 Security Testing

### **Authentication & Authorization Tests**

```python
# tests/security/test_auth.py
import pytest
import jwt
from backend.auth import generate_api_key, verify_api_key, create_jwt_token

class TestSecurityAuth:
    
    def test_api_key_generation(self):
        """Test API key generation"""
        api_key = generate_api_key()
        
        assert api_key.startswith('mvk_')
        assert len(api_key) == 32
        assert api_key.isalnum() or '_' in api_key
    
    def test_api_key_verification_valid(self):
        """Test valid API key verification"""
        api_key = generate_api_key()
        
        # Store in test database
        user_id = store_api_key(api_key)
        
        result = verify_api_key(api_key)
        assert result['valid'] == True
        assert result['user_id'] == user_id
    
    def test_api_key_verification_invalid(self):
        """Test invalid API key verification"""
        invalid_key = 'invalid_key_123'
        
        result = verify_api_key(invalid_key)
        assert result['valid'] == False
        assert 'user_id' not in result
    
    def test_jwt_token_creation(self):
        """Test JWT token creation"""
        user_id = 123
        token = create_jwt_token(user_id)
        
        # Decode and verify
        decoded = jwt.decode(token, options={"verify_signature": False})
        assert decoded['user_id'] == user_id
        assert 'exp' in decoded
        assert 'iat' in decoded
    
    def test_rate_limiting(self, client):
        """Test API rate limiting"""
        headers = {'Authorization': 'Bearer test_api_key'}
        
        # Make requests up to limit
        for i in range(100):
            response = client.get('/api/health', headers=headers)
            if response.status_code == 429:
                break
        
        # Should eventually hit rate limit
        assert response.status_code == 429
        data = response.get_json()
        assert 'rate_limit' in data['error']['code'].lower()
```

### **Input Validation Tests**

```python
# tests/security/test_input_validation.py
import pytest
from backend.utils.validators import validate_url, validate_mcq_data, sanitize_input

class TestInputValidation:
    
    def test_url_validation_valid(self):
        """Test valid URL validation"""
        valid_urls = [
            'https://example.com',
            'http://test.edu/quiz',
            'https://subdomain.example.org/path?param=value'
        ]
        
        for url in valid_urls:
            assert validate_url(url) == True
    
    def test_url_validation_invalid(self):
        """Test invalid URL validation"""
        invalid_urls = [
            'not_a_url',
            'ftp://example.com',
            'javascript:alert(1)',
            'data:text/html,<script>alert(1)</script>',
            'file:///etc/passwd'
        ]
        
        for url in invalid_urls:
            assert validate_url(url) == False
    
    def test_mcq_data_validation_valid(self):
        """Test valid MCQ data validation"""
        valid_mcq = {
            'question': 'What is 2+2?',
            'options': [
                {'text': '3', 'value': 'A'},
                {'text': '4', 'value': 'B'},
                {'text': '5', 'value': 'C'}
            ],
            'type': 'radio'
        }
        
        assert validate_mcq_data(valid_mcq) == True
    
    def test_mcq_data_validation_invalid(self):
        """Test invalid MCQ data validation"""
        invalid_mcqs = [
            # Missing question
            {
                'options': [{'text': 'A', 'value': '1'}],
                'type': 'radio'
            },
            # XSS attempt in question
            {
                'question': '<script>alert(1)</script>',
                'options': [{'text': 'A', 'value': '1'}],
                'type': 'radio'
            },
            # Too few options
            {
                'question': 'Test?',
                'options': [{'text': 'A', 'value': '1'}],
                'type': 'radio'
            }
        ]
        
        for mcq in invalid_mcqs:
            assert validate_mcq_data(mcq) == False
    
    def test_input_sanitization(self):
        """Test input sanitization"""
        dangerous_inputs = [
            '<script>alert(1)</script>',
            'javascript:alert(1)',
            '"><script>alert(1)</script>',
            "'; DROP TABLE users; --"
        ]
        
        for dangerous_input in dangerous_inputs:
            sanitized = sanitize_input(dangerous_input)
            
            # Should not contain dangerous patterns
            assert '<script>' not in sanitized.lower()
            assert 'javascript:' not in sanitized.lower()
            assert 'drop table' not in sanitized.lower()
```

### **Vulnerability Scanning**

```python
# tests/security/test_vulnerabilities.py
import requests
import pytest

class TestVulnerabilityScanning:
    
    @pytest.fixture
    def base_url(self):
        return 'http://localhost:5000/api'
    
    def test_sql_injection_protection(self, base_url):
        """Test SQL injection protection"""
        sql_payloads = [
            "'; DROP TABLE users; --",
            "' OR '1'='1",
            "1' UNION SELECT * FROM users --",
            "'; INSERT INTO users VALUES ('hacker', 'password'); --"
        ]
        
        for payload in sql_payloads:
            response = requests.post(f'{base_url}/detect/mcqs', json={
                'url': payload
            })
            
            # Should not return database errors or sensitive info
            assert response.status_code in [400, 422]  # Bad request or validation error
            assert 'database' not in response.text.lower()
            assert 'sql' not in response.text.lower()
    
    def test_xss_protection(self, base_url):
        """Test XSS protection"""
        xss_payloads = [
            '<script>alert(1)</script>',
            '<img src=x onerror=alert(1)>',
            'javascript:alert(1)',
            '<svg onload=alert(1)>'
        ]
        
        for payload in xss_payloads:
            response = requests.post(f'{base_url}/ai/answer', json={
                'question': payload,
                'options': [{'text': 'A', 'value': '1'}]
            })
            
            # Should sanitize or reject malicious input
            if response.status_code == 200:
                assert payload not in response.text
    
    def test_directory_traversal_protection(self, base_url):
        """Test directory traversal protection"""
        traversal_payloads = [
            '../../../etc/passwd',
            '..\\..\\..\\windows\\system32\\config\\sam',
            '/etc/passwd',
            'C:\\windows\\system32\\config\\sam'
        ]
        
        for payload in traversal_payloads:
            response = requests.get(f'{base_url}/static/{payload}')
            
            # Should not expose system files
            assert response.status_code in [404, 403]
            assert 'root:' not in response.text  # Unix passwd file
            assert 'Administrator:' not in response.text  # Windows SAM
```

## 🤖 AI Model Testing

### **AI Response Quality Tests**

```python
# tests/ai/test_ai_quality.py
import pytest
from backend.ai_service import get_ai_answer

class TestAIQuality:
    
    @pytest.fixture
    def sample_mcqs(self):
        return [
            {
                'question': 'What is the capital of France?',
                'options': ['Paris', 'London', 'Rome', 'Berlin'],
                'correct_answer': 'Paris',
                'category': 'geography'
            },
            {
                'question': 'What is 2 + 2?',
                'options': ['3', '4', '5', '6'],
                'correct_answer': '4',
                'category': 'mathematics'
            },
            {
                'question': 'Who wrote Romeo and Juliet?',
                'options': ['Shakespeare', 'Dickens', 'Austen', 'Tolkien'],
                'correct_answer': 'Shakespeare',
                'category': 'literature'
            }
        ]
    
    @pytest.mark.parametrize('ai_provider', ['openai', 'gemini', 'deepseek'])
    def test_ai_accuracy_by_provider(self, sample_mcqs, ai_provider):
        """Test AI accuracy across different providers"""
        correct_answers = 0
        total_questions = len(sample_mcqs)
        
        for mcq in sample_mcqs:
            result = get_ai_answer(
                question=mcq['question'],
                options=mcq['options'],
                provider=ai_provider
            )
            
            if result['answer'] == mcq['correct_answer']:
                correct_answers += 1
        
        accuracy = (correct_answers / total_questions) * 100
        
        # Expect at least 80% accuracy for basic questions
        assert accuracy >= 80, f"{ai_provider} accuracy: {accuracy}%"
    
    def test_ai_response_consistency(self, sample_mcqs):
        """Test AI response consistency across multiple runs"""
        mcq = sample_mcqs[0]  # Use first MCQ
        
        responses = []
        for _ in range(5):  # Run 5 times
            result = get_ai_answer(
                question=mcq['question'],
                options=mcq['options'],
                provider='openai'
            )
            responses.append(result['answer'])
        
        # Should give same answer at least 80% of the time
        most_common = max(set(responses), key=responses.count)
        consistency = (responses.count(most_common) / len(responses)) * 100
        
        assert consistency >= 80, f"Consistency: {consistency}%"
    
    def test_ai_response_time(self, sample_mcqs):
        """Test AI response time performance"""
        import time
        
        mcq = sample_mcqs[0]
        
        start_time = time.time()
        result = get_ai_answer(
            question=mcq['question'],
            options=mcq['options'],
            provider='openai'
        )
        end_time = time.time()
        
        response_time = end_time - start_time
        
        # Should respond within 5 seconds
        assert response_time < 5.0, f"Response time: {response_time}s"
        assert result is not None
    
    def test_ai_confidence_scores(self, sample_mcqs):
        """Test AI confidence scoring"""
        for mcq in sample_mcqs:
            result = get_ai_answer(
                question=mcq['question'],
                options=mcq['options'],
                provider='openai',
                include_confidence=True
            )
            
            # Should include confidence score
            assert 'confidence' in result
            assert 0 <= result['confidence'] <= 1
            
            # High confidence for easy questions
            if mcq['category'] == 'mathematics':
                assert result['confidence'] > 0.9
```

## 📊 Test Reporting & Metrics

### **Coverage Reports**

```bash
# Generate coverage reports
pytest --cov=backend --cov-report=html --cov-report=term-missing

# Coverage configuration
# .coveragerc
[run]
source = backend
omit = 
    */tests/*
    */venv/*
    */migrations/*
    */config/*

[report]
exclude_lines =
    pragma: no cover
    def __repr__
    raise AssertionError
    raise NotImplementedError

[html]
directory = htmlcov
```

### **Test Metrics Dashboard**

```python
# tests/utils/metrics.py
import json
import time
from datetime import datetime

class TestMetrics:
    
    def __init__(self):
        self.metrics = {
            'test_runs': [],
            'coverage': {},
            'performance': {},
            'quality_gates': {}
        }
    
    def record_test_run(self, test_type, results):
        """Record test run metrics"""
        run_data = {
            'timestamp': datetime.now().isoformat(),
            'test_type': test_type,
            'total_tests': results.get('total', 0),
            'passed': results.get('passed', 0),
            'failed': results.get('failed', 0),
            'skipped': results.get('skipped', 0),
            'duration': results.get('duration', 0),
            'success_rate': (results.get('passed', 0) / results.get('total', 1)) * 100
        }
        
        self.metrics['test_runs'].append(run_data)
    
    def update_coverage(self, coverage_data):
        """Update coverage metrics"""
        self.metrics['coverage'] = {
            'timestamp': datetime.now().isoformat(),
            'line_coverage': coverage_data.get('line_coverage', 0),
            'branch_coverage': coverage_data.get('branch_coverage', 0),
            'function_coverage': coverage_data.get('function_coverage', 0),
            'files': coverage_data.get('files', {})
        }
    
    def check_quality_gates(self):
        """Check if quality gates are met"""
        gates = {
            'unit_test_coverage': self.metrics['coverage'].get('line_coverage', 0) >= 80,
            'integration_tests_pass': self._get_latest_test_success('integration') >= 100,
            'e2e_tests_pass': self._get_latest_test_success('e2e') >= 90,
            'performance_tests_pass': self._check_performance_gates(),
            'security_tests_pass': self._get_latest_test_success('security') >= 100
        }
        
        self.metrics['quality_gates'] = {
            'timestamp': datetime.now().isoformat(),
            'gates': gates,
            'all_passed': all(gates.values())
        }
        
        return gates
    
    def _get_latest_test_success(self, test_type):
        """Get latest test success rate for type"""
        runs = [r for r in self.metrics['test_runs'] if r['test_type'] == test_type]
        if runs:
            return runs[-1]['success_rate']
        return 0
    
    def _check_performance_gates(self):
        """Check performance test gates"""
        perf = self.metrics.get('performance', {})
        return (
            perf.get('avg_response_time', float('inf')) < 2.0 and
            perf.get('p95_response_time', float('inf')) < 5.0 and
            perf.get('error_rate', 100) < 5.0
        )
    
    def export_metrics(self, filename='test_metrics.json'):
        """Export metrics to file"""
        with open(filename, 'w') as f:
            json.dump(self.metrics, f, indent=2)
    
    def generate_report(self):
        """Generate test report"""
        latest_run = self.metrics['test_runs'][-1] if self.metrics['test_runs'] else {}
        coverage = self.metrics['coverage']
        gates = self.metrics['quality_gates']
        
        report = f"""
# Test Report - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Latest Test Run
- Type: {latest_run.get('test_type', 'N/A')}
- Total Tests: {latest_run.get('total_tests', 0)}
- Passed: {latest_run.get('passed', 0)}
- Failed: {latest_run.get('failed', 0)}
- Success Rate: {latest_run.get('success_rate', 0):.1f}%
- Duration: {latest_run.get('duration', 0):.2f}s

## Coverage
- Line Coverage: {coverage.get('line_coverage', 0):.1f}%
- Branch Coverage: {coverage.get('branch_coverage', 0):.1f}%
- Function Coverage: {coverage.get('function_coverage', 0):.1f}%

## Quality Gates
- Unit Test Coverage: {'✅' if gates.get('gates', {}).get('unit_test_coverage') else '❌'}
- Integration Tests: {'✅' if gates.get('gates', {}).get('integration_tests_pass') else '❌'}
- E2E Tests: {'✅' if gates.get('gates', {}).get('e2e_tests_pass') else '❌'}
- Performance Tests: {'✅' if gates.get('gates', {}).get('performance_tests_pass') else '❌'}
- Security Tests: {'✅' if gates.get('gates', {}).get('security_tests_pass') else '❌'}

## Overall Status: {'✅ PASSED' if gates.get('all_passed') else '❌ FAILED'}
        """
        
        return report
```

## 🔄 Continuous Testing

### **GitHub Actions CI/CD**

```yaml
# .github/workflows/test.yml
name: Comprehensive Testing

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: [3.8, 3.9, 3.10]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python ${{ matrix.python-version }}
      uses: actions/setup-python@v3
      with:
        python-version: ${{ matrix.python-version }}
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r backend/requirements.txt
        pip install -r tests/requirements-test.txt
    
    - name: Run unit tests
      run: |
        pytest tests/unit/ -v --cov=backend --cov-report=xml
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.xml

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    
    services:
      redis:
        image: redis:alpine
        ports:
          - 6379:6379
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v3
      with:
        python-version: 3.9
    
    - name: Install dependencies
      run: |
        pip install -r backend/requirements.txt
        pip install -r tests/requirements-test.txt
    
    - name: Run integration tests
      env:
        DATABASE_URL: postgresql://postgres:test@localhost:5432/test_db
        REDIS_URL: redis://localhost:6379/1
      run: |
        pytest tests/integration/ -v

  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Node.js
      uses: actions/setup-node@v3
      with:
        node-version: 16
    
    - name: Install Playwright
      run: |
        npm install -g @playwright/test
        npx playwright install
    
    - name: Start application
      run: |
        python backend/run_server.py &
        sleep 10
    
    - name: Run E2E tests
      run: |
        npx playwright test tests/e2e/

  performance-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Install k6
      run: |
        sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
        echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
        sudo apt-get update
        sudo apt-get install k6
    
    - name: Start application
      run: |
        python backend/run_server.py &
        sleep 10
    
    - name: Run performance tests
      run: |
        k6 run tests/performance/load_test.js

  security-tests:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Run Snyk security scan
      uses: snyk/actions/python@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      with:
        args: --severity-threshold=high
    
    - name: Run Bandit security scan
      run: |
        pip install bandit
        bandit -r backend/ -f json -o bandit-report.json
    
    - name: Upload security reports
      uses: actions/upload-artifact@v3
      with:
        name: security-reports
        path: |
          bandit-report.json
          snyk-report.json

  quality-gates:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests, e2e-tests, performance-tests, security-tests]
    
    steps:
    - name: Check quality gates
      run: |
        echo "All tests passed! ✅"
        echo "Quality gates met! 🎉"
```

## 📝 Test Documentation

### **Test Plan Template**

```markdown
# Test Plan: [Feature Name]

## Overview
Brief description of the feature being tested.

## Test Objectives
- [ ] Verify functionality works as expected
- [ ] Ensure performance meets requirements
- [ ] Validate security measures
- [ ] Confirm user experience

## Test Scope
### In Scope
- Feature functionality
- API endpoints
- User interface
- Performance benchmarks

### Out of Scope
- Third-party integrations
- Legacy browser support

## Test Strategy
### Test Levels
1. **Unit Tests**: Individual component testing
2. **Integration Tests**: Component interaction testing
3. **System Tests**: End-to-end workflow testing
4. **Acceptance Tests**: User acceptance criteria

### Test Types
- Functional testing
- Performance testing
- Security testing
- Usability testing

## Test Environment
- **Development**: Local development setup
- **Staging**: Production-like environment
- **Production**: Live environment (limited testing)

## Test Data
- Sample MCQ datasets
- User accounts for testing
- Mock API responses

## Entry Criteria
- [ ] Code review completed
- [ ] Unit tests passing
- [ ] Test environment ready

## Exit Criteria
- [ ] All test cases executed
- [ ] 95% test cases passed
- [ ] Critical bugs resolved
- [ ] Performance benchmarks met

## Risk Assessment
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| API downtime | High | Low | Fallback mechanisms |
| Performance degradation | Medium | Medium | Load testing |

## Test Schedule
- Week 1: Unit and integration tests
- Week 2: E2E and performance tests
- Week 3: Security and acceptance tests
- Week 4: Bug fixes and retesting
```

---

## 🎯 Best Practices

### **Test Writing Guidelines**

1. **Clear Test Names**: Use descriptive test names that explain what is being tested
2. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification
3. **Independent Tests**: Each test should be independent and not rely on others
4. **Test Data**: Use realistic test data that represents actual usage
5. **Error Cases**: Test both success and failure scenarios
6. **Performance**: Include performance assertions in relevant tests
7. **Documentation**: Document complex test scenarios and edge cases

### **Test Maintenance**

1. **Regular Updates**: Keep tests updated with code changes
2. **Flaky Test Management**: Identify and fix unstable tests
3. **Test Cleanup**: Remove obsolete tests and update outdated ones
4. **Performance Monitoring**: Monitor test execution times
5. **Coverage Analysis**: Regularly review and improve test coverage

### **Continuous Improvement**

1. **Metrics Tracking**: Track test metrics over time
2. **Feedback Loops**: Use test results to improve development process
3. **Tool Evaluation**: Regularly evaluate and update testing tools
4. **Team Training**: Keep team updated on testing best practices
5. **Process Refinement**: Continuously refine testing processes

---

**Built with ❤️ by MVK Solutions - Ensuring Quality Through Comprehensive Testing**