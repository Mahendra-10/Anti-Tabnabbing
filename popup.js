// Popup Script for Anti-Tabnabbing Extension
// Handles the UI when user clicks on extension icon

document.addEventListener('DOMContentLoaded', async () => {
  // Get current tab information
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (tab) {
    updateCurrentTabInfo(tab);
    checkScreenshotStatus(tab.id);
  }
  
  // Set up event listeners
  document.getElementById('clearHighlights').addEventListener('click', () => {
    clearHighlights();
  });
  
  document.getElementById('forceCheck').addEventListener('click', () => {
    forceCheck(tab.id);
  });
  
  // Debug: List all screenshots (double-click footer to show)
  document.querySelector('.footer').addEventListener('dblclick', () => {
    listAllScreenshots();
  });
});

// Update current tab information in popup
function updateCurrentTabInfo(tab) {
  const currentTabElement = document.getElementById('currentTab');
  const url = new URL(tab.url);
  currentTabElement.textContent = `${url.hostname}`;
}

// Check if screenshot exists for current tab
async function checkScreenshotStatus(tabId) {
  const result = await chrome.storage.local.get([`screenshot_${tabId}`]);
  const lastScreenshotElement = document.getElementById('lastScreenshot');
  
  if (result[`screenshot_${tabId}`]) {
    lastScreenshotElement.textContent = 'Screenshot stored';
    lastScreenshotElement.style.color = '#28a745';
  } else {
    lastScreenshotElement.textContent = 'No screenshot yet';
    lastScreenshotElement.style.color = '#999';
  }
}

// Clear highlights from current tab
async function clearHighlights() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (tab) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'clearHighlights'
    }).then(() => {
      updateStatus('safe', 'Highlights cleared');
    }).catch(err => {
      console.error('Error clearing highlights:', err);
    });
  }
}

// Force a check on current tab
async function forceCheck(tabId) {
  updateStatus('warning', 'Checking...');
  
  try {
    // First, check if we have a screenshot to compare
    const result = await chrome.storage.local.get([`screenshot_${tabId}`]);
    
    if (!result[`screenshot_${tabId}`]) {
      // No screenshot exists, capture one first
      updateStatus('warning', 'Capturing screenshot...');
      
      // Request background script to capture a screenshot
      await chrome.runtime.sendMessage({
        action: 'forceCapture',
        tabId: tabId
      });
      
      // Wait a bit for screenshot to be captured
      await new Promise(resolve => setTimeout(resolve, 500));
      
      updateStatus('safe', 'Screenshot captured. Switch tabs and check again.');
      return;
    }
    
    // Try to send message to content script
    chrome.tabs.sendMessage(tabId, {
      action: 'compareScreenshots',
      tabId: tabId
    }).then(() => {
      // Message sent successfully
      setTimeout(() => {
        updateStatus('safe', 'Check initiated');
      }, 500);
    }).catch(err => {
      // Content script might not be ready or page doesn't support it
      const errorMsg = err.message || 'Unknown error';
      
      if (errorMsg.includes('Could not establish connection') || 
          errorMsg.includes('Receiving end does not exist')) {
        updateStatus('danger', 'Content script not ready. Try refreshing the page.');
      } else if (errorMsg.includes('chrome://') || errorMsg.includes('chrome-extension://')) {
        updateStatus('warning', 'Cannot check Chrome internal pages');
      } else {
        updateStatus('danger', `Check failed: ${errorMsg}`);
      }
      
      console.error('Error forcing check:', err);
    });
  } catch (error) {
    console.error('Error in forceCheck:', error);
    updateStatus('danger', 'Check failed');
  }
}

// Update status display in popup
function updateStatus(status, text) {
  const statusContainer = document.getElementById('statusContainer');
  const statusText = document.getElementById('statusText');
  
  // Remove all status classes
  statusContainer.classList.remove('status-safe', 'status-warning', 'status-danger');
  
  // Add appropriate class
  statusContainer.classList.add(`status-${status}`);
  statusText.textContent = text;
}

// Debug function: List all stored screenshots
async function listAllScreenshots() {
  const allData = await chrome.storage.local.get(null);
  
  const screenshots = Object.keys(allData).filter(key => key.startsWith('screenshot_'));
  const urls = Object.keys(allData).filter(key => key.startsWith('lastUrl_'));
  
  console.log('📸 Stored Screenshots:');
  console.log(`Total: ${screenshots.length} screenshots`);
  
  screenshots.forEach(key => {
    const tabId = key.replace('screenshot_', '');
    const urlKey = `lastUrl_${tabId}`;
    const url = allData[urlKey] || 'Unknown URL';
    
    console.log(`\nTab ID: ${tabId}`);
    console.log(`  URL: ${url}`);
    console.log(`  Screenshot: ${allData[key].substring(0, 50)}... (data URL)`);
  });
  
  // Also show in popup
  alert(`Found ${screenshots.length} stored screenshots. Check console for details.`);
}

