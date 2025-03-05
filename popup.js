// Popup script to display session status and active tab info

// Get DOM elements
const sessionStatusElement = document.getElementById('sessionStatus');
const currentUrlElement = document.getElementById('currentUrl');
const pageTextElement = document.getElementById('pageText');

// Check listening window status
function checkListeningWindowStatus() {
  chrome.storage.local.get('listeningWindowId', (data) => {
    if (data.listeningWindowId) {
      chrome.windows.get(parseInt(data.listeningWindowId), (window) => {
        if (chrome.runtime.lastError) {
          sessionStatusElement.textContent = 'No listening window is currently active';
          sessionStatusElement.className = 'status passive';
        } else {
          sessionStatusElement.textContent = `Listening window is active (Window ID: ${data.listeningWindowId})`;
          sessionStatusElement.className = 'status active';
        }
      });
    } else {
      sessionStatusElement.textContent = 'No listening window has been created';
      sessionStatusElement.className = 'status passive';
    }
  });
}

// Get current tab info
function getCurrentTabInfo() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      const currentTab = tabs[0];
      currentUrlElement.textContent = currentTab.url || 'No URL available';
      
      // Only try to get content from http/https pages
      if (currentTab.url && (currentTab.url.startsWith('http://') || currentTab.url.startsWith('https://'))) {
        try {
          // Try using content script to get page text
          chrome.tabs.sendMessage(currentTab.id, { action: 'getContent' }, (response) => {
            if (chrome.runtime.lastError) {
              pageTextElement.textContent = 'Cannot access content on this page.';
              return;
            }
            
            if (response && response.text) {
              pageTextElement.textContent = response.text;
            } else {
              pageTextElement.textContent = 'No content available.';
            }
          });
        } catch (error) {
          pageTextElement.textContent = 'Error accessing page content: ' + error.message;
        }
      } else {
        pageTextElement.textContent = 'Cannot access content on this type of page.';
      }
    } else {
      currentUrlElement.textContent = 'No active tab found';
      pageTextElement.textContent = 'No content available.';
    }
  });
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  checkListeningWindowStatus();
  getCurrentTabInfo();
  
  // Refresh status periodically
  setInterval(checkListeningWindowStatus, 2000);
});