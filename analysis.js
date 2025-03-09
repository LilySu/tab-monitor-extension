// JavaScript for the analysis.html page
document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const startTimeElement = document.getElementById('startTime');
    
    // Set the start time
    const startTime = new Date();
    if (startTimeElement) {
      startTimeElement.textContent = formatTime(startTime);
      
      // Update the start time every 5 seconds to show elapsed time
      setInterval(function() {
        const elapsedSeconds = Math.floor((new Date() - startTime) / 1000);
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        startTimeElement.textContent = `${formatTime(startTime)} (${minutes}m ${seconds}s ago)`;
      }, 5000);
    }
    
    // Function to format time
    function formatTime(date) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const seconds = date.getSeconds().toString().padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    }
  
    console.log('Analysis page initialized');
    
    // Get DOM elements
    const analysisStatusElement = document.getElementById('analysisStatus');
    const analysisResultElement = document.getElementById('analysisResult');
    const progressElement = document.getElementById('analysisProgress');
    
    // Initialize the UI
    updateAnalysisStatus('waiting', 'Waiting for screenshot...');
    
    // Function to update the analysis status
    function updateAnalysisStatus(status, message) {
      console.log("Analysis status updated:", status, message);
      
      if (analysisStatusElement) {
        analysisStatusElement.textContent = message;
        analysisStatusElement.className = 'status ' + status;
      }
      
      // Show/hide progress element
      if (progressElement) {
        progressElement.style.display = status === 'in-progress' ? 'block' : 'none';
      }
      
      // Show/hide result element
      if (analysisResultElement) {
        analysisResultElement.style.display = status === 'complete' ? 'block' : 'none';
      }
      
      // Handle the please-wait message
      const pleaseWaitElements = document.querySelectorAll('.please-wait-message');
      if (status === 'complete') {
        pleaseWaitElements.forEach(element => {
          element.style.display = 'none';
        });
      } else {
        pleaseWaitElements.forEach(element => {
          element.style.display = 'block';
        });
      }
    }
    
    // Function to update the analysis result
    function updateAnalysisResult(result) {
      console.log("Received analysis result:", result);
      
      if (analysisResultElement) {
        analysisResultElement.textContent = result;
        analysisResultElement.style.display = 'block';
      }
    }
    
    // Listen for messages from the background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log("Analysis page received message:", message);
      
      if (message.action === 'updateAnalysisStatus') {
        updateAnalysisStatus(message.status, message.message);
        if (sendResponse) sendResponse({received: true});
        return true;
      } 
      else if (message.action === 'updateAnalysisResult') {
        updateAnalysisStatus('complete', 'Analysis complete');
        updateAnalysisResult(message.result);
        if (sendResponse) sendResponse({received: true});
        return true;
      }
      
      return true;
    });
  });