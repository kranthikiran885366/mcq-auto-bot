# MCQ Automation Bot

A complete automation solution for Multiple Choice Questions (MCQs) using AI and web automation. This project includes both frontend and backend components with full automation capabilities.

## 🚀 Features

- **Advanced MCQ Detection**: Detects MCQs using multiple strategies (DOM parsing, OCR, pattern recognition)
- **AI-Powered Answers**: Uses OpenAI GPT-4 or Google Gemini Pro for intelligent answer prediction
- **Human-like Behavior**: Simulates natural human interaction patterns
- **Stealth Mode**: Advanced anti-detection techniques
- **Multiple Detection Methods**: Form-based, list-based, table-based, and pattern-based detection
- **Real-time Processing**: Live processing with progress tracking
- **Beautiful Frontend**: Modern, responsive web interface
- **Complete Automation**: No human intervention required

## 📁 Project Structure

```
mcq-automation-bot/
├── backend/
│   ├── app.py                 # Main Flask application
│   ├── automation_bot.py      # Advanced MCQ automation bot
│   ├── requirements.txt       # Python dependencies
│   ├── install_dependencies.py # Dependency installer
│   ├── run_server.py          # Server runner script
│   ├── .env.example          # Environment variables template
│   └── templates/
│       └── index.html         # Backend control panel
├── frontend/
│   └── index.html            # Main frontend dashboard
└── README.md
```

## 🛠️ Installation

### Prerequisites

- Python 3.8 or higher
- Google Chrome browser
- Internet connection

### Quick Setup

1. **Clone or download the project**
   ```bash
   git clone <repository-url>
   cd mcq-automation-bot
   ```

2. **Install dependencies automatically**
   ```bash
   cd backend
   python install_dependencies.py
   ```

3. **Manual installation (if automatic fails)**
   ```bash
   pip install -r requirements.txt
   ```

4. **Install Tesseract OCR** (for image-based MCQ detection)
   - **Windows**: Download from [GitHub](https://github.com/UB-Mannheim/tesseract/wiki)
   - **macOS**: `brew install tesseract`
   - **Ubuntu**: `sudo apt install tesseract-ocr`

## 🚀 Usage

### 1. Start the Backend Server

```bash
cd backend
python run_server.py
```

The server will start at `http://localhost:5000`

### 2. Open the Frontend

Open `frontend/index.html` in your web browser or serve it using a local server:

```bash
cd frontend
python -m http.server 8080
```

Then visit `http://localhost:8080`

### 3. Configure the Bot

1. **Enter API Keys**:
   - Get OpenAI API key from [OpenAI Platform](https://platform.openai.com/api-keys)
   - Get Google Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

2. **Configure Settings**:
   - Choose AI provider (OpenAI or Gemini)
   - Set answer delay (1-10 seconds)
   - Configure retry attempts
   - Enable/disable headless mode

3. **Set Target URL**:
   - Enter the URL of the quiz/MCQ page

### 4. Run Automation

1. Click **"Setup Bot"** to initialize the automation system
2. Click **"Detect MCQs"** to scan for questions (optional)
3. Click **"Auto Process MCQs"** to automatically answer all questions
4. Monitor progress and results in real-time

## 🎯 Supported MCQ Types

- **Radio Button Groups**: Single-choice questions
- **Checkbox Groups**: Multiple-choice questions
- **Form-based MCQs**: Questions within HTML forms
- **List-based MCQs**: Questions in ordered/unordered lists
- **Table-based MCQs**: Questions in table structures
- **Pattern-based MCQs**: Text-based questions with A) B) C) D) format
- **Image-based MCQs**: Questions extracted using OCR

## 🧠 AI Providers

### OpenAI GPT-4
- High accuracy for complex questions
- Excellent reasoning capabilities
- Requires OpenAI API key

### Google Gemini Pro
- Fast processing
- Good for general knowledge questions
- Requires Google AI API key

## ⚙️ Configuration Options

### Bot Settings
- **Headless Mode**: Run browser in background
- **Auto Answer**: Automatically select answers
- **Answer Delay**: Time between selections (1-10 seconds)
- **Max Retries**: Number of retry attempts (1-5)

### Detection Settings
- **Form Detection**: Scan HTML forms
- **List Detection**: Scan list structures
- **Table Detection**: Scan table structures
- **Pattern Detection**: Use text pattern matching
- **OCR Detection**: Extract text from images

## 🔒 Stealth Features

- **Anti-Detection**: Advanced techniques to avoid detection
- **Human-like Behavior**: Random delays and mouse movements
- **User Agent Rotation**: Multiple browser identities
- **Natural Scrolling**: Simulates human scrolling patterns

## 📊 Monitoring & Results

- **Real-time Progress**: Live progress tracking
- **Success Statistics**: Accuracy and completion rates
- **Detailed Results**: Question-by-question breakdown
- **Error Handling**: Comprehensive error reporting

## 🚨 Ethical Usage

This tool is intended for:
- **Educational purposes**
- **Practice and learning**
- **Self-assessment**
- **Research and development**

**Please use responsibly and ethically. Do not use for:**
- Cheating on official exams
- Violating terms of service
- Academic dishonesty

## 🛠️ Troubleshooting

### Common Issues

1. **ChromeDriver not found**
   ```bash
   pip install webdriver-manager
   ```

2. **Tesseract not found**
   - Install Tesseract OCR for your operating system
   - Add to system PATH

3. **API key errors**
   - Verify API keys are correct
   - Check API quotas and billing

4. **MCQs not detected**
   - Try different detection methods
   - Check page structure
   - Enable OCR detection

### Debug Mode

Enable debug mode in `backend/app.py`:
```python
app.run(debug=True)
```

## 📝 API Endpoints

- `POST /api/setup` - Initialize the bot
- `POST /api/detect-mcqs` - Detect MCQs on page
- `POST /api/process-mcqs` - Process MCQs automatically
- `POST /api/ocr-detect` - OCR-based detection
- `POST /api/get-answer` - Get AI answer for question
- `POST /api/close` - Close the bot

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This software is provided for educational and research purposes only. Users are responsible for ensuring their use complies with applicable laws, regulations, and terms of service. The developers are not responsible for any misuse of this software.

## 🆘 Support

For support and questions:
1. Check the troubleshooting section
2. Review the documentation
3. Open an issue on GitHub
4. Contact the development team

---

**Happy Automating! 🤖**