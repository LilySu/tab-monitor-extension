// JavaScript for the simplified insights.html page
document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const currentUrlElement = document.getElementById('currentUrl');
    const updateTimeElement = document.getElementById('updateTime');
    const researchStatusElement = document.getElementById('researchStatus');
    const researchProgressElement = document.getElementById('researchProgress');
    const researchResultsElement = document.getElementById('researchResults');
    
    // Store a cache of already analyzed URLs to prevent duplicate research
    let analyzedUrls = {};
    
    // Keep track of the last analyzed URL to prevent re-analyzing the same URL
    let lastAnalyzedUrl = '';
    
    // Function to format time
    function formatTime(date) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const seconds = date.getSeconds().toString().padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    }
    
    // Update time on load
    updateTimeElement.textContent = formatTime(new Date());
    
    // Function to update the research status
    function updateResearchStatus(status, message) {
      console.log("Research status updated:", status, message);
      
      researchStatusElement.textContent = message;
      researchStatusElement.className = 'status ' + status;
      
      // Show/hide progress element
      researchProgressElement.style.display = status === 'in-progress' ? 'block' : 'none';
      
      // Update the time
      updateTimeElement.textContent = formatTime(new Date());
    }
    
    // Function to format the research results into a nicely structured HTML output
    function formatResearchResults(data, url) {
      try {
        // First, detect if this is a publicly traded company or not
        const isPublicCompany = data.includes("Stock Ticker Symbol") || 
                                data.includes("NASDAQ:") || 
                                data.includes("NYSE:") || 
                                (data.includes("Exchange:") && !data.includes("Exchange: N/A"));
        
        // Parse entity name and type
        let entityName = "Unknown Entity";
        let entityType = "Unknown Type";
        
        // Extract headers to determine company/entity name and type
        const headerMatch = data.match(/# ([^:]+):(.*)/);
        if (headerMatch) {
          entityName = headerMatch[1].trim();
          entityType = headerMatch[2].trim();
        } else {
          // Alternative pattern for public companies
          const publicMatch = data.match(/# ([^:]+):/);
          if (publicMatch) {
            entityName = publicMatch[1].trim();
            entityType = "Public Company";
          } else {
            // Last resort - extract domain name
            const urlObj = new URL(url);
            entityName = urlObj.hostname.replace(/^www\./, '');
          }
        }
        
        // Start building HTML output
        let html = `<div class="company-header">${entityName}</div>`;
                
        // Add overview section
        html += `<div class="section-header">Overview</div>
        <table>
          <tr>
            <th>Website</th>
            <td><a href="${url}" target="_blank">${url}</a></td>
          </tr>`;
          
        if (isPublicCompany) {
          // Extract ticker symbol
          let tickerSymbol = "N/A";
          const tickerMatch = data.match(/[Tt]icker[^\w]+([A-Z]+)/);
          if (tickerMatch && tickerMatch[1]) {
            tickerSymbol = tickerMatch[1];
          }
          
          // Extract exchange
          let exchange = "N/A";
          const exchangeMatch = data.match(/[Ee]xchange[^\w]+(NASDAQ|NYSE|AMEX|OTC)/);
          if (exchangeMatch && exchangeMatch[1]) {
            exchange = exchangeMatch[1];
          }
          
          html += `
          <tr>
            <th>Type</th>
            <td>Publicly Traded Company</td>
          </tr>
          <tr>
            <th>Ticker</th>
            <td>${tickerSymbol}</td>
          </tr>
          <tr>
            <th>Exchange</th>
            <td>${exchange}</td>
          </tr>
          </table>`;
          
          // Add SEC Filings section for public companies
          html += `<div class="section-header">SEC Filings</div>
          <table>
            <tr>
              <th>Form</th>
              <th>Date Filed</th>
              <th>Description</th>
              <th>Link</th>
            </tr>`;
          
          // Try to extract 10-K information
          if (data.includes("10-K")) {
            const tenKMatch = data.match(/10-K[^:]*:([^,]+)/);
            const tenKDate = tenKMatch ? tenKMatch[1].trim() : "Recent";
            html += `
              <tr>
                <td>10-K</td>
                <td>${tenKDate}</td>
                <td>Annual Report</td>
                <td><a href="https://www.sec.gov/edgar/search/#/entityName=${entityName}" target="_blank">View</a></td>
              </tr>`;
          }
          
          // Try to extract 10-Q information
          if (data.includes("10-Q")) {
            const tenQMatch = data.match(/10-Q[^:]*:([^,]+)/);
            const tenQDate = tenQMatch ? tenQMatch[1].trim() : "Recent";
            html += `
              <tr>
                <td>10-Q</td>
                <td>${tenQDate}</td>
                <td>Quarterly Report</td>
                <td><a href="https://www.sec.gov/edgar/search/#/entityName=${entityName}" target="_blank">View</a></td>
              </tr>`;
          }
          
          // Try to extract 8-K information
          if (data.includes("8-K")) {
            html += `
              <tr>
                <td>8-K</td>
                <td>Various</td>
                <td>Current Reports</td>
                <td><a href="https://www.sec.gov/edgar/search/#/entityName=${entityName}" target="_blank">View</a></td>
              </tr>`;
          }
          
          html += `</table>`;
          
          // Add Financial Information section
          html += `<div class="section-header">Financial Highlights</div>
          <table>
            <tr>
              <th>Metric</th>
              <th>Value</th>
            </tr>
            <tr>
              <td>Revenue</td>
              <td>See <a href="https://finance.yahoo.com/quote/${tickerSymbol}" target="_blank">Yahoo Finance</a> for latest data</td>
            </tr>
            <tr>
              <td>Net Income</td>
              <td>See <a href="https://finance.yahoo.com/quote/${tickerSymbol}" target="_blank">Yahoo Finance</a> for latest data</td>
            </tr>
            <tr>
              <td>Market Cap</td>
              <td>See <a href="https://finance.yahoo.com/quote/${tickerSymbol}" target="_blank">Yahoo Finance</a> for latest data</td>
            </tr>
          </table>`;
          
          // Add External Resources section for public companies
          html += `
            <div class="section-header">External Resources</div>
            <table>
              <tr>
                <th>Resource</th>
                <th>Link</th>
              </tr>
              <tr>
                <td>SEC EDGAR Database</td>
                <td><a href="https://www.sec.gov/edgar/searchedgar/companysearch" target="_blank">Search for ${entityName}</a></td>
              </tr>
              <tr>
                <td>Yahoo Finance</td>
                <td><a href="https://finance.yahoo.com/quote/${tickerSymbol}" target="_blank">${tickerSymbol} Quote</a></td>
              </tr>
              <tr>
                <td>Company IR Page</td>
                <td><a href="${url.split('/').slice(0, 3).join('/')}/investors" target="_blank">Investor Relations</a></td>
              </tr>
            </table>`;
          
        } else {
          // Non-public company formatting
          html += `
          <tr>
            <th>Type</th>
            <td>${entityType}</td>
          </tr>
          </table>`;
          
          // Parse key research & resources section
          html += `<div class="section-header">Key Research & Resources</div>
          <table>
            <tr>
              <th>Category</th>
              <th>Sources</th>
            </tr>`;
            
          // Research papers
          if (data.includes("Research Papers")) {
            const papersMatch = data.match(/Research Papers:([^\n]+)/);
            const papers = papersMatch ? papersMatch[1].trim() : "No significant research papers found";
            html += `
              <tr>
                <td>Research Papers</td>
                <td>${papers}</td>
              </tr>`;
          }
          
          // Technical documentation
          if (data.includes("Technical Documentation")) {
            const docsMatch = data.match(/Technical Documentation:([^\n]+)/);
            const docs = docsMatch ? docsMatch[1].trim() : "Limited technical documentation available";
            html += `
              <tr>
                <td>Documentation</td>
                <td>${docs}</td>
              </tr>`;
          }
          
          // Community insights
          if (data.includes("Community Insights")) {
            const insightsMatch = data.match(/Community Insights:([^\n]+)/);
            const insights = insightsMatch ? insightsMatch[1].trim() : "Limited community discussion found";
            html += `
              <tr>
                <td>Community</td>
                <td>${insights}</td>
              </tr>`;
          }
          
          html += `</table>`;
          
          // Industry position section
          html += `<div class="section-header">Industry Position</div>
          <table>
            <tr>
              <th>Category</th>
              <th>Details</th>
            </tr>`;
            
          // Competitors
          if (data.includes("Competitors")) {
            const competitorsMatch = data.match(/Competitors:([^\n]+)/);
            const competitors = competitorsMatch ? competitorsMatch[1].trim() : "Unknown competitors";
            html += `
              <tr>
                <td>Competitors</td>
                <td>${competitors}</td>
              </tr>`;
          }
          
          // Market focus
          if (data.includes("Market Focus")) {
            const marketMatch = data.match(/Market Focus:([^\n]+)/);
            const market = marketMatch ? marketMatch[1].trim() : "Unknown market focus";
            html += `
              <tr>
                <td>Target Market</td>
                <td>${market}</td>
              </tr>`;
          }
          
          html += `</table>`;
          
          // External Resources section for non-public entities
          html += `
            <div class="section-header">External Resources</div>
            <table>
              <tr>
                <th>Platform</th>
                <th>Link</th>
              </tr>`;
              
          // Add Reddit link if mentioned
          if (data.includes("Reddit") || data.includes("r/")) {
            const redditMatch = data.match(/r\/([a-zA-Z0-9]+)/);
            const subreddit = redditMatch ? redditMatch[1] : entityName.toLowerCase().replace(/[^a-z0-9]/g, '');
            html += `
              <tr>
                <td>Reddit</td>
                <td><a href="https://www.reddit.com/search/?q=${entityName}" target="_blank">Reddit discussions</a></td>
              </tr>`;
          }
          
          // Add Twitter/X link
          html += `
            <tr>
              <td>Twitter/X</td>
              <td><a href="https://twitter.com/search?q=${encodeURIComponent(entityName)}" target="_blank">Twitter mentions</a></td>
            </tr>`;
            
          // Add Quora link
          html += `
            <tr>
              <td>Quora</td>
              <td><a href="https://www.quora.com/search?q=${encodeURIComponent(entityName)}" target="_blank">Quora questions</a></td>
            </tr>`;
            
          html += `
            <tr>
              <td>Official Website</td>
              <td><a href="${url}" target="_blank">${url}</a></td>
            </tr>
          </table>`;
        }
        
        return html;
      } catch (error) {
        console.error("Error formatting research results:", error);
        // If there's an error in formatting, return the original data wrapped in pre tags
        return `<pre>${data}</pre>`;
      }
    }
    
    // Function to perform research on a URL
    function performResearch(url) {
      // If URL is not valid, don't proceed
      if (!url || url === 'unknown' || url === 'Waiting for URL...') {
        console.log("Invalid URL, not performing research:", url);
        updateResearchStatus('error', 'No valid URL to analyze');
        return;
      }
      
      // If this is the same URL we last analyzed, don't re-analyze
      if (url === lastAnalyzedUrl) {
        console.log("Already analyzed this URL, not re-analyzing:", url);
        return;
      }
      
      // Update latest analyzed URL
      lastAnalyzedUrl = url;
      
      // Update UI to show research in progress
      currentUrlElement.textContent = url;
      updateResearchStatus('in-progress', 'Analyzing page and researching...');
      
      // Check if we've already analyzed this URL
      if (analyzedUrls[url]) {
        console.log("Using cached results for:", url);
        researchResultsElement.innerHTML = formatResearchResults(analyzedUrls[url], url);
        updateResearchStatus('complete', 'Analysis complete (from cache)');
        return;
      }
      
      // Make request to our local analysis server
      fetch('http://localhost:5000/stock-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url
        })
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Research response:', data);
        
        // Extract and display the answer
        let answer = data.analysis || 'No analysis provided';
        
        // Save to cache
        analyzedUrls[url] = answer;
        
        // Save cache to local storage for persistence
        chrome.storage.local.set({ 'analyzedUrlsCache': analyzedUrls });
        
        // Update UI with result
        researchResultsElement.innerHTML = formatResearchResults(answer, url);
        updateResearchStatus('complete', 'Analysis complete');
      })
      .catch(error => {
        console.error('Research request error:', error);
        
        // Fallback to mock response
        console.log("Using mock response since server is unavailable");
        
        // Generate a domain-specific mock response
        let mockResponse = "";
        const domain = new URL(url).hostname;
        
        if (domain.includes("nvidia")) {
          mockResponse = `## Company Analysis\n\nThe website ${url} is related to NVIDIA Corporation, which is publicly traded.\n\nStock Ticker Symbol: NVDA\nExchange: NASDAQ\n\n### Recent SEC Filings\n- 10-K: Filed on February 22, 2023\n- 10-Q: Filed on November 22, 2022\n- 8-K: Various filings throughout the year\n- Forms 3-4-5: Insider transactions\n- Schedule 13D: Ownership changes\n\n### Financial Information\n- Revenue: Significant growth in gaming and datacenter segments\n- Net Income: Substantial increases\n- Market Capitalization: One of the largest tech companies`;
        } else if (domain.includes("apple")) {
          mockResponse = `## Company Analysis\n\nThe website ${url} is related to Apple Inc., which is publicly traded.\n\nStock Ticker Symbol: AAPL\nExchange: NASDAQ\n\n### Recent SEC Filings\n- 10-K: Filed on October 28, 2022\n- 10-Q: Filed on February 3, 2023\n- 8-K: Various filings throughout the year\n- Forms 3-4-5: Insider transactions\n- Schedule 13D: Ownership changes\n\n### Financial Information\n- Revenue: Strong iPhone and Services revenue\n- Net Income: Consistent profitability\n- Market Capitalization: Among the world's most valuable companies`;
        } else if (domain.includes("microsoft")) {
          mockResponse = `## Company Analysis\n\nThe website ${url} is related to Microsoft Corporation, which is publicly traded.\n\nStock Ticker Symbol: MSFT\nExchange: NASDAQ\n\n### Recent SEC Filings\n- 10-K: Filed on July 28, 2022\n- 10-Q: Filed on January 24, 2023\n- 8-K: Various filings throughout the year\n- Forms 3-4-5: Insider transactions\n- Schedule 13D: Ownership changes\n\n### Financial Information\n- Revenue: Strong cloud growth via Azure\n- Net Income: Significant and growing\n- Market Capitalization: Among the world's most valuable companies`;
        } else {
          mockResponse = `## Website Analysis\n\nAfter analyzing the URL ${url}, I could not determine if it's associated with a publicly traded company.\n\n### Technical Overview\n- This appears to be a general website\n- No stock ticker symbol identified\n- The content seems to be technical/informational in nature\n\n### Resources\nFor stock information, please check financial databases like Yahoo Finance or the SEC EDGAR database.`;
        }
        
        // Save to cache
        analyzedUrls[url] = mockResponse;
        
        // Save cache to local storage for persistence
        chrome.storage.local.set({ 'analyzedUrlsCache': analyzedUrls });
        
        // Update UI with mock result
        researchResultsElement.innerHTML = formatResearchResults(mockResponse, url);
        updateResearchStatus('complete', 'Analysis complete (mock data)');
      });
    }
    
    // Load the URL cache from storage
    chrome.storage.local.get('analyzedUrlsCache', (data) => {
      if (data.analyzedUrlsCache) {
        analyzedUrls = data.analyzedUrlsCache;
        console.log("Loaded URL cache with", Object.keys(analyzedUrls).length, "entries");
      }
    });
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'analyzeUrl') {
        if (message.url) {
          performResearch(message.url);
        }
        if (sendResponse) sendResponse({received: true});
        return true;
      } else if (message.action === 'updateContent') {
        // Handle content updates from the monitor tab
        if (message.data && message.data.url) {
          currentUrlElement.textContent = message.data.url;
          // Automatically perform research when URL changes
          performResearch(message.data.url);
        }
        if (sendResponse) sendResponse({received: true});
        return true;
      }
      
      return true;
    });
    
    // Immediately request current URL when page loads
    chrome.runtime.sendMessage({ action: 'getLatestContent' }, (response) => {
      if (response && response.url) {
        currentUrlElement.textContent = response.url;
        // Start analysis immediately for the current URL
        performResearch(response.url);
      } else {
        currentUrlElement.textContent = "No URL available";
        updateResearchStatus('waiting', 'Waiting for a valid URL to analyze');
      }
    });
    
    console.log("Insights page initialized");
  });