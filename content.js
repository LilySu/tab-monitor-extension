// Content script that runs in the context of web pages
console.log("Content script loaded for: " + window.location.href);

// Function to extract text content from the page
function extractPageContent() {
  const textContent = document.body ? document.body.innerText : '';
  const limitedText = textContent.substring(0, 30) + (textContent.length > 30 ? '...' : '');
  
  return {
    url: window.location.href,
    title: document.title,
    text: limitedText,
    fullText: textContent.substring(0, 1000) // Limit to 1000 chars for performance
  };
}

// Send the content to the background script
function sendContentToBackground() {
  const content = extractPageContent();
  chrome.runtime.sendMessage({
    action: 'pageContent',
    data: content
  });
}

// Wait for page to load completely before extracting content
window.addEventListener('load', () => {
  setTimeout(sendContentToBackground, 500); // Small delay to ensure DOM is fully ready
});

// Also send content when page updates significantly
let lastContent = '';
setInterval(() => {
  const currentContent = document.body ? document.body.innerText.substring(0, 1000) : '';
  if (currentContent !== lastContent) {
    lastContent = currentContent;
    sendContentToBackground();
  }
}, 3000);

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getContent') {
    sendResponse(extractPageContent());
  }
  return true;
});