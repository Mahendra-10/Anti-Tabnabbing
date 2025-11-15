# Anti-Tabnabbing Chrome Extension

A Manifest V3 Chrome extension that detects and alerts users about potential tabnabbing attacks by monitoring visual changes in tabs when they lose and regain focus.

## Features

✅ **Complete Implementation:**
- Screenshot capture at regular intervals (every 5 seconds)
- Automatic tab focus detection
- Image comparison using Resemble.js
- Grid-based change highlighting (15x15 grid)
- Visual alerts with colored rectangles
- Extension icon badge color coding
- Storage management with automatic cleanup
- Popup UI with status display and controls

## Project Structure

```
Anti-Tabnabbing/
├── manifest.json       # Extension configuration (Manifest V3)
├── background.js       # Service worker for tab monitoring
├── content.js          # Content script for comparison & highlighting
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic
├── resemble.js         # Image comparison library
├── icons/              # Extension icons
│   ├── icon16.png      # 16x16 toolbar icon
│   ├── icon48.png      # 48x48 management page icon
│   └── icon128.png     # 128x128 Chrome Web Store icon
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
- Manages screenshot storage with automatic cleanup
- Handles storage quota management (keeps max 10 screenshots)
- Coordinates comparison when user returns to a tab
- Updates extension icon badge with color coding

### `content.js`
- Runs on every webpage
- Handles screenshot comparison using Resemble.js
- Implements grid-based change highlighting (15x15 grid = 225 squares)
- Compares each grid cell individually
- Draws colored rectangles on changed areas:
  - Yellow: Low severity changes
  - Orange: Medium severity changes
  - Red: High severity changes (likely tabnabbing)
- Shows warning banners and notifications
- Communicates with background script

### `popup.html` & `popup.js`
- UI shown when clicking extension icon
- Displays current status and tab information
- Shows screenshot storage status
- Provides manual controls:
  - Clear Highlights: Remove visual overlays
  - Force Check Now: Manually trigger comparison
- Debug feature: Double-click footer to list all stored screenshots

### `resemble.js`
- Third-party library for image comparison
- Performs pixel-level comparison locally in browser
- Returns mismatch percentage and comparison data

## How It Works

1. **Screenshot Capture**: While browsing, the extension captures screenshots every 5 seconds for active tabs
2. **Tab Focus Detection**: When you switch tabs, the extension detects the focus change
3. **Comparison**: When you return to a tab, it captures a new screenshot and compares it with the stored one
4. **Change Detection**: Uses Resemble.js to calculate mismatch percentage
5. **Visual Highlighting**: 
   - Splits page into 15x15 grid (225 squares)
   - Compares each square individually
   - Highlights changed squares with colored rectangles
6. **Alerts**: Shows warning banners, notifications, and updates extension icon badge

## Status Levels

- **Safe** (< 1% change): Green badge, no warnings
- **Warning** (1-30% change): Yellow/Orange badge, warning banner
- **Danger** (> 30% change): Red badge, major alert - likely tabnabbing attack

## How to Load the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this directory (`Anti-Tabnabbing`)
5. The extension should now appear in your extensions list with the custom icon

## Usage

1. **Automatic Detection**: Just browse normally - the extension works automatically
2. **Manual Check**: Click extension icon → "Force Check Now" to manually trigger comparison
3. **Clear Highlights**: Click extension icon → "Clear Highlights" to remove visual overlays
4. **View Screenshots**: Double-click footer in popup to see all stored screenshots (debug feature)

## Technical Details

- **Storage Management**: Automatically cleans up old screenshots to prevent quota errors
- **Performance**: Only captures screenshots for active tabs
- **Privacy**: All processing happens locally - no data sent to external servers
- **Permissions**: Uses minimum required permissions only
- **Grid Size**: 15x15 grid (configurable via `GRID_SIZE` constant)
- **Cell Threshold**: 5% mismatch required to highlight a grid cell

## Requirements Met

✅ Manifest V3 Chrome extension  
✅ Screenshots on regular intervals  
✅ Tab focus detection  
✅ Screenshot comparison on return  
✅ Grid-based change highlighting  
✅ Color-coded visual alerts  
✅ Extension icon badge updates  
✅ Resemble.js for local comparison  
✅ Minimum permissions only  

## Notes

- Extension follows minimum permission principle
- Uses local storage for screenshots (no external servers)
- Comparison happens entirely in browser via JavaScript
- Screenshots are captured only for active tabs to minimize overhead
- Automatically manages storage to prevent quota errors
- Skips chrome:// and chrome-extension:// pages (can't capture these)

## License

This project is created for educational purposes as part of a Web Security course assignment.
