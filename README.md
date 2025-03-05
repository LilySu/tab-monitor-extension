# Tab Monitor Chrome Extension

This Chrome extension checks if a listening window has already been opened. If not, it opens a new window and continuously monitors the active tab that the user is on, logging both the website URL and extracting text from the active window.

## Features

- Checks if a listening window has already been opened
- Opens a new window if no listening window exists
- Continuously monitors the active tab
- Extracts and logs text content from the active webpage
- Provides a popup interface to see monitoring status and current content

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the directory containing the extension files
5. The extension should now be installed and active

## Project Structure

- `manifest.json`: Configuration file for the Chrome extension
- `background.js`: Background script that handles window detection and tab monitoring
- `content.js`: Content script that extracts text from webpages
- `popup.html`: HTML for the extension popup
- `popup.js`: JavaScript for the extension popup
- `images/`: Directory containing icon images (you need to add these)

## How It Works

1. When the extension starts, it checks if it has already opened a listening window
2. If no listening window is found, it opens a new window
3. The extension monitors the active tab across all windows
4. When the user switches tabs or the page content changes, the extension logs:
   - The URL of the active tab
   - Text content extracted from the active page
5. All monitoring data is logged to the console for validation
6. The popup interface shows the current status and content

## Adding Icons

You'll need to add icon images in the `images/` directory:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

You can create simple placeholder icons or use any appropriate images.

## Testing the Extension

1. Install the extension as described above
2. The extension should automatically check if a listening window exists
3. If no listening window exists, it will open a new window
4. Navigate between different tabs and websites to see the monitoring in action
5. Open the browser console (F12 or Ctrl+Shift+J) to see the logged URLs and content
6. Use the popup to verify monitoring status and see current content

## Notes

- For demonstration purposes, the text extraction is limited to the first 1000 characters
- The extension uses Chrome's storage API to remember if a listening window has been opened
- If the listening window is closed, the extension will detect this and open a new one when reactivated# tab-monitor-extension
