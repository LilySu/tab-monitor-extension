from flask import Flask, request, jsonify
from flask_cors import CORS
import time
import sys
import traceback
from pathlib import Path
import base64
import re
import urllib.parse
import json

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

# Track already analyzed URLs to avoid duplicate API calls
analyzed_urls = {}

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

# Replace the existing stock-research endpoint with this improved version

@app.route('/stock-research', methods=['POST'])
def stock_research():
    """Endpoint for analyzing URLs for stock information and technical research"""
    # Get the data from the request
    data = request.json
    
    if 'url' not in data:
        return jsonify({
            "success": False,
            "analysis": "Error: No URL provided in the request"
        })
    
    url = data['url']
    
    # Normalize the URL to handle variations
    try:
        parsed_url = urllib.parse.urlparse(url)
        domain = parsed_url.netloc
        clean_url = f"{parsed_url.scheme}://{parsed_url.netloc}{parsed_url.path}"
        print(f"Analyzing URL: {clean_url} (Domain: {domain})")
    except Exception as e:
        print(f"Error parsing URL '{url}': {str(e)}")
        clean_url = url
        domain = url
    
    # Check cache for previous analysis
    if clean_url in analyzed_urls:
        print(f"Using cached analysis for {clean_url}")
        return jsonify({
            "success": True,
            "analysis": analyzed_urls[clean_url]
        })
    
    # If GroqAPIWrapper is available, use it for analysis
    if groq_api_wrapper:
        try:
            # System message with instructions
            system_message = create_system_message(
                "You are a financial and technical researcher that analyzes websites. "
                "Your primary task is to determine if a website is related to a publicly traded company, "
                "and if so, provide relevant financial information and SEC filings. "
                "For non-company websites, you provide technical analysis and deep research."
            )
            
            # User message with the URL to analyze
            user_message = create_user_message(
                f"Please analyze this URL: {clean_url}\n\n"
                "First, determine if this website is related to a publicly traded company:\n"
                "1. Check if you can identify a stock ticker symbol from the domain or URL\n"
                "2. Verify if the company is publicly traded\n\n"
                "If it is a publicly traded company:\n"
                "- Provide the stock ticker symbol and exchange\n"
                "- Summarize recent important SEC filings (10-K, 8-K, 10-Q, Forms 3-4-5, Schedule 13D)\n"
                "- Include key financial information\n\n"
                "If it is NOT a publicly traded company:\n"
                "- Identify what type of content/organization the website represents\n"
                "- Provide technical details and deep research about the subject\n"
                "- Focus on documentation, resources, and technical knowledge\n\n"
                "Format your response in clear sections with headers."
            )
            
            # Create messages array
            messages = [system_message, user_message]
            
            print("Sending URL analysis request to Groq API...")
            
            # Use appropriate model for text analysis
            groq_api_wrapper.configuration.model = "llama-3.3-70b-versatile"
            
            # Get completion from Groq
            result = groq_api_wrapper.create_chat_completion(messages)
            
            # Extract the response content
            if hasattr(result, 'choices') and len(result.choices) > 0:
                analysis_text = result.choices[0].message.content
                print(f"Successfully received URL analysis from Groq API")
                
                # Save to cache
                analyzed_urls[clean_url] = analysis_text
                
                # Save cache to file for persistence
                try:
                    with open('url_analysis_cache.json', 'w') as f:
                        json.dump(analyzed_urls, f)
                except Exception as e:
                    print(f"Error saving cache: {str(e)}")
                
                return jsonify({
                    "success": True,
                    "analysis": analysis_text
                })
            else:
                error_msg = "Unexpected response format from Groq API"
                print(error_msg)
                return jsonify({
                    "success": False, 
                    "analysis": f"Error: {error_msg}"
                })
                
        except Exception as e:
            error_detail = str(e)
            stack_trace = traceback.format_exc()
            print(f"Error using Groq API for URL analysis: {error_detail}")
            print(stack_trace)
            
            # Return the error in the response
            return jsonify({
                "success": False,
                "analysis": f"Error analyzing URL: {error_detail}"
            })
    
    # Fallback to mock response
    print("Using mock response for URL analysis (Groq API unavailable)")
    time.sleep(1)  # Simulate processing time
    
    # Generate a custom mock response based on the domain
    company_name = None
    ticker = None
    exchange = None
    mock_response = ""
    
    if "nvidia.com" in domain:
        company_name = "NVIDIA Corporation"
        ticker = "NVDA"
        exchange = "NASDAQ"
        mock_response = f"""## Company Analysis

The website {url} is related to NVIDIA Corporation, which is publicly traded.

Stock Ticker Symbol: NVDA
Exchange: NASDAQ

### Recent SEC Filings
- 10-K: Filed on February 22, 2023, for the fiscal year ended January 29, 2023
- 10-Q: Filed on November 22, 2022, for the quarterly period ended October 30, 2022
- 8-K: Filed on February 22, 2023, announcing Q4 financial results
- Forms 3-4-5: Multiple insider transactions reported in January 2023
- Schedule 13D: Major ownership position reported by institutional investors

### Financial Information
- Revenue: $26.91 billion (FY 2023)
- Net Income: $9.75 billion (FY 2023)
- Market Capitalization: Approximately $601 billion
- EPS: $3.90 (FY 2023)

### Key Business Segments
- Gaming GPUs
- Data Center & AI
- Professional Visualization
- Automotive"""
    
    elif "apple.com" in domain:
        company_name = "Apple Inc."
        ticker = "AAPL"
        exchange = "NASDAQ"
        mock_response = f"""## Company Analysis

The website {url} is related to Apple Inc., which is publicly traded.

Stock Ticker Symbol: AAPL
Exchange: NASDAQ

### Recent SEC Filings
- 10-K: Filed on October 28, 2022, for the fiscal year ended September 24, 2022
- 10-Q: Filed on February 3, 2023, for the quarter ended December 31, 2022
- 8-K: Filed on February 2, 2023, announcing Q1 2023 financial results
- Forms 3-4-5: Multiple insider transactions reported in December 2022
- Schedule 13D: Several institutional ownership changes reported in Q4 2022

### Financial Information
- Revenue: $394.33 billion (FY 2022)
- Net Income: $99.8 billion (FY 2022)
- Market Capitalization: Approximately $2.3 trillion
- EPS: $6.11 (FY 2022)

### Key Business Segments
- iPhone
- Mac
- iPad
- Wearables, Home, and Accessories
- Services"""
    
    elif "microsoft.com" in domain:
        company_name = "Microsoft Corporation"
        ticker = "MSFT"
        exchange = "NASDAQ"
        mock_response = f"""## Company Analysis

The website {url} is related to Microsoft Corporation, which is publicly traded.

Stock Ticker Symbol: MSFT
Exchange: NASDAQ

### Recent SEC Filings
- 10-K: Filed on July 28, 2022, for the fiscal year ended June 30, 2022
- 10-Q: Filed on January 24, 2023, for the quarter ended December 31, 2022
- 8-K: Filed on January 24, 2023, announcing Q2 fiscal year 2023 results
- Forms 3-4-5: Multiple insider transactions reported in November 2022
- Schedule 13D: Several institutional ownership changes reported in Q4 2022

### Financial Information
- Revenue: $198.27 billion (FY 2022)
- Net Income: $72.74 billion (FY 2022)
- Market Capitalization: Approximately $1.8 trillion
- EPS: $9.65 (FY 2022)

### Key Business Segments
- Productivity and Business Processes
- Intelligent Cloud (including Azure)
- Personal Computing"""
    
    elif "meta.com" in domain or "facebook.com" in domain:
        company_name = "Meta Platforms, Inc."
        ticker = "META"
        exchange = "NASDAQ"
        mock_response = f"""## Company Analysis

The website {url} is related to Meta Platforms, Inc. (formerly Facebook, Inc.), which is publicly traded.

Stock Ticker Symbol: META
Exchange: NASDAQ

### Recent SEC Filings
- 10-K: Filed on February 2, 2023, for the fiscal year ended December 31, 2022
- 10-Q: Filed on October 27, 2022, for the quarter ended September 30, 2022
- 8-K: Filed on February 1, 2023, announcing Q4 and full-year 2022 results
- Forms 3-4-5: Multiple insider transactions reported in December 2022
- Schedule 13D: Several institutional ownership changes reported in Q4 2022

### Financial Information
- Revenue: $116.61 billion (FY 2022)
- Net Income: $23.20 billion (FY 2022)
- Market Capitalization: Approximately $450 billion
- EPS: $8.59 (FY 2022)

### Key Business Segments
- Facebook
- Instagram
- WhatsApp
- Messenger
- Reality Labs (VR/AR)"""
    
    elif "amazon.com" in domain:
        company_name = "Amazon.com, Inc."
        ticker = "AMZN"
        exchange = "NASDAQ"
        mock_response = f"""## Company Analysis

The website {url} is related to Amazon.com, Inc., which is publicly traded.

Stock Ticker Symbol: AMZN
Exchange: NASDAQ

### Recent SEC Filings
- 10-K: Filed on February 3, 2023, for the fiscal year ended December 31, 2022
- 10-Q: Filed on October 28, 2022, for the quarter ended September 30, 2022
- 8-K: Filed on February 2, 2023, announcing Q4 and full-year 2022 results
- Forms 3-4-5: Multiple insider transactions reported in November 2022
- Schedule 13D: Several institutional ownership changes reported in Q4 2022

### Financial Information
- Revenue: $513.98 billion (FY 2022)
- Net Income: -$2.72 billion (FY 2022)
- Market Capitalization: Approximately $970 billion
- EPS: -$0.27 (FY 2022)

### Key Business Segments
- North America
- International
- AWS (Amazon Web Services)"""
    
    elif "google.com" in domain or "alphabet.com" in domain:
        company_name = "Alphabet Inc."
        ticker = "GOOGL"
        exchange = "NASDAQ"
        mock_response = f"""## Company Analysis

The website {url} is related to Alphabet Inc. (parent company of Google), which is publicly traded.

Stock Ticker Symbol: GOOGL (Class A), GOOG (Class C)
Exchange: NASDAQ

### Recent SEC Filings
- 10-K: Filed on February 3, 2023, for the fiscal year ended December 31, 2022
- 10-Q: Filed on October 25, 2022, for the quarter ended September 30, 2022
- 8-K: Filed on February 2, 2023, announcing Q4 and fiscal year 2022 results
- Forms 3-4-5: Multiple insider transactions reported in December 2022
- Schedule 13D: Several institutional ownership changes reported in Q4 2022

### Financial Information
- Revenue: $282.84 billion (FY 2022)
- Net Income: $59.97 billion (FY 2022)
- Market Capitalization: Approximately $1.2 trillion
- EPS: $4.56 (FY 2022)

### Key Business Segments
- Google Services (Search, Android, Chrome, YouTube)
- Google Cloud
- Other Bets (early-stage technologies)"""
    
    elif "twitter.com" in domain:
        company_name = "Twitter, Inc. (Now private under X Corp)"
        ticker = "Private (formerly TWTR)"
        exchange = "Private (formerly NYSE)"
        mock_response = f"""## Company Analysis

The website {url} is related to Twitter (now X Corp). Twitter was previously publicly traded as Twitter, Inc. under the ticker symbol TWTR on the NYSE, but was taken private by Elon Musk in October 2022.

Stock Ticker Symbol: Private (formerly TWTR)
Exchange: Private (formerly NYSE)

### Recent Information
- Twitter was acquired by Elon Musk for approximately $44 billion
- The company is now privately held and no longer files SEC reports
- The platform has been rebranded as "X"

### Historical Information
- Revenue: $5.08 billion (FY 2021, last full year as public company)
- Net Income: -$221 million (FY 2021)
- Acquisition price: $54.20 per share

### Key Business
- Social media platform
- Advertising services
- Data licensing"""
    
    elif "github.com" in domain or "python.org" in domain or "stackoverflow.com" in domain:
        mock_response = f"""## Technical Resource Analysis

The website {url} is not associated with a publicly traded company.

### Website Category
Developer/Technical Documentation

### Key Resources
- Technical documentation and code repositories
- Community resources and knowledge base
- Learning materials and references

### Technical Details
- Primary technologies: Web development, programming tools
- Main audience: Software developers, engineers, technical professionals
- Provides extensive documentation and community support"""
    
    else:
        mock_response = f"""## Website Analysis: {domain}

After analyzing this URL, I found no clear indication that it's associated with a publicly traded company.

### Website Overview
- Type: General website
- Category: Could not determine definitively
- No stock ticker symbol identified

### Content Analysis
- Website appears to contain general information
- No definitive SEC filings or stock information available
- Would need deeper analysis to determine specific subject matter

### Recommendation
For more accurate analysis, you may want to use a specialized financial database or search for company information directly."""
    
    # Save this mock response to the cache
    analyzed_urls[clean_url] = mock_response
    
    # Try to save to file
    try:
        with open('url_analysis_cache.json', 'w') as f:
            json.dump(analyzed_urls, f)
    except Exception as e:
        print(f"Error saving cache: {str(e)}")
    
    return jsonify({
        "success": True,
        "analysis": mock_response
    })


# Try to load previous cache on startup
try:
    if Path('url_analysis_cache.json').exists():
        with open('url_analysis_cache.json', 'r') as f:
            analyzed_urls = json.load(f)
            print(f"Loaded {len(analyzed_urls)} cached URL analyses")
except Exception as e:
    print(f"Error loading URL cache: {str(e)}")

if __name__ == '__main__':
    print(f"Repository root path: {repo_root}")
    print("Starting mock analysis server on http://localhost:5000")
    print("Press Ctrl+C to stop the server")
    app.run(host='0.0.0.0', port=5000, debug=True)