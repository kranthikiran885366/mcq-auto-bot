# AI MCQ Answering Bot Chrome Extension

This Chrome extension automatically detects and answers Multiple Choice Questions (MCQs) on websites using AI.

## Features

- **Automatic MCQ Detection**: Detects MCQs on any website using DOM parsing and OCR.
- **AI-Powered Answers**: Uses AI (OpenAI, Google Gemini, or DeepSeek) to predict the correct answers.
- **Multiple MCQ Types**: Supports radio buttons, checkboxes, dropdowns, and more.
- **Voice Narration**: Optional voice narration of questions and answers.
- **Safe Mode**: Detects proctored environments and disables the bot.
- **Customizable Settings**: Configure delay times, retry behavior, and more.

## Installation

### Method 1: Install from Chrome Web Store (Coming Soon)

1. Visit the Chrome Web Store (link will be provided when published)
2. Click "Add to Chrome"
3. Follow the prompts to install the extension

### Method 2: Manual Installation (Developer Mode)

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the folder containing the extension files
5. The extension should now be installed and visible in your extensions list

## Setup

1. After installation, click on the extension icon in your browser toolbar
2. Go to "Settings & API Configuration"
3. Choose your preferred AI provider (OpenAI, Google Gemini, or DeepSeek)
4. Enter your API key
5. Configure other settings as desired
6. Click "Save API Settings"

## Usage

1. Navigate to a website with MCQs
2. Click the extension icon to open the popup
3. Toggle "Enable Bot" to start the bot
4. The bot will automatically scan for MCQs and answer them
5. You can also click "Scan for MCQs" to manually trigger a scan

## Settings

### API Configuration

- **AI Provider**: Choose between OpenAI (ChatGPT), Google Gemini Pro, or DeepSeek
- **API Key**: Your API key for the selected provider
- **Model**: The specific AI model to use

### Behavior Settings

- **Auto-Answer Questions**: Automatically select answers when found
- **Answer Delay**: Time to wait before selecting an answer (for natural behavior)
- **Retry Wrong Answers**: Try another option if the first answer is wrong
- **Voice Narration**: Enable spoken narration of questions and answers

### Advanced Settings

- **Safe Mode**: Disable the bot in proctored environments
- **Detect Webcam**: Check if webcam is active
- **Detect Fullscreen Mode**: Check if the browser is in fullscreen mode
- **OCR Detection**: Enable OCR for detecting MCQs in images
- **OCR Language**: Set the language for OCR

## Ethical Use

This tool is intended for:
- Learning and practicing with MCQs
- Self-assessment and study
- Educational purposes

Please use this tool responsibly and ethically. Do not use it to cheat on official exams or assessments.

## Privacy

This extension:
- Does not collect or store your data
- Processes all MCQs locally
- Only sends question text to the AI API for answer prediction
- Does not track your browsing history

## Troubleshooting

If the extension is not working as expected:

1. Make sure you have entered a valid API key
2. Check that the bot is enabled in the popup
3. Try refreshing the page
4. Ensure the MCQs are in a format the bot can detect
5. Check the browser console for any error messages

## License

This project is licensed under the MIT License - see the LICENSE file for details.
