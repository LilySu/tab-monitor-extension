// JavaScript for the analysis.html page
document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const startTimeElement = document.getElementById('startTime');
    
    // Set the start time
    const startTime = new Date();
    startTimeElement.textContent = formatTime(startTime);
    
    // Update the start time every minute to show elapsed time
    setInterval(function() {
      const elapsedSeconds = Math.floor((new Date() - startTime) / 1000);
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = elapsedSeconds % 60;
      startTimeElement.textContent = `${formatTime(startTime)} (${minutes}m ${seconds}s ago)`;
    }, 5000);
    
    // Function to format time
    function formatTime(date) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const seconds = date.getSeconds().toString().padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    }
  
    console.log('Analysis page initialized');
  });