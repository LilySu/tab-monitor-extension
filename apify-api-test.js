/**
 * Apify API Test Script - Updated for Website Content Crawler
 * 
 * This script tests various Apify API endpoints to verify
 * your access to the Website Content Crawler.
 * 
 * Usage:
 * 1. Replace YOUR_APIFY_API_KEY with your actual API key
 * 2. Run with Node.js: node apify-api-test.js
 */

// Import node-fetch
const fetch = require('node-fetch');

// Replace this with your actual Apify API key
const APIFY_API_KEY = "apify_api_ld5cYw7dS6swtedulnL8ylPzm1i7FB2DpRd8";

// Test endpoints
const testEndpoints = [
  {
    name: "User Info",
    url: "https://api.apify.com/v2/user/info",
    method: "GET"
  },
  {
    name: "Website Content Crawler - Actor Info",
    url: "https://api.apify.com/v2/acts/apify~website-content-crawler",
    method: "GET"
  },
  {
    name: "Website Content Crawler - Run",
    url: "https://api.apify.com/v2/acts/apify~website-content-crawler/runs",
    method: "POST",
    body: {
      startUrls: [{ url: "https://example.com" }],
      maxCrawlPages: 1
    }
  },
  {
    name: "Website Content Crawler - Run Sync",
    url: "https://api.apify.com/v2/acts/apify~website-content-crawler/run-sync",
    method: "POST",
    body: {
      startUrls: [{ url: "https://example.com" }],
      maxCrawlPages: 1
    }
  },
  {
    name: "Website Content Crawler - Run Sync Get Dataset Items",
    url: "https://api.apify.com/v2/acts/apify~website-content-crawler/run-sync-get-dataset-items",
    method: "POST",
    body: {
      startUrls: [{ url: "https://example.com" }],
      maxCrawlPages: 1
    }
  }
];

// Function to test an API endpoint
async function testEndpoint(endpoint) {
  console.log(`\nTesting endpoint: ${endpoint.name}`);
  console.log(`URL: ${endpoint.url}`);
  console.log(`Method: ${endpoint.method}`);
  
  try {
    const options = {
      method: endpoint.method,
      headers: {
        'Authorization': `Bearer ${APIFY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (endpoint.body) {
      options.body = JSON.stringify(endpoint.body);
      console.log("Request body:", JSON.stringify(endpoint.body, null, 2));
    }
    
    const response = await fetch(endpoint.url, options);
    const status = response.status;
    let data;
    
    try {
      data = await response.json();
    } catch (e) {
      data = await response.text();
    }
    
    console.log(`Status: ${status}`);
    
    if (response.ok) {
      console.log("✅ SUCCESS: Endpoint is accessible");
      if (typeof data === 'object') {
        console.log("Sample response:", JSON.stringify(data).substring(0, 150) + "...");
      } else {
        console.log("Sample response:", data.substring(0, 150) + "...");
      }
      return { success: true, status, data };
    } else {
      console.log("❌ FAILED: Endpoint returned an error");
      console.log("Error details:", data);
      return { success: false, status, error: data };
    }
  } catch (error) {
    console.log("❌ EXCEPTION: Failed to access endpoint");
    console.log("Error:", error.message);
    return { success: false, error: error.message };
  }
}

// Helper function to partially mask the API key for display
function maskApiKey(key) {
  if (!key || key.length < 8) return key;
  return key.substring(0, 4) + '...' + key.substring(key.length - 4);
}

// Run all tests
async function runAllTests() {
  console.log("----------------------------------------");
  console.log("Apify Website Content Crawler API Test");
  console.log("----------------------------------------");
  console.log(`Testing with API key: ${maskApiKey(APIFY_API_KEY)}`);
  
  let successCount = 0;
  const results = {};
  
  for (const endpoint of testEndpoints) {
    const result = await testEndpoint(endpoint);
    results[endpoint.name] = result;
    if (result.success) successCount++;
  }
  
  console.log("\n----------------------------------------");
  console.log(`Test complete: ${successCount}/${testEndpoints.length} endpoints accessible`);
  console.log("----------------------------------------");
  
  if (successCount === 0) {
    console.log("\n❗ CRITICAL: None of the endpoints are accessible with this API key.");
    console.log("Please check if your API key is correct and your subscription is active.");
  } else if (successCount < testEndpoints.length) {
    console.log("\n⚠️ WARNING: Some endpoints are not accessible.");
    console.log("This might be due to rate limits, permissions, or subscription limitations.");
  } else {
    console.log("\n✅ SUCCESS: All endpoints are accessible!");
    console.log("Your subscription has full access to the Website Content Crawler!");
  }
  
  // Provide specific guidance based on the test results
  if (!results["Website Content Crawler - Run"].success) {
    console.log("\n⚠️ IMPORTANT: The Website Content Crawler run endpoint is not accessible.");
    
    if (results["User Info"].success) {
      console.log("\nRecommendation: Your API key is valid for basic operations but may not have access to run the Website Content Crawler actor.");
      console.log("Check your Apify subscription or consider upgrading your plan.");
    }
  }
  
  return results;
}

// Check if API key is provided
if (!APIFY_API_KEY || APIFY_API_KEY === "YOUR_APIFY_API_KEY") {
  console.error("Please replace YOUR_APIFY_API_KEY with your actual Apify API key!");
  process.exit(1);
}

// Run the tests
runAllTests();