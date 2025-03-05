// Track whether we've already opened a listening window
let listeningWindowId = null;
let listeningTabId = null;

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
        listeningTabId = null;
        resolve(false);
      } else {
        // Window still exists
        resolve(true);
      }
    });
  });
}

// Create a new listening window with our custom HTML
function createListeningWindow() {
  // Create a new window with a blank page
  chrome.windows.create({ 
    focused: true,
    width: 800,
    height: 600
  }, (window) => {
    listeningWindowId = window.id;
    console.log("Created new listening window with ID:", listeningWindowId);
    
    // Create a new tab with our monitor page
    chrome.tabs.create({ 
      windowId: window.id, 
      url: 'monitor.html',
      active: true 
    }, (tab) => {
      listeningTabId = tab.id;
      console.log("Created monitor tab with ID:", listeningTabId);
    });
    
    // Store the window ID in local storage for persistence across browser sessions
    chrome.storage.local.set({ 
      'listeningWindowId': window.id
    });
  });
}

// This function will be injected into the page to extract text
function getPageContentScript() {
  const text = document.body ? document.body.innerText : '';
  const preview = text.substring(0, 30) + (text.length > 30 ? '...' : '');
  
  return {
    url: window.location.href,
    title: document.title,
    text: preview,
    fullText: text.substring(0, 1000) // Limit to 1000 chars for performance
  };
}

// Store for the latest active tab content
let latestContent = {
  url: "",
  text: "Waiting for content...",
  timestamp: Date.now()
};

// Update the monitoring tab with new content
function updateMonitorTab(content) {
  if (!listeningTabId) return;
  
  latestContent = {
    url: content.url,
    text: content.text,
    fullText: content.fullText,
    timestamp: Date.now()
  };
  
  // Send message to the monitor tab
  chrome.tabs.sendMessage(listeningTabId, {
    action: 'updateContent',
    data: latestContent
  }).catch(err => {
    console.log("Error sending to monitor tab:", err);
  });
}

// Monitor tab changes to print URL and content
function monitorActiveTabs() {
  // Listen for tab activation
  chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      if (chrome.runtime.lastError) {
        console.error("Error getting tab info:", chrome.runtime.lastError);
        return;
      }
      
      // Skip the monitor tab itself
      if (tab.id === listeningTabId) return;
      
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
          }
        }).catch(err => {
          console.error("Error executing script:", err);
        });
      } else {
        // For non-http pages, just show the URL
        updateMonitorTab({
          url: tab.url || "unknown",
          text: "Cannot access content on this page type",
          fullText: "Cannot access content on this page type"
        });
      }
    });
  });
  
  // Also listen for tab URL changes
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      // Skip our monitor tab
      if (tabId === listeningTabId) return;
      
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
              }
            }).catch(err => {
              console.error("Error executing script:", err);
            });
          } else {
            // For non-http pages, just show the URL
            updateMonitorTab({
              url: tab.url || "unknown",
              text: "Cannot access content on this page type",
              fullText: "Cannot access content on this page type"
            });
          }
        }
      });
    }
  });
  
  // Set up periodic polling for content changes every 3 seconds
  setInterval(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        const currentTab = tabs[0];
        
        // Skip our monitor tab
        if (currentTab.id === listeningTabId) return;
        
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
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'pageContent') {
    console.log("Content from page:", message.data.url);
    console.log("Text sample:", message.data.text);
  } else if (message.action === 'getLatestContent') {
    sendResponse(latestContent);
    return true;
  }
});

// Initialize the extension
function init() {
  console.log("Initializing extension");
  
  // Check if we previously created a window
  chrome.storage.local.get('listeningWindowId', async (data) => {
    if (data.listeningWindowId) {
      listeningWindowId = data.listeningWindowId;
      console.log("Retrieved stored window ID:", listeningWindowId);
    }
    
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
    listeningTabId = null;
    chrome.storage.local.remove('listeningWindowId');
  }
});