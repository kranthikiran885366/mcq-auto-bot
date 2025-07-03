# 🔌 API Documentation - Advanced AI MCQ Bot

## 📋 Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Base URLs](#base-urls)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [Endpoints](#endpoints)
- [WebSocket API](#websocket-api)
- [SDK & Libraries](#sdk--libraries)
- [Examples](#examples)

## 🌟 Overview

The **Advanced AI MCQ Bot API** provides comprehensive endpoints for automating multiple-choice question detection, processing, and answering using cutting-edge AI technologies. Built by **MVK Solutions** for enterprise-grade educational automation.

### **API Version**: v2.0
### **Protocol**: REST + WebSocket
### **Format**: JSON
### **Authentication**: JWT + API Key

## 🔐 Authentication

### **API Key Authentication**

All API requests require an API key in the header:

```http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

### **JWT Token Authentication**

For user-specific operations:

```http
Authorization: Bearer JWT_TOKEN
X-API-Key: YOUR_API_KEY
```

### **Get API Key**

```bash
curl -X POST https://api.mvksolutions.com/v2/auth/api-key \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@email.com",
    "password": "your_password"
  }'
```

**Response:**
```json
{
  "success": true,
  "api_key": "mvk_live_1234567890abcdef",
  "expires_at": "2024-12-31T23:59:59Z",
  "rate_limit": 10000
}
```

## 🌐 Base URLs

| Environment | Base URL |
|-------------|----------|
| **Production** | `https://api.mvksolutions.com/v2` |
| **Staging** | `https://staging-api.mvksolutions.com/v2` |
| **Development** | `http://localhost:5000/api/v2` |

## ⚡ Rate Limiting

| Plan | Requests/Hour | Concurrent |
|------|---------------|------------|
| **Free** | 1,000 | 5 |
| **Pro** | 10,000 | 25 |
| **Enterprise** | 100,000 | 100 |

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 9999
X-RateLimit-Reset: 1640995200
```

## ❌ Error Handling

### **Error Response Format**

```json
{
  "success": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "The provided API key is invalid or expired",
    "details": {
      "timestamp": "2024-01-15T10:30:00Z",
      "request_id": "req_1234567890",
      "documentation": "https://docs.mvksolutions.com/errors/INVALID_API_KEY"
    }
  }
}
```

### **HTTP Status Codes**

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request |
| `401` | Unauthorized |
| `403` | Forbidden |
| `404` | Not Found |
| `429` | Rate Limited |
| `500` | Internal Server Error |
| `503` | Service Unavailable |

### **Common Error Codes**

| Code | Description |
|------|-------------|
| `INVALID_API_KEY` | API key is invalid or expired |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INSUFFICIENT_CREDITS` | Not enough API credits |
| `INVALID_INPUT` | Request validation failed |
| `AI_SERVICE_ERROR` | AI provider error |
| `OCR_PROCESSING_ERROR` | OCR service error |
| `DETECTION_FAILED` | MCQ detection failed |

## 🔌 Endpoints

### **🏥 Health Check**

#### `GET /health`

Check API service health and status.

**Request:**
```bash
curl -X GET https://api.mvksolutions.com/v2/health
```

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "version": "2.0.0",
  "uptime": 86400,
  "services": {
    "database": "healthy",
    "ai_providers": "healthy",
    "ocr_service": "healthy",
    "cache": "healthy"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

### **🤖 Bot Management**

#### `POST /bot/setup`

Initialize and configure the automation bot.

**Request:**
```bash
curl -X POST https://api.mvksolutions.com/v2/bot/setup \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "ai_provider": "openai",
    "openai_key": "sk-...",
    "gemini_key": "AIza...",
    "config": {
      "auto_answer": true,
      "answer_delay": 3,
      "max_retries": 3,
      "stealth_mode": true,
      "human_like_behavior": true
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "bot_id": "bot_1234567890",
  "status": "configured",
  "capabilities": [
    "mcq_detection",
    "ai_answering",
    "ocr_processing",
    "stealth_mode"
  ],
  "created_at": "2024-01-15T10:30:00Z"
}
```

#### `GET /bot/{bot_id}/status`

Get bot status and configuration.

**Response:**
```json
{
  "success": true,
  "bot_id": "bot_1234567890",
  "status": "active",
  "config": {
    "ai_provider": "openai",
    "auto_answer": true,
    "answer_delay": 3,
    "stealth_mode": true
  },
  "stats": {
    "mcqs_processed": 1250,
    "success_rate": 97.3,
    "avg_response_time": 1.2
  },
  "last_activity": "2024-01-15T10:25:00Z"
}
```

#### `DELETE /bot/{bot_id}`

Stop and remove bot instance.

**Response:**
```json
{
  "success": true,
  "message": "Bot stopped and removed successfully",
  "final_stats": {
    "total_mcqs": 1250,
    "successful": 1216,
    "failed": 34,
    "accuracy": 97.3
  }
}
```

---

### **🔍 MCQ Detection**

#### `POST /detect/mcqs`

Detect MCQs on a webpage or from image.

**Request:**
```bash
curl -X POST https://api.mvksolutions.com/v2/detect/mcqs \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/quiz",
    "detection_methods": ["dom", "ocr", "pattern"],
    "options": {
      "include_images": true,
      "shadow_dom": true,
      "custom_selectors": [".question", ".mcq-container"]
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "detection_id": "det_1234567890",
  "mcqs_found": 15,
  "mcqs": [
    {
      "id": "mcq_001",
      "question": "What is the capital of France?",
      "options": [
        {"id": "opt_001", "text": "Paris", "value": "A"},
        {"id": "opt_002", "text": "London", "value": "B"},
        {"id": "opt_003", "text": "Rome", "value": "C"},
        {"id": "opt_004", "text": "Berlin", "value": "D"}
      ],
      "type": "radio",
      "confidence": 0.95,
      "detection_method": "dom",
      "position": {"x": 100, "y": 200, "width": 400, "height": 150}
    }
  ],
  "processing_time": 2.3,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `POST /detect/image`

Detect MCQs from image using OCR.

**Request:**
```bash
curl -X POST https://api.mvksolutions.com/v2/detect/image \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "image_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "language": "eng",
    "preprocessing": {
      "enhance_contrast": true,
      "remove_noise": true,
      "deskew": true
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "ocr_text": "1. What is the capital of France?\nA) Paris\nB) London\nC) Rome\nD) Berlin",
  "mcqs": [
    {
      "question": "What is the capital of France?",
      "options": [
        {"text": "Paris", "value": "A"},
        {"text": "London", "value": "B"},
        {"text": "Rome", "value": "C"},
        {"text": "Berlin", "value": "D"}
      ],
      "confidence": 0.92
    }
  ],
  "processing_time": 3.1
}
```

---

### **🧠 AI Processing**

#### `POST /ai/answer`

Get AI-powered answer for MCQ.

**Request:**
```bash
curl -X POST https://api.mvksolutions.com/v2/ai/answer \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the capital of France?",
    "options": [
      {"text": "Paris", "value": "A"},
      {"text": "London", "value": "B"},
      {"text": "Rome", "value": "C"},
      {"text": "Berlin", "value": "D"}
    ],
    "ai_provider": "openai",
    "context": {
      "subject": "geography",
      "difficulty": "easy",
      "language": "english"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "answer": {
    "selected_option": "A",
    "text": "Paris",
    "confidence": 0.98,
    "reasoning": "Paris is the capital and largest city of France, located in the north-central part of the country.",
    "ai_provider": "openai",
    "model": "gpt-4",
    "processing_time": 1.2
  },
  "alternatives": [
    {"option": "B", "confidence": 0.01},
    {"option": "C", "confidence": 0.005},
    {"option": "D", "confidence": 0.005}
  ]
}
```

#### `POST /ai/batch-answer`

Process multiple MCQs in batch.

**Request:**
```bash
curl -X POST https://api.mvksolutions.com/v2/ai/batch-answer \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mcqs": [
      {
        "id": "mcq_001",
        "question": "What is the capital of France?",
        "options": [
          {"text": "Paris", "value": "A"},
          {"text": "London", "value": "B"}
        ]
      },
      {
        "id": "mcq_002",
        "question": "What is 2 + 2?",
        "options": [
          {"text": "3", "value": "A"},
          {"text": "4", "value": "B"}
        ]
      }
    ],
    "ai_provider": "auto",
    "parallel_processing": true
  }'
```

**Response:**
```json
{
  "success": true,
  "batch_id": "batch_1234567890",
  "results": [
    {
      "mcq_id": "mcq_001",
      "answer": {"selected_option": "A", "confidence": 0.98},
      "processing_time": 1.1
    },
    {
      "mcq_id": "mcq_002",
      "answer": {"selected_option": "B", "confidence": 0.99},
      "processing_time": 0.8
    }
  ],
  "total_processing_time": 2.1,
  "success_rate": 100
}
```

---

### **⚡ Automation**

#### `POST /automation/process`

Fully automated MCQ processing pipeline.

**Request:**
```bash
curl -X POST https://api.mvksolutions.com/v2/automation/process \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/quiz",
    "ai_provider": "auto",
    "automation_config": {
      "auto_answer": true,
      "answer_delay": 3,
      "human_like_behavior": true,
      "stealth_mode": true,
      "screenshot_evidence": true
    },
    "notification_webhook": "https://your-app.com/webhook"
  }'
```

**Response:**
```json
{
  "success": true,
  "session_id": "session_1234567890",
  "status": "processing",
  "estimated_completion": "2024-01-15T10:35:00Z",
  "webhook_url": "https://your-app.com/webhook",
  "progress_url": "https://api.mvksolutions.com/v2/automation/session_1234567890/progress"
}
```

#### `GET /automation/{session_id}/progress`

Get automation session progress.

**Response:**
```json
{
  "success": true,
  "session_id": "session_1234567890",
  "status": "in_progress",
  "progress": {
    "total_mcqs": 15,
    "processed": 8,
    "successful": 7,
    "failed": 1,
    "percentage": 53.3
  },
  "current_mcq": {
    "id": "mcq_009",
    "question": "What is the largest planet?",
    "status": "processing"
  },
  "estimated_completion": "2024-01-15T10:33:00Z"
}
```

#### `GET /automation/{session_id}/results`

Get final automation results.

**Response:**
```json
{
  "success": true,
  "session_id": "session_1234567890",
  "status": "completed",
  "summary": {
    "total_mcqs": 15,
    "successful": 14,
    "failed": 1,
    "accuracy": 93.3,
    "total_time": 45.2
  },
  "detailed_results": [
    {
      "mcq_id": "mcq_001",
      "question": "What is the capital of France?",
      "selected_answer": "A",
      "answer_text": "Paris",
      "confidence": 0.98,
      "status": "success",
      "processing_time": 2.1
    }
  ],
  "screenshots": [
    "https://storage.mvksolutions.com/screenshots/session_1234567890_001.png"
  ],
  "completed_at": "2024-01-15T10:35:22Z"
}
```

---

### **📊 Analytics**

#### `GET /analytics/dashboard`

Get comprehensive analytics dashboard data.

**Response:**
```json
{
  "success": true,
  "period": "last_30_days",
  "metrics": {
    "total_sessions": 1250,
    "total_mcqs": 18750,
    "success_rate": 97.3,
    "avg_response_time": 1.8,
    "ai_provider_usage": {
      "openai": 60,
      "gemini": 30,
      "deepseek": 10
    },
    "detection_methods": {
      "dom": 70,
      "ocr": 20,
      "pattern": 10
    }
  },
  "trends": {
    "daily_usage": [
      {"date": "2024-01-01", "sessions": 45, "success_rate": 96.8},
      {"date": "2024-01-02", "sessions": 52, "success_rate": 97.1}
    ]
  }
}
```

#### `GET /analytics/performance`

Get detailed performance metrics.

**Response:**
```json
{
  "success": true,
  "performance": {
    "response_times": {
      "p50": 1.2,
      "p95": 3.1,
      "p99": 5.8
    },
    "throughput": {
      "requests_per_second": 125,
      "mcqs_per_minute": 450
    },
    "error_rates": {
      "total": 2.7,
      "by_type": {
        "ai_errors": 1.2,
        "ocr_errors": 0.8,
        "detection_errors": 0.7
      }
    },
    "resource_usage": {
      "cpu_usage": 45.2,
      "memory_usage": 67.8,
      "api_credits_used": 8750
    }
  }
}
```

---

### **⚙️ Configuration**

#### `GET /config/ai-providers`

Get available AI providers and their status.

**Response:**
```json
{
  "success": true,
  "providers": [
    {
      "name": "openai",
      "status": "active",
      "models": ["gpt-4", "gpt-3.5-turbo"],
      "rate_limit": 10000,
      "cost_per_request": 0.002
    },
    {
      "name": "gemini",
      "status": "active",
      "models": ["gemini-pro", "gemini-pro-vision"],
      "rate_limit": 5000,
      "cost_per_request": 0.001
    }
  ]
}
```

#### `PUT /config/settings`

Update global configuration settings.

**Request:**
```bash
curl -X PUT https://api.mvksolutions.com/v2/config/settings \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "default_ai_provider": "openai",
    "max_concurrent_sessions": 10,
    "default_answer_delay": 3,
    "enable_stealth_mode": true,
    "webhook_notifications": true
  }'
```

---

## 🔌 WebSocket API

### **Real-time Automation Updates**

Connect to WebSocket for real-time updates during automation sessions.

**Connection:**
```javascript
const ws = new WebSocket('wss://api.mvksolutions.com/v2/ws/automation');

ws.onopen = function() {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'YOUR_JWT_TOKEN'
  }));
};

ws.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log('Update:', data);
};
```

**Message Types:**

```javascript
// Session started
{
  "type": "session_started",
  "session_id": "session_1234567890",
  "total_mcqs": 15
}

// MCQ processed
{
  "type": "mcq_processed",
  "session_id": "session_1234567890",
  "mcq_id": "mcq_001",
  "result": "success",
  "answer": "A"
}

// Session completed
{
  "type": "session_completed",
  "session_id": "session_1234567890",
  "summary": {
    "total": 15,
    "successful": 14,
    "accuracy": 93.3
  }
}
```

---

## 📚 SDK & Libraries

### **JavaScript/Node.js SDK**

```bash
npm install @mvksolutions/mcq-bot-sdk
```

```javascript
import { MCQBot } from '@mvksolutions/mcq-bot-sdk';

const bot = new MCQBot({
  apiKey: 'YOUR_API_KEY',
  environment: 'production'
});

// Detect MCQs
const detection = await bot.detect.mcqs({
  url: 'https://example.com/quiz'
});

// Get AI answer
const answer = await bot.ai.answer({
  question: 'What is the capital of France?',
  options: ['Paris', 'London', 'Rome', 'Berlin']
});

// Full automation
const session = await bot.automation.process({
  url: 'https://example.com/quiz',
  autoAnswer: true
});
```

### **Python SDK**

```bash
pip install mvk-mcq-bot
```

```python
from mvk_mcq_bot import MCQBot

bot = MCQBot(api_key='YOUR_API_KEY')

# Detect MCQs
detection = bot.detect.mcqs(url='https://example.com/quiz')

# Get AI answer
answer = bot.ai.answer(
    question='What is the capital of France?',
    options=['Paris', 'London', 'Rome', 'Berlin']
)

# Full automation
session = bot.automation.process(
    url='https://example.com/quiz',
    auto_answer=True
)
```

---

## 💡 Examples

### **Complete Automation Workflow**

```bash
#!/bin/bash

API_KEY="YOUR_API_KEY"
BASE_URL="https://api.mvksolutions.com/v2"

# 1. Setup bot
BOT_RESPONSE=$(curl -s -X POST "$BASE_URL/bot/setup" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "ai_provider": "openai",
    "openai_key": "sk-...",
    "config": {
      "auto_answer": true,
      "answer_delay": 3,
      "stealth_mode": true
    }
  }')

BOT_ID=$(echo $BOT_RESPONSE | jq -r '.bot_id')

# 2. Start automation
SESSION_RESPONSE=$(curl -s -X POST "$BASE_URL/automation/process" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/quiz",
    "ai_provider": "auto",
    "automation_config": {
      "auto_answer": true,
      "stealth_mode": true
    }
  }')

SESSION_ID=$(echo $SESSION_RESPONSE | jq -r '.session_id')

# 3. Monitor progress
while true; do
  PROGRESS=$(curl -s -X GET "$BASE_URL/automation/$SESSION_ID/progress" \
    -H "Authorization: Bearer $API_KEY")
  
  STATUS=$(echo $PROGRESS | jq -r '.status')
  
  if [ "$STATUS" = "completed" ]; then
    echo "Automation completed!"
    break
  fi
  
  PERCENTAGE=$(echo $PROGRESS | jq -r '.progress.percentage')
  echo "Progress: $PERCENTAGE%"
  
  sleep 5
done

# 4. Get results
RESULTS=$(curl -s -X GET "$BASE_URL/automation/$SESSION_ID/results" \
  -H "Authorization: Bearer $API_KEY")

echo "Final Results:"
echo $RESULTS | jq '.summary'
```

### **Webhook Integration**

```javascript
// Express.js webhook handler
app.post('/webhook/mcq-automation', (req, res) => {
  const { session_id, status, summary } = req.body;
  
  if (status === 'completed') {
    console.log(`Session ${session_id} completed:`);
    console.log(`Success rate: ${summary.accuracy}%`);
    console.log(`Total MCQs: ${summary.total_mcqs}`);
    
    // Send notification to user
    notifyUser(session_id, summary);
  }
  
  res.status(200).send('OK');
});
```

---

## 🔗 Additional Resources

- **📖 Full Documentation**: [docs.mvksolutions.com](https://docs.mvksolutions.com)
- **🎮 Interactive API Explorer**: [api.mvksolutions.com/explorer](https://api.mvksolutions.com/explorer)
- **💬 Developer Support**: [support@mvksolutions.com](mailto:support@mvksolutions.com)
- **📱 Status Page**: [status.mvksolutions.com](https://status.mvksolutions.com)
- **🔧 GitHub Repository**: [github.com/mvksolutions/mcq-automation-bot](https://github.com/mvksolutions/mcq-automation-bot)

---

**Built with ❤️ by MVK Solutions - Empowering Education Through AI Innovation**