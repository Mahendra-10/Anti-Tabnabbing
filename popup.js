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
  
  chrome.tabs.sendMessage(tabId, {
    action: 'compareScreenshots',
    tabId: tabId
  }).then(() => {
    setTimeout(() => {
      updateStatus('safe', 'Check complete');
    }, 1000);
  }).catch(err => {
    console.error('Error forcing check:', err);
    updateStatus('danger', 'Check failed');
  });
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

