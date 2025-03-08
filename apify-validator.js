/**
 * Apify API Key Validator
 * 
 * This standalone script tests if your Apify API key is valid by making a simple API call.
 * Run this file directly with Node.js to validate your key before using it in the extension.
 * 
 * Usage:
 * 1. Replace YOUR_APIFY_API_KEY with your actual API key
 * 2. Run with Node.js: node apify-validator.js
 */

// Replace this with your actual Apify API key
const APIFY_API_KEY = "YOUR_APIFY_API_KEY";

async function validateApifyApiKey() {
  console.log("Testing Apify API key...");
  console.log("Key being tested:", maskApiKey(APIFY_API_KEY));

  // First check if the key is obviously invalid
  if (!APIFY_API_KEY || APIFY_API_KEY === 'YOUR_APIFY_API_KEY' || APIFY_API_KEY.length < 10) {
    console.error("❌ ERROR: API key is missing or appears to be a placeholder.");
    return false;
  }

  try {
    // Make a simple API call to Apify to check if the key is valid
    const response = await fetch('https://api.apify.com/v2/user/info', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${APIFY_API_KEY}`
      }
    });

    const data = await response.json();

    if (response.ok && data && data.data) {
      console.log("✅ SUCCESS: Apify API key is valid!");
      console.log("Account username:", data.data.username);
      console.log("Account type:", data.data.subscription?.plan?.name || "Unknown");
      return true;
    } else {
      console.error("❌ ERROR: Invalid API key or API request failed.");
      console.error("Response Status:", response.status);
      console.error("Error Details:", data.error || "Unknown error");
      return false;
    }
  } catch (error) {
    console.error("❌ ERROR: Exception while validating Apify API key:");
    console.error(error.message);
    return false;
  }
}

// Helper function to partially mask the API key for display
function maskApiKey(key) {
  if (!key || key.length < 8) return key;
  return key.substring(0, 4) + '...' + key.substring(key.length - 4);
}

// Run the validation
validateApifyApiKey().then(isValid => {
  if (isValid) {
    console.log("\nYou can use this API key in your extension's config.js file.");
  } else {
    console.log("\nPlease check your API key and try again.");
    console.log("You can get your API key from https://console.apify.com/account/integrations");
  }
});