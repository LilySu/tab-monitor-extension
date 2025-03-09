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
import os

# Set up a fallback environment variable loader in case the import fails
def fallback_load_environment_file():
    """Load environment variables from .env file (fallback implementation)"""
    print("Using fallback environment loader")
    env_path = Path('.env')
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                key, value = line.split('=', 1)
                os.environ[key] = value
                print(f"Loaded environment variable: {key}")
    else:
        print("No .env file found")

def fallback_get_environment_variable(name, default=None):
    """Get an environment variable (fallback implementation)"""
    return os.environ.get(name, default)

# Try to import from the repository or use the fallback
try:
    # Add the repository root to the Python path
    # Assuming mock_analysis_server.py is one level deep from repo root
    file_path = Path(__file__).resolve()  # Get the absolute path of the current file
    repo_root = file_path.parent.parent   # Go up one level to get repo root
    sys.path.insert(0, str(repo_root))    # Add repo root to Python path
    
    # Try to import modules from pytabmonitor
    try:
        from pytabmonitor.Utilities.load_environment_file import (
            load_environment_file,
            get_environment_variable)
        print("Successfully imported load_environment_file from pytabmonitor")
    except ImportError:
        print("Could not import from pytabmonitor.Utilities, using fallback")
        load_environment_file = fallback_load_environment_file
        get_environment_variable = fallback_get_environment_variable
    
    try:
        from pytabmonitor.GroqAPIWrappers.GroqAPIWrapper import GroqAPIWrapper
        print("Successfully imported GroqAPIWrapper from pytabmonitor")
        has_groq_wrapper = True
    except ImportError:
        print("Could not import GroqAPIWrapper, will use mock responses only")
        has_groq_wrapper = False
        
    # Load environment variables from .env file
    load_environment_file()
    
except Exception as e:
    print(f"Error setting up imports: {e}")
    print("Using fallback implementations")
    load_environment_file = fallback_load_environment_file
    get_environment_variable = fallback_get_environment_variable
    has_groq_wrapper = False
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
            # System message with improved instructions
            system_message = create_system_message(
                "You are an expert financial and technical researcher specializing in company stock analysis and deep research. "
                "Your task is to analyze a website URL and provide detailed, structured information."
            )
            
            # Enhanced user message with more specific instructions
            user_message = create_user_message(
                f"Analyze this URL thoroughly: {clean_url}\n\n"
                "STEP 1: Determine if this website is related to a publicly traded company.\n"
                "- Look for company names, corporate domains, product references\n"
                "- Check if there are hints of stock market presence\n\n"
                "STEP 2: If it IS a publicly traded company:\n"
                "- Identify and prominently display the stock ticker symbol and exchange\n"
                "- Find the most recent SEC filings (focus on Form 10-K, Form 10-Q, Form 8-K)\n"
                "- Extract key financial data: revenue, profit margins, EPS, market cap\n"
                "- Identify primary business segments and growth areas\n"
                "- Report any recent significant news or developments\n\n"
                "STEP 3: If it is NOT a publicly traded company:\n"
                "- Determine the entity type (private company, non-profit, government, educational, etc.)\n"
                "- Conduct deep research using 'sonar-deep-research' methodology:\n"
                "  * Find research papers, technical documentation, or whitepapers\n"
                "  * Discover most upvoted content on Reddit, Quora, Twitter, TikTok\n"
                "  * Identify mentions in major publications (The Atlantic, Washington Post, NYT, etc.)\n"
                "  * Look for industry associations, competitors, and market position\n"
                "  * Analyze technical aspects, innovations, or specialized knowledge\n\n"
                "FORMAT YOUR RESPONSE AS FOLLOWS:\n"
                "1. For public companies:\n"
                "```\n"
                "# [TICKER]: [COMPANY NAME]\n\n"
                "## Company Overview\n"
                "[Brief description, 1-2 sentences]\n\n"
                "**Exchange:** [Exchange name]\n"
                "**Industry:** [Primary industry]\n\n"
                "## Recent SEC Filings\n"
                "- Most recent 10-K: [Date, key points]\n"
                "- Most recent 10-Q: [Date, key points]\n"
                "- Recent 8-K: [Date, purpose]\n\n"
                "## Financial Highlights\n"
                "- Revenue: [Amount] ([Period])\n"
                "- [Other key metrics]\n\n"
                "## Business Segments\n"
                "- [List key segments]\n\n"
                "## Recent Developments\n"
                "- [List recent news]\n"
                "```\n\n"
                "2. For non-public entities:\n"
                "```\n"
                "# [ENTITY NAME]: [ENTITY TYPE]\n\n"
                "## Overview\n"
                "[Brief description, 2-3 sentences]\n\n"
                "## Key Research & Resources\n"
                "- Research Papers: [List notable papers]\n"
                "- Technical Documentation: [List key resources]\n"
                "- Community Insights: [Reddit, Quora, social media highlights]\n\n"
                "## Industry Position\n"
                "- Competitors: [List main competitors]\n"
                "- Market Focus: [Describe target market/users]\n\n"
                "## Technical Analysis\n"
                "- [Key technical aspects]\n\n"
                "## Media Coverage\n"
                "- [Notable mentions in publications]\n"
                "```\n\n"
                "Ensure your analysis is comprehensive but concise. Always provide valuable information regardless of entity type."
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
    
    # Fallback to improved mock response
    print("Using mock response for URL analysis (Groq API unavailable)")
    time.sleep(1)  # Simulate processing time
    
    # Generate an enhanced custom mock response based on the domain
    mock_response = ""
    
    if "nvidia.com" in domain:
        mock_response = """# NVDA: NVIDIA Corporation

## Company Overview
NVIDIA is a global technology company specializing in GPUs, AI, and accelerated computing solutions.

**Exchange:** NASDAQ
**Industry:** Semiconductors, Computer Hardware

## Recent SEC Filings
- Most recent 10-K: February 21, 2024 (FY ended January 28, 2024) - Record revenue of $60.92B, up 126% from previous year
- Most recent 10-Q: November 21, 2023 (Q3 FY 2024) - Revenue of $18.12B, up 206% from previous year
- Recent 8-K: February 21, 2024 - Announcing Q4 and FY 2024 financial results

## Financial Highlights
- Revenue: $60.92 billion (FY 2024)
- Net Income: $29.76 billion (FY 2024)
- Gross Margin: 74.2% (FY 2024)
- EPS: $12.03 (FY 2024)
- Market Capitalization: ~$2.2 trillion

## Business Segments
- Data Center (AI, Cloud Computing)
- Gaming (GeForce GPUs)
- Professional Visualization (Workstation Graphics)
- Automotive (Self-driving Vehicle Technology)

## Recent Developments
- Released Blackwell GPU architecture for AI computing
- Expanding manufacturing partnerships to meet AI chip demand
- Announced new enterprise AI solutions and partnerships
- Continuing development of omniverse platform for industrial metaverse applications"""
    
    elif "python.org" in domain:
        mock_response = """# Python Software Foundation: Non-profit Organization

## Overview
Python.org is the official website of the Python programming language, maintained by the Python Software Foundation (PSF). Python is one of the world's most popular programming languages, known for its readability and versatility.

## Key Research & Resources
- Research Papers: "Python in Scientific Computing" (Nature Methods), "Python in Data Science" (Various academic publications)
- Technical Documentation: Comprehensive Python Language Reference, Library References, Python Enhancement Proposals (PEPs)
- Community Insights: r/Python (960K+ members), extensive Stack Overflow presence (1.9M+ questions), active Python Discord communities

## Industry Position
- Competitors: Other programming languages (JavaScript, Java, C++, R, Go)
- Market Focus: Developers, data scientists, educators, researchers, enterprise organizations

## Technical Analysis
- Current stable release: Python 3.12
- Key features: Dynamic typing, comprehensive standard library, extensive third-party package ecosystem
- Implementation variants: CPython (standard), PyPy, Jython, IronPython
- Growing applications in AI/ML, data science, web development, automation, and systems programming

## Media Coverage
- Featured in IEEE Spectrum's top programming languages
- Regular coverage in TechCrunch, The Verge, and technology publications
- Highlighted in academic journals for scientific computing applications
- Frequently mentioned in business publications for enterprise adoption"""
    
    elif "claude.ai" in domain:
        mock_response = """# Anthropic: Private AI Company

## Overview
Claude.ai is the website for Claude, an AI assistant developed by Anthropic. Anthropic is a private AI safety company founded in 2021 focused on developing reliable, interpretable, and steerable AI systems.

## Key Research & Resources
- Research Papers: "Constitutional AI" (2022), "Training language models to follow instructions" (2022), "Discovering Language Model Behaviors" (2023)
- Technical Documentation: Claude system cards, model specifications, safety benchmarking reports
- Community Insights: r/AnthropicAI (40K+ members), popular discussions on Hacker News and AI forums

## Industry Position
- Competitors: OpenAI (ChatGPT), Google (Bard/Gemini), Cohere, Microsoft
- Market Focus: Enterprise AI solutions, researchers, developers, general consumers

## Technical Analysis
- Current models: Claude 3 family (Haiku, Sonnet, Opus)
- Key capabilities: Natural language understanding, contextual comprehension, reduced hallucinations
- Technical approach: Constitutional AI methodology, RLHF, frontier model safety research
- API availability with extensive documentation for developers

## Media Coverage
- Featured in New York Times, Wall Street Journal, MIT Technology Review
- Significant venture funding rounds reported in TechCrunch and Bloomberg
- Academic citations in AI safety and alignment literature
- Growing presence in enterprise AI adoption discussions"""
    
    else:
        mock_response = f"""# {domain}: General Website

## Overview
This website does not appear to be associated with a publicly traded company. After thorough analysis, I could not definitively determine the nature of this entity based on the URL alone.

## Key Research & Resources
- Research Papers: No significant academic citations found
- Technical Documentation: Limited public technical resources identified
- Community Insights: Minimal presence on major discussion platforms

## Industry Position
- Competitors: Unable to determine from available information
- Market Focus: Requires further investigation

## Technical Analysis
- Website appears to serve general content
- More detailed technical analysis would require direct examination of the site

## Media Coverage
- No significant mentions in major publications identified
- Consider visiting the website directly for more information about its purpose and offerings

For more accurate analysis, additional information about the website or organization would be needed."""
    
    # Save this enhanced mock response to the cache
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