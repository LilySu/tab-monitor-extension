// JavaScript for the monitor.html page
document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements
  const activeUrlElement = document.getElementById('activeUrl');
  const pageTitleElement = document.getElementById('pageTitle');
  const textPreviewElement = document.getElementById('textPreview');
  const fullTextElement = document.getElementById('fullText');
  const screenshotImage = document.getElementById('screenshotImage');
  const screenshotTimeElement = document.getElementById('screenshotTime');
  const refreshBtn = document.getElementById('refreshBtn');
  
  // Store the last screenshot URL to detect changes
  let lastScreenshotUrl = '';
  
  // Function to format time
  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }
  
  // Function to update the UI with new content
  function updateContent(content) {
    // Update text content
    activeUrlElement.textContent = content.url || 'Unknown URL';
    pageTitleElement.textContent = content.title || 'No title available';
    textPreviewElement.textContent = content.text || 'No text available';
    
    if (content.fullText) {
      fullTextElement.textContent = content.fullText;
    } else {
      fullTextElement.textContent = 'Full text not available.';
    }
    
    // Update screenshot if available
    if (content.screenshot) {
      // Check if screenshot has changed
      const screenshotChanged = (lastScreenshotUrl !== content.screenshot);
      
      screenshotImage.src = content.screenshot;
      screenshotImage.alt = "Screenshot of: " + (content.url || "active tab");
      screenshotTimeElement.textContent = formatTime(content.timestamp || Date.now());
      
      // Store the new screenshot URL
      lastScreenshotUrl = content.screenshot;
      
      // Automatically trigger insights when screenshot changes
      if (screenshotChanged) {
        console.log("Screenshot changed, automatically triggering insights");
        triggerInsights();
      }
    }
  }
  
  // Function to trigger insights analysis
  function triggerInsights() {
    chrome.runtime.sendMessage({ action: 'generateInsights' }, (response) => {
      console.log('Generate insights response:', response);
    });
  }
  
  // Add click handler for Refresh button
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'forceRefresh' }, (response) => {
        console.log('Force refresh response:', response);
      });
    });
  }
  
  // Get initial content from background script
  chrome.runtime.sendMessage({ action: 'getLatestContent' }, (response) => {
    if (response) {
      updateContent(response);
    }
  });
  
  // Listen for content updates from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateContent') {
      updateContent(message.data);
    }
    return true;
  });
  
  console.log('Monitor page initialized');
});