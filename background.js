// Track whether we've already opened a listening window
let listeningWindowId = null;
let monitorTabId = null;
let analysisTabId = null;
let insightsTabId = null;

// Track whether the extension is active or paused
let extensionActive = true;

console.log("Background script loaded");

// Check if the listening window exists and is still open
function checkForListeningWindow() {
  return new Promise((resolve) => {
    if (!listeningWindowId) {
      // No window has been created yet
      resolve(false);
      return;
    }

    // Check if the window with this ID still exists
    chrome.windows.get(listeningWindowId, (window) => {
      if (chrome.runtime.lastError) {
        // Window doesn't exist anymore
        listeningWindowId = null;
        monitorTabId = null;
        analysisTabId = null;
        insightsTabId = null;
        resolve(false);
      } else {
        // Window still exists
        resolve(true);
      }
    });
  });
}

// Create a new listening window with our custom HTML tabs
function createListeningWindow() {
  // Create a new window with a blank page
  chrome.windows.create({ 
    focused: true,
    width: 900,
    height: 700
  }, (window) => {
    listeningWindowId = window.id;
    console.log("Created new listening window with ID:", listeningWindowId);
    
    // Create the first tab with our monitor page
    chrome.tabs.create({ 
      windowId: window.id, 
      url: 'monitor.html',
      active: true 
    }, (tab) => {
      monitorTabId = tab.id;
      console.log("Created monitor tab with ID:", monitorTabId);
      
      // Create the second tab with our analysis page
      chrome.tabs.create({ 
        windowId: window.id, 
        url: 'analysis.html',
        active: false 
      }, (tab) => {
        analysisTabId = tab.id;
        console.log("Created analysis tab with ID:", analysisTabId);

        // Create the third tab with our insights page
        chrome.tabs.create({ 
          windowId: window.id, 
          url: 'insights.html',
          active: false 
        }, (tab) => {
          insightsTabId = tab.id;
          console.log("Created insights tab with ID:", insightsTabId);
          
          // Wait a moment for the tab to load, then send the current URL
          setTimeout(() => {
            if (latestContent && latestContent.url) {
              chrome.tabs.sendMessage(insightsTabId, {
                action: 'analyzeUrl',
                url: latestContent.url
              }).catch(err => {
                console.log("Error sending initial URL to insights tab:", err);
              });
            }
          }, 2000);
        });
      });
    });
    
    // Store the window ID in local storage for persistence across browser sessions
    chrome.storage.local.set({ 
      'listeningWindowId': window.id,
      'extensionActive': true
    });
  });
}

// This function will be injected into the page to extract text
function getPageContentScript() {
  const text = document.body ? document.body.innerText : '';
  const preview = text.substring(0, 30) + (text.length > 30 ? '...' : '');
  
  // Get meta description if available
  let metaDescription = '';
  const metaDescTag = document.querySelector('meta[name="description"]');
  if (metaDescTag) {
    metaDescription = metaDescTag.getAttribute('content') || '';
  }
  
  // Get main heading if available
  let mainHeading = '';
  const h1 = document.querySelector('h1');
  if (h1) {
    mainHeading = h1.innerText || '';
  }
  
  return {
    url: window.location.href,
    title: document.title,
    text: preview,
    fullText: text.substring(0, 1000), // Limit to 1000 chars for performance
    metaDescription: metaDescription,
    mainHeading: mainHeading
  };
}

// Store for the latest active tab content
let latestContent = {
  url: "",
  text: "Waiting for content...",
  timestamp: Date.now(),
  screenshot: null
};

// Function to capture a screenshot of the active tab
function captureScreenshot() {
  // Skip if extension is paused
  if (!extensionActive) return;
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      const activeTab = tabs[0];
      
      // Skip monitoring our own tabs
      if (activeTab.id === monitorTabId || activeTab.id === analysisTabId || activeTab.id === insightsTabId) return;
      
      chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.error("Screenshot error:", chrome.runtime.lastError);
          return;
        }
        
        // Update the latest content with the screenshot
        latestContent.screenshot = dataUrl;
        latestContent.timestamp = Date.now();
        
        // Send the updated content to the monitor tab
        updateMonitorTab(latestContent);
        
        // Send screenshot to analysis
        sendScreenshotToAnalysis(dataUrl);
      });
    }
  });
}

// Update the monitoring tab with new content
function updateMonitorTab(content) {
  if (!monitorTabId) return;
  
  // Update our stored content object
  if (content.url) latestContent.url = content.url;
  if (content.text) latestContent.text = content.text;
  if (content.fullText) latestContent.fullText = content.fullText;
  if (content.title) latestContent.title = content.title;
  if (content.metaDescription) latestContent.metaDescription = content.metaDescription;
  if (content.mainHeading) latestContent.mainHeading = content.mainHeading;
  if (content.screenshot) latestContent.screenshot = content.screenshot;
  latestContent.timestamp = Date.now();
  
  // Send message to the monitor tab
  chrome.tabs.sendMessage(monitorTabId, {
    action: 'updateContent',
    data: latestContent
  }).catch(err => {
    console.log("Error sending to monitor tab:", err);
  });
}

// Function to force refresh data and capture new screenshot
function forceRefresh() {
  console.log("Force refresh requested");
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      const currentTab = tabs[0];
      
      // Skip our monitor tabs
      if (currentTab.id === monitorTabId || currentTab.id === analysisTabId || currentTab.id === insightsTabId) {
        console.log("Can't refresh from our own tabs");
        return;
      }
      
      console.log("Forcing refresh for tab:", currentTab.url);
      
      // Only execute script on http/https pages
      if (currentTab.url && (currentTab.url.startsWith('http://') || currentTab.url.startsWith('https://'))) {
        // Execute content script to get page text
        chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          function: getPageContentScript
        }).then(results => {
          if (results && results[0]) {
            console.log("Refreshed content:", results[0].result.text);
            updateMonitorTab(results[0].result);
            // Also capture a fresh screenshot
            captureScreenshot();
          }
        }).catch(err => {
          console.error("Error executing script:", err);
        });
      } else {
        // For non-http pages, just show the URL
        updateMonitorTab({
          url: currentTab.url || "unknown",
          title: currentTab.title || "unknown",
          text: "Cannot access content on this page type",
          fullText: "Cannot access content on this page type"
        });
        captureScreenshot();
      }
    }
  });
  
  return true;
}

// Trigger Insights analysis for the current URL
function triggerInsightsAnalysis() {
  console.log("Triggering insights analysis for current URL");
  
  // If we have content and the Insights tab exists
  if (latestContent && insightsTabId) {
    // Send the URL to the Insights tab
    chrome.tabs.sendMessage(insightsTabId, {
      action: 'analyzeUrl',
      url: latestContent.url
    }).catch(err => {
      console.log("Error sending URL to insights tab:", err);
    });
    
    // Activate the Insights tab
    chrome.tabs.update(insightsTabId, { active: true });
  }
}

// Function to toggle extension activity
function toggleExtensionActive() {
  extensionActive = !extensionActive;
  chrome.storage.local.set({ 'extensionActive': extensionActive });
  
  // Update the browser action icon to reflect the state
  updateExtensionIcon();
  
  return extensionActive;
}

// Function to update the extension icon based on active state
function updateExtensionIcon() {
  const iconPath = extensionActive ? 
    { 
      16: "images/icon16.png",
      48: "images/icon48.png",
      128: "images/icon128.png"
    } : 
    {
      16: "images/icon16-disabled.png",
      48: "images/icon48-disabled.png",
      128: "images/icon128-disabled.png"
    };
  
  chrome.action.setIcon({ path: iconPath });
}

// Monitor tab changes to print URL and content
function monitorActiveTabs() {
  // Listen for tab activation
  chrome.tabs.onActivated.addListener((activeInfo) => {
    // Skip if extension is paused
    if (!extensionActive) return;
    
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      if (chrome.runtime.lastError) {
        console.error("Error getting tab info:", chrome.runtime.lastError);
        return;
      }
      
      // Skip the monitor tabs themselves
      if (tab.id === monitorTabId || tab.id === analysisTabId || tab.id === insightsTabId) return;
      
      console.log("Active tab changed:", tab.url);
      
      // Only execute script on http/https pages
      if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
        // Execute content script to get page text
        chrome.scripting.executeScript({
          target: { tabId: activeInfo.tabId },
          function: getPageContentScript
        }).then(results => {
          if (results && results[0]) {
            console.log("Active Window Content:", results[0].result.text);
            updateMonitorTab(results[0].result);
            captureScreenshot();
          }
        }).catch(err => {
          console.error("Error executing script:", err);
        });
      } else {
        // For non-http pages, just show the URL
        updateMonitorTab({
          url: tab.url || "unknown",
          title: tab.title || "unknown",
          text: "Cannot access content on this page type",
          fullText: "Cannot access content on this page type"
        });
        captureScreenshot();
      }
    });
  });
  
  // Also listen for tab URL changes
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Skip if extension is paused
    if (!extensionActive) return;
    
    if (changeInfo.status === 'complete') {
      // Skip our monitor tabs
      if (tabId === monitorTabId || tabId === analysisTabId || tabId === insightsTabId) return;
      
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id === tabId) {
          console.log("Active tab updated:", tab.url);
          
          // Only execute script on http/https pages
          if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
            // Execute content script to get page text
            chrome.scripting.executeScript({
              target: { tabId },
              function: getPageContentScript
            }).then(results => {
              if (results && results[0]) {
                console.log("Active Window Content:", results[0].result.text);
                updateMonitorTab(results[0].result);
                captureScreenshot();
              }
            }).catch(err => {
              console.error("Error executing script:", err);
            });
          } else {
            // For non-http pages, just show the URL
            updateMonitorTab({
              url: tab.url || "unknown",
              title: tab.title || "unknown",
              text: "Cannot access content on this page type",
              fullText: "Cannot access content on this page type"
            });
            captureScreenshot();
          }
        }
      });
    }
  });
  
  // Set up periodic polling for content changes every 3 seconds
  setInterval(() => {
    // Skip if extension is paused
    if (!extensionActive) return;
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        const currentTab = tabs[0];
        
        // Skip our monitor tabs
        if (currentTab.id === monitorTabId || currentTab.id === analysisTabId || currentTab.id === insightsTabId) return;
        
        // Only execute script on http/https pages
        if (currentTab.url && (currentTab.url.startsWith('http://') || currentTab.url.startsWith('https://'))) {
          // Execute content script to get page text
          chrome.scripting.executeScript({
            target: { tabId: currentTab.id },
            function: getPageContentScript
          }).then(results => {
            if (results && results[0]) {
              console.log("Active Window Content (3s update):", results[0].result.text);
              updateMonitorTab(results[0].result);
            }
          }).catch(err => {
            console.error("Error executing script:", err);
          });
        }
      }
    });
  }, 3000);
  
  // Set up screenshot capture every 10 seconds
  setInterval(() => {
    // Skip if extension is paused
    if (!extensionActive) return;
    captureScreenshot();
  }, 10000);
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'pageContent') {
    console.log("Content from page:", message.data.url);
    console.log("Text sample:", message.data.text);
  } else if (message.action === 'getLatestContent') {
    sendResponse(latestContent);
    return true;
  } else if (message.action === 'forceRefresh') {
    const result = forceRefresh();
    sendResponse({ success: result });
    return true;
  } else if (message.action === 'generateInsights') {
    triggerInsightsAnalysis();
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'toggleExtension') {
    const isActive = toggleExtensionActive();
    sendResponse({ active: isActive });
    return true;
  } else if (message.action === 'getExtensionStatus') {
    sendResponse({ active: extensionActive });
    return true;
  }
});

// Listen for browser action clicks (toolbar icon)
chrome.action.onClicked.addListener((tab) => {
  // Check if window exists first
  checkForListeningWindow().then((exists) => {
    if (!exists) {
      // Create new window if none exists
      createListeningWindow();
    } else {
      // If window exists, focus it
      chrome.windows.update(listeningWindowId, { focused: true });
    }
  });
});

// Initialize the extension
function init() {
  console.log("Initializing extension");
  
  // Check if we previously created a window and get extension active state
  chrome.storage.local.get(['listeningWindowId', 'extensionActive'], async (data) => {
    if (data.listeningWindowId) {
      listeningWindowId = data.listeningWindowId;
      console.log("Retrieved stored window ID:", listeningWindowId);
    }
    
    // Set extension active state
    if (data.extensionActive !== undefined) {
      extensionActive = data.extensionActive;
    }
    
    // Update icon based on active state
    updateExtensionIcon();
    
    // Check if the listening window is already open
    const windowExists = await checkForListeningWindow();
    
    if (!windowExists) {
      // No listening window, create one
      console.log("No listening window exists, creating one");
      createListeningWindow();
    } else {
      console.log("Listening window already exists with ID:", listeningWindowId);
    }
    
    // Start monitoring active tabs regardless
    monitorActiveTabs();
  });
}

// Start extension
init();

// Handle window close events
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === listeningWindowId) {
    console.log("Listening window was closed");
    listeningWindowId = null;
    monitorTabId = null;
    analysisTabId = null;
    insightsTabId = null;
    chrome.storage.local.remove('listeningWindowId');
  }
});

// Function to send screenshot to analysis server
function sendScreenshotToAnalysis(screenshotData) {
  console.log("Sending screenshot to analysis server...");
  
  // First update the analysis tab to show "Analysis in Progress"
  if (analysisTabId) {
    chrome.tabs.sendMessage(analysisTabId, {
      action: 'updateAnalysisStatus',
      status: 'in-progress',
      message: 'Analysis in progress...'
    }, response => {
      if (chrome.runtime.lastError) {
        console.error("Error updating analysis status:", chrome.runtime.lastError);
      } else {
        console.log("Analysis status update sent successfully");
      }
    });
  }
  
  // Send the screenshot to our Python server
  fetch('http://localhost:5000/analyze-screenshot', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      screenshot: screenshotData
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('Image analysis received (full response):', JSON.stringify(data));
    
    // Send the analysis results to the analysis tab
    if (analysisTabId) {
      console.log("About to send analysis result to tab:", analysisTabId);
      chrome.tabs.sendMessage(analysisTabId, {
        action: 'updateAnalysisResult',
        status: 'complete',
        result: data.analysis || "No analysis provided"
      });
    }
  })
  .catch(error => {
    console.error('Error analyzing screenshot:', error);
    
    // Update analysis tab with the error
    if (analysisTabId) {
      chrome.tabs.sendMessage(analysisTabId, {
        action: 'updateAnalysisStatus',
        status: 'error',
        message: 'Error analyzing image: ' + error.message
      });
    }
  });
}

// Create a context menu option to generate insights
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "generate-insights",
    title: "Generate Insights About This Page",
    contexts: ["page", "selection", "link"]
  });
  
  chrome.contextMenus.create({
    id: "generate-insights",
    title: "Analyze this URL for Stock Info & Research",
    contexts: ["page", "link"]
  });
});

// Listen for context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "generate-insights") {
    // Always analyze the current URL regardless of text selection
    triggerInsightsAnalysis();
  } else if (info.menuItemId === "toggle-extension") {
    toggleExtensionActive();
  }
});