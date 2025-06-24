#!/usr/bin/env python3
"""
MCQ Automation Bot Server
Run this script to start the Flask backend server
"""

import os
import sys
from app import app

def main():
    """Main function to run the server"""
    print("🤖 Starting MCQ Automation Bot Server...")
    print("=" * 50)
    print("Backend URL: http://localhost:5000")
    print("Frontend URL: Open frontend/index.html in your browser")
    print("=" * 50)
    
    # Check if required packages are installed
    try:
        import flask
        import selenium
        import cv2
        import pytesseract
        import openai
        print("✅ All required packages are installed")
    except ImportError as e:
        print(f"❌ Missing required package: {e}")
        print("Please run: pip install -r requirements.txt")
        sys.exit(1)
    
    # Check if ChromeDriver is available
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        
        options = Options()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        
        driver = webdriver.Chrome(options=options)
        driver.quit()
        print("✅ ChromeDriver is available")
    except Exception as e:
        print(f"❌ ChromeDriver not found: {e}")
        print("Please install ChromeDriver: https://chromedriver.chromium.org/")
        print("Or use: pip install webdriver-manager")
    
    # Start the Flask server
    try:
        app.run(
            debug=True,
            host='0.0.0.0',
            port=5000,
            threaded=True
        )
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"❌ Server error: {e}")

if __name__ == "__main__":
    main()