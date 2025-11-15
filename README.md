# Anti-Tabnabbing Chrome Extension

A Manifest V3 Chrome extension that detects and alerts users about potential tabnabbing attacks by monitoring visual changes in tabs when they lose and regain focus.

## Project Structure

```
Anti-Tabnabbing/
├── manifest.json       # Extension configuration (Manifest V3)
├── background.js       # Service worker for tab monitoring
├── content.js          # Content script for page interaction
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic
├── icons/              # Extension icons (to be created)
└── README.md           # This file
```

## Files Overview

### `manifest.json`
- Defines extension metadata and configuration
- Uses Manifest V3 (latest standard)
- Declares minimal required permissions:
  - `tabs`: Monitor tab events
  - `storage`: Store screenshots
  - `activeTab`: Capture screenshots of active tab
  - `host_permissions`: Access all URLs for content script injection

### `background.js`
- Service worker that runs in the background
- Monitors tab activation/deactivation events
- Captures screenshots at regular intervals (every 5 seconds)
- Manages screenshot storage
- Coordinates comparison when user returns to a tab

### `content.js`
- Runs on every webpage
- Handles screenshot comparison requests
- Will implement change highlighting (overlay)
- Communicates with background script

### `popup.html` & `popup.js`
- UI shown when clicking extension icon
- Displays current status
- Shows information about active tab
- Provides manual controls (clear highlights, force check)

## Current Status

✅ **Completed:**
- Basic extension structure
- Manifest V3 configuration
- Tab event monitoring
- Screenshot capture at intervals
- Storage management
- Basic UI popup

⏳ **To Do:**
- Add Resemble.js library for image comparison
- Implement actual screenshot comparison algorithm
- Create change highlighting overlay
- Generate extension icons
- Add color-coded badge for alert levels
- Test with real tabnabbing scenarios

## How to Load the Extension (for testing)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this directory (`Anti-Tabnabbing`)
5. The extension should now appear in your extensions list

## Next Steps

1. **Download Resemble.js** - Add the image comparison library
2. **Implement comparison logic** - Actually compare screenshots
3. **Create highlighting system** - Visual feedback on changed areas
4. **Generate icons** - Create 16x16, 48x48, and 128x128 icons
5. **Test thoroughly** - Try various scenarios

## Notes

- Extension follows minimum permission principle
- Uses local storage for screenshots (no external servers)
- Comparison happens entirely in browser via JavaScript
- Screenshots are captured only for active tabs to minimize overhead

