from flask import Flask, request, jsonify
from flask_cors import CORS
import time
import sys
import traceback
from pathlib import Path
import base64
import re

# Add the repository root to the Python path
# Assuming mock_analysis_server.py is one level deep from repo root
file_path = Path(__file__).resolve()  # Get the absolute path of the current file
repo_root = file_path.parent.parent   # Go up one level to get repo root
sys.path.insert(0, str(repo_root))    # Add repo root to Python path

# Now we can import modules from pytabmonitor
from pytabmonitor.Utilities.load_environment_file import (
    load_environment_file,
    get_environment_variable)
from pytabmonitor.GroqAPIWrappers.GroqAPIWrapper import GroqAPIWrapper

# Load environment variables from .env file
load_environment_file()

app = Flask(__name__)
CORS(app)  # Enable CORS so the Chrome extension can access this server

# Initialize the GroqAPIWrapper with API key from environment
try:
    api_key = get_environment_variable("GROQ_API_KEY")
    print(f"Got API key: {api_key[:4]}...{api_key[-4:]} (length: {len(api_key)})")
    
    groq_api_wrapper = GroqAPIWrapper(
        api_key=api_key
    )
    # Configure the API wrapper
    groq_api_wrapper.configuration.temperature = 0.7
    groq_api_wrapper.configuration.max_tokens = 1000
    groq_api_wrapper.configuration.stop = None
    groq_api_wrapper.configuration.stream = False
    
    # Make sure we set a model - this is often required
    groq_api_wrapper.configuration.model = "llama-3.3-70b-versatile"
    
    print("Successfully initialized GroqAPIWrapper")
    print(f"Using model: {groq_api_wrapper.configuration.model}")
except Exception as e:
    print(f"Error initializing GroqAPIWrapper: {e}")
    print(traceback.format_exc())
    groq_api_wrapper = None

def create_system_message(content):
    """Helper function to create a system message"""
    return {"role": "system", "content": content}

def create_user_message(text_content, image_base64=None):
    """Create a user message with optional image content"""
    if image_base64:
        # Create a multimodal message with both text and image
        return {
            "role": "user",
            "content": [
                {"type": "text", "text": text_content},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{image_base64}"
                    }
                }
            ]
        }
    else:
        # Text-only message
        return {"role": "user", "content": text_content}

@app.route('/analyze-screenshot', methods=['POST'])
def analyze_screenshot():
    # Get the data from the request
    data = request.json
    
    # Print some info about the received screenshot
    screenshot_data = None
    if 'screenshot' in data:
        screenshot_length = len(data['screenshot'])
        raw_screenshot = data['screenshot']
        print(f"Received screenshot data ({screenshot_length} bytes)")
        
        # Ensure proper base64 formatting
        # First, check if the data already contains the data URL prefix
        if raw_screenshot.startswith('data:'):
            # Extract just the base64 part if it's already a data URL
            match = re.search(r'base64,(.+)', raw_screenshot)
            if match:
                screenshot_data = match.group(1)
            else:
                screenshot_data = raw_screenshot
        else:
            # If it's raw base64, use it directly
            screenshot_data = raw_screenshot
            
        # Validate that it's proper base64
        try:
            # Try to decode to verify it's valid base64
            base64.b64decode(screenshot_data)
        except Exception as e:
            print(f"Invalid base64 data: {str(e)}")
            screenshot_data = None
    else:
        print("No screenshot data received")
    
    # If GroqAPIWrapper is available, use it to analyze the screenshot
    if groq_api_wrapper and screenshot_data:
        try:
            # For vision models, we can't use system messages with images
            # So we'll incorporate the instructions into the user message
            user_message = create_user_message(
                "You are an AI assistant that analyzes screenshots of webpages. "
                "Describe what you see in this image in detail, including text content, "
                "layout, and visual elements. Be thorough but concise.",
                screenshot_data
            )
            
            # Create messages array with only the user message
            messages = [user_message]
            
            print("Sending request to Groq API...")
            
            # Update model to vision-capable model
            groq_api_wrapper.configuration.model = "llama-3.2-11b-vision-preview"
            
            # Get completion from Groq
            result = groq_api_wrapper.create_chat_completion(messages)
            
            # Extract the response content
            if hasattr(result, 'choices') and len(result.choices) > 0:
                analysis_text = result.choices[0].message.content
                print(f"Successfully received content from Groq API")
            else:
                error_msg = "Unexpected response format from Groq API"
                print(error_msg)
                analysis_text = f"Error: {error_msg}"
                
            return jsonify({
                "success": True,
                "analysis": analysis_text
            })
            
        except Exception as e:
            error_detail = str(e)
            stack_trace = traceback.format_exc()
            print(f"Error using Groq API: {error_detail}")
            print(stack_trace)
            
            # Return the error in the response
            return jsonify({
                "success": False,
                "analysis": f"Error using Groq API: {error_detail}"
            })
    
    # Fallback to mock response
    print("Using mock response (Groq API unavailable or error occurred)")
    time.sleep(3)
    
    # Return a mock analysis response
    return jsonify({
        "success": True,
        "analysis": "I can see a webpage displayed in a browser window. The page contains text content, navigation elements, and possibly images. The layout appears to be structured with headers and content sections. This analysis is a mock response - when using the real Groq API, you'll receive a detailed description of the actual content visible in the screenshot."
    })

if __name__ == '__main__':
    print(f"Repository root path: {repo_root}")
    print("Starting mock screenshot analysis server on http://localhost:5000")
    print("Press Ctrl+C to stop the server")
    app.run(host='0.0.0.0', port=5000, debug=True)
