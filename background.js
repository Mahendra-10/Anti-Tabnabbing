// Background Service Worker for Anti-Tabnabbing Extension
// Handles tab events, screenshot capture, and storage management

// Configuration
const SCREENSHOT_INTERVAL = 5000; // Take screenshot every 5 seconds
const MAX_STORED_SCREENSHOTS = 10; // Maximum number of screenshots to keep
const screenshotTimers = {}; // Store interval timers for each tab

// Helper function to format tab info for logging
function getTabInfo(tab) {
  if (!tab) return 'unknown tab';
  
  try {
    const url = new URL(tab.url);
    const hostname = url.hostname;
    const title = tab.title || 'Untitled';
    
    // For chrome://, about:, etc., show the full URL
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('about:')) {
      return `${title} (${tab.url})`;
    }
    
    return `${title} [${hostname}]`;
  } catch (e) {
    return tab.title || tab.url || `Tab ${tab.id}`;
  }
}

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Anti-Tabnabbing extension installed');
});

// Listen for tab activation (user switches to a different tab)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tabId = activeInfo.tabId;
  
  // Get tab information
  const tab = await chrome.tabs.get(tabId);
  
  // Skip chrome:// pages - can't capture or compare these
  if (tab.url.startsWith('chrome://') || 
      tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('about:')) {
    return; // Don't monitor chrome:// pages
  }
  
  // Check if we have a stored screenshot for this tab
  const result = await chrome.storage.local.get([`screenshot_${tabId}`]);
  
  if (result[`screenshot_${tabId}`]) {
    // We have a previous screenshot, need to compare
    const tabInfo = getTabInfo(tab);
    console.log(`📸 Tab activated: ${tabInfo} (ID: ${tabId}) - will compare screenshots`);
    
    // Send message to content script to trigger comparison
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, {
        action: 'compareScreenshots',
        tabId: tabId
      }).then(() => {
        console.log(`✅ Comparison message sent to content script for ${tabInfo}`);
      }).catch(err => {
        console.warn(`⚠️ Could not send comparison message to ${tabInfo}:`, err.message);
        console.log('   This is normal if the page just loaded or is a special page');
      });
    }, 1000); // Increased delay to ensure page is ready
  }
  
  // Start taking screenshots for this tab
  startScreenshotCapture(tabId);
});

// Listen for tab deactivation (user switches away from tab)
chrome.tabs.onActivated.addListener((activeInfo) => {
  // Stop screenshot capture for all other tabs
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id !== activeInfo.tabId) {
        stopScreenshotCapture(tab.id);
      }
    });
  });
});

// Listen for tab updates (URL changes, page loads, etc.)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    // Skip chrome:// pages - can't capture these
    if (tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('about:')) {
      return; // Don't monitor chrome:// pages
    }
    
    // Page has finished loading on active tab
    const tabInfo = getTabInfo(tab);
    console.log(`✅ Tab finished loading: ${tabInfo} (ID: ${tabId})`);
    startScreenshotCapture(tabId);
  }
});

// Listen for tab closure
chrome.tabs.onRemoved.addListener(async (tabId) => {
  // Clean up: stop screenshot capture and remove stored data
  stopScreenshotCapture(tabId);
  chrome.storage.local.remove([`screenshot_${tabId}`, `lastUrl_${tabId}`]);
  
  // Try to get tab info before it's removed (might fail, so catch error)
  try {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    const tabInfo = tab ? getTabInfo(tab) : `Tab ${tabId}`;
    console.log(`🗑️ Tab closed: ${tabInfo} (ID: ${tabId}) - cleaned up data`);
  } catch (e) {
    console.log(`🗑️ Tab closed: ID ${tabId} - cleaned up data`);
  }
});

// Function to start capturing screenshots at intervals
function startScreenshotCapture(tabId) {
  // Clear any existing timer for this tab
  stopScreenshotCapture(tabId);
  
  // Get tab info for logging (async, but don't block)
  chrome.tabs.get(tabId).then(tab => {
    // Skip chrome:// pages silently
    if (tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('about:')) {
      return; // Don't log or start capture for chrome:// pages
    }
    
    const tabInfo = getTabInfo(tab);
    console.log(`▶️ Started screenshot capture: ${tabInfo} (ID: ${tabId})`);
  }).catch(() => {
    // Ignore errors when getting tab info
  });
  
  // Capture immediately
  captureTabScreenshot(tabId);
  
  // Set up interval for periodic captures
  screenshotTimers[tabId] = setInterval(() => {
    captureTabScreenshot(tabId);
  }, SCREENSHOT_INTERVAL);
}

// Function to stop capturing screenshots
function stopScreenshotCapture(tabId) {
  if (screenshotTimers[tabId]) {
    clearInterval(screenshotTimers[tabId]);
    delete screenshotTimers[tabId];
    
    // Get tab info for logging (async, but don't block)
    chrome.tabs.get(tabId).then(tab => {
      const tabInfo = getTabInfo(tab);
      console.log(`⏸️ Stopped screenshot capture: ${tabInfo} (ID: ${tabId})`);
    }).catch(() => {
      console.log(`⏸️ Stopped screenshot capture: Tab ${tabId}`);
    });
  }
}

// Function to capture screenshot of a tab
async function captureTabScreenshot(tabId) {
  try {
    // Get tab info to check if it's active
    const tab = await chrome.tabs.get(tabId);
    
    if (!tab.active) {
      return; // Only capture active tabs
    }
    
    // Skip invalid/empty URLs
    if (!tab.url || tab.url === '' || tab.url === 'about:blank') {
      return; // Silently skip empty URLs
    }
    
    // Skip chrome:// and chrome-extension:// pages (can't capture these)
    if (tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('about:')) {
      // Silently skip - these pages can't be captured anyway
      return;
    }
    
    // Capture visible tab as data URL
    const screenshotDataUrl = await chrome.tabs.captureVisibleTab(
      tab.windowId,
      { format: 'png' }
    );
    
    // Proactively clean up if we're getting close to the limit
    await cleanupOldScreenshots();
    
    // Store screenshot with tab ID as key
    try {
      await chrome.storage.local.set({
        [`screenshot_${tabId}`]: screenshotDataUrl,
        [`lastUrl_${tabId}`]: tab.url
      });
      
      const tabInfo = getTabInfo(tab);
      console.log(`📷 Screenshot captured: ${tabInfo} (ID: ${tabId})`);
    } catch (storageError) {
      // If quota exceeded, clean up old screenshots and try again
      if (storageError.message.includes('quota') || storageError.message.includes('QUOTA_BYTES')) {
        console.warn('⚠️ Storage quota exceeded, cleaning up old screenshots...');
        await cleanupOldScreenshots();
        
        // Try storing again after cleanup
        try {
          await chrome.storage.local.set({
            [`screenshot_${tabId}`]: screenshotDataUrl,
            [`lastUrl_${tabId}`]: tab.url
          });
          const tabInfo = getTabInfo(tab);
          console.log(`📷 Screenshot captured after cleanup: ${tabInfo} (ID: ${tabId})`);
        } catch (retryError) {
          console.error('❌ Still unable to store screenshot after cleanup:', retryError.message);
        }
      } else {
        throw storageError; // Re-throw if it's not a quota error
      }
    }
  } catch (error) {
    // Only log errors that aren't expected
    const isExpectedError = 
      error.message.includes('activeTab') ||
      error.message.includes('cannot be edited') ||
      error.message.includes('chrome://') ||
      error.message.includes('Cannot access contents') ||
      error.message.includes('Extension manifest must request permission');
    
    if (!isExpectedError) {
      // Try to get tab info even on error
      try {
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        const tabInfo = tab ? getTabInfo(tab) : `Tab ${tabId}`;
        console.error(`❌ Error capturing screenshot for ${tabInfo} (ID: ${tabId}):`, error.message);
      } catch (e) {
        console.error(`❌ Error capturing screenshot for tab ${tabId}:`, error.message);
      }
    }
    // Silently ignore expected errors (chrome:// pages, tab dragging, permission issues, etc.)
  }
}

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureAndCompare') {
    handleCaptureAndCompare(sender.tab.id).then(sendResponse);
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'updateIcon') {
    updateExtensionIcon(sender.tab.id, request.status);
  }
  
  if (request.action === 'forceCapture') {
    // Force capture a screenshot for a specific tab
    captureTabScreenshot(request.tabId).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true; // Keep message channel open for async response
  }
});

// Handle capture and compare request
async function handleCaptureAndCompare(tabId) {
  try {
    // Get stored screenshot
    const result = await chrome.storage.local.get([`screenshot_${tabId}`]);
    const oldScreenshot = result[`screenshot_${tabId}`];
    
    if (!oldScreenshot) {
      return { success: false, message: 'No previous screenshot found' };
    }
    
    // Capture new screenshot
    const tab = await chrome.tabs.get(tabId);
    const newScreenshot = await chrome.tabs.captureVisibleTab(
      tab.windowId,
      { format: 'png' }
    );
    
    // Return both screenshots for comparison
    return {
      success: true,
      oldScreenshot: oldScreenshot,
      newScreenshot: newScreenshot
    };
  } catch (error) {
    console.error('Error in captureAndCompare:', error);
    return { success: false, message: error.message };
  }
}

// Clean up old screenshots to free up storage space
async function cleanupOldScreenshots() {
  try {
    // Get all stored data
    const allData = await chrome.storage.local.get(null);
    
    // Find all screenshot keys
    const screenshotKeys = Object.keys(allData).filter(key => key.startsWith('screenshot_'));
    
    if (screenshotKeys.length <= MAX_STORED_SCREENSHOTS) {
      return; // No cleanup needed
    }
    
    // Get all open tabs
    const openTabs = await chrome.tabs.query({});
    const openTabIds = new Set(openTabs.map(tab => tab.id.toString()));
    
    // Sort screenshots by tab ID (keep most recent/active tabs)
    // Remove screenshots for closed tabs first
    const closedTabScreenshots = screenshotKeys.filter(key => {
      const tabId = key.replace('screenshot_', '');
      return !openTabIds.has(tabId);
    });
    
    // Remove closed tab screenshots
    const keysToRemove = [];
    closedTabScreenshots.forEach(key => {
      const tabId = key.replace('screenshot_', '');
      keysToRemove.push(key, `lastUrl_${tabId}`);
    });
    
    // If still too many, remove oldest (keep only MAX_STORED_SCREENSHOTS most recent)
    if (screenshotKeys.length - closedTabScreenshots.length > MAX_STORED_SCREENSHOTS) {
      const remainingScreenshots = screenshotKeys.filter(key => !closedTabScreenshots.includes(key));
      const toRemove = remainingScreenshots.slice(0, remainingScreenshots.length - MAX_STORED_SCREENSHOTS);
      toRemove.forEach(key => {
        const tabId = key.replace('screenshot_', '');
        keysToRemove.push(key, `lastUrl_${tabId}`);
      });
    }
    
    // Remove old screenshots
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
      console.log(`🧹 Cleaned up ${keysToRemove.length / 2} old screenshots`);
    }
  } catch (error) {
    console.error('❌ Error cleaning up screenshots:', error);
  }
}

// Update extension icon based on detection status
function updateExtensionIcon(tabId, status) {
  const colors = {
    'safe': '#00FF00',      // Green - no changes
    'warning': '#FFA500',   // Orange - minor changes
    'danger': '#FF0000'     // Red - significant changes
  };
  
  const color = colors[status] || '#808080'; // Default gray
  
  chrome.action.setBadgeBackgroundColor({ color: color, tabId: tabId });
  chrome.action.setBadgeText({ text: status === 'safe' ? '✓' : '!', tabId: tabId });
}

