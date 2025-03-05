// JavaScript for the monitor.html page
document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const lastUpdateElement = document.getElementById('lastUpdate');
    const activeUrlElement = document.getElementById('activeUrl');
    const textPreviewElement = document.getElementById('textPreview');
    const fullTextElement = document.getElementById('fullText');
    const refreshButton = document.getElementById('refreshButton');
    
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
      activeUrlElement.textContent = content.url || 'Unknown URL';
      textPreviewElement.textContent = content.text || 'No text available';
      
      if (content.fullText) {
        fullTextElement.textContent = content.fullText;
      } else {
        fullTextElement.textContent = 'Full text not available.';
      }
      
      lastUpdateElement.textContent = formatTime(content.timestamp || Date.now());
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
    
    // Manual refresh button
    refreshButton.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'getLatestContent' }, (response) => {
        if (response) {
          updateContent(response);
        }
      });
    });
    
    console.log('Monitor page initialized');
  });