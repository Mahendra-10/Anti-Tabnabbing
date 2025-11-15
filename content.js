// Content Script for Anti-Tabnabbing Extension
// Runs on web pages to handle screenshot comparison and change highlighting

console.log('✅ Anti-Tabnabbing content script loaded on:', window.location.href);

// Listen for messages from background script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Content script received message:', request.action);
  
  if (request.action === 'compareScreenshots') {
    console.log('✅ Received compareScreenshots message for tab:', request.tabId);
    // Handle async operation without blocking
    handleScreenshotComparison(request.tabId).catch(err => {
      console.error('❌ Error in handleScreenshotComparison:', err);
    });
    // Send immediate response to keep channel open
    sendResponse({ received: true });
    return true; // Indicate we'll send async response
  }
  
  if (request.action === 'clearHighlights') {
    clearHighlights();
    sendResponse({ success: true });
    return false; // Synchronous response
  }
  
  return false; // No async response needed
});

// Handle screenshot comparison
async function handleScreenshotComparison(tabId) {
  try {
    console.log('🔍 Starting screenshot comparison...');
    
    // Request screenshots from background script
    const response = await chrome.runtime.sendMessage({
      action: 'captureAndCompare',
      tabId: tabId
    });
    
    if (!response.success) {
      console.log('ℹ️ No comparison needed:', response.message);
      return;
    }
    
    const oldScreenshot = response.oldScreenshot;
    const newScreenshot = response.newScreenshot;
    
    console.log('📸 Screenshots received, comparing images...');
    
    // Use Resemble.js to compare images
    const comparison = await new Promise((resolve, reject) => {
      // Wait for Resemble to be available
      if (typeof resemble === 'undefined') {
        reject(new Error('Resemble.js not loaded'));
        return;
      }
      
      resemble(oldScreenshot)
        .compareTo(newScreenshot)
        .ignoreAntialiasing()
        .ignoreColors(false)
        .onComplete((data) => {
          resolve(data);
        });
    });
    
    // Analyze comparison results
    // Resemble.js returns misMatchPercentage as a string, so we need to parse it
    // Or use rawMisMatchPercentage if available
    const mismatchPercentage = typeof comparison.rawMisMatchPercentage !== 'undefined' 
      ? comparison.rawMisMatchPercentage 
      : parseFloat(comparison.misMatchPercentage) || 0;
    const isSameDimensions = comparison.isSameDimensions;
    
    console.log(`📊 Comparison Results:`);
    console.log(`   - Mismatch: ${mismatchPercentage.toFixed(2)}%`);
    console.log(`   - Same dimensions: ${isSameDimensions}`);
    console.log(`   - Full comparison data:`, comparison);
    
    // Determine severity based on mismatch percentage
    let status, severity, message;
    
    if (mismatchPercentage < 1) {
      // Less than 1% difference - likely safe (just minor rendering differences)
      status = 'safe';
      severity = 'low';
      message = `✅ Screenshots match (${mismatchPercentage.toFixed(2)}% difference) - No tabnabbing detected`;
    } else if (mismatchPercentage < 10) {
      // 1-10% difference - minor changes
      status = 'warning';
      severity = 'low';
      message = `⚠️ Minor changes detected (${mismatchPercentage.toFixed(2)}% difference)`;
    } else if (mismatchPercentage < 30) {
      // 10-30% difference - moderate changes
      status = 'warning';
      severity = 'medium';
      message = `⚠️ Moderate changes detected (${mismatchPercentage.toFixed(2)}% difference) - Possible tabnabbing!`;
    } else {
      // More than 30% difference - major changes (likely tabnabbing)
      status = 'danger';
      severity = 'high';
      message = `🚨 MAJOR CHANGES DETECTED (${mismatchPercentage.toFixed(2)}% difference) - TABNABBING ATTACK LIKELY!`;
    }
    
    console.log(`   - Status: ${status.toUpperCase()}`);
    console.log(`   - ${message}`);
    
    // Update extension icon
    chrome.runtime.sendMessage({
      action: 'updateIcon',
      status: status
    });
    
    // If there are significant changes, highlight them
    if (mismatchPercentage > 1) {
      // Perform grid-based comparison and highlighting
      await highlightChangesWithGrid(oldScreenshot, newScreenshot, severity, mismatchPercentage);
      
      // Show alert to user
      showAlert(message, status);
    } else {
      // Clear any existing highlights
      clearHighlights();
    }
    
  } catch (error) {
    console.error('❌ Error in screenshot comparison:', error);
    chrome.runtime.sendMessage({
      action: 'updateIcon',
      status: 'safe'
    });
  }
}

// Grid configuration
const GRID_SIZE = 15; // 15x15 grid = 225 squares
const CELL_MISMATCH_THRESHOLD = 5; // Minimum % difference to highlight a cell

// Helper function to load image from data URL
function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Compare a single grid cell
async function compareGridCell(oldCellData, newCellData, x, y, width, height, severity) {
  return new Promise((resolve) => {
    if (typeof resemble === 'undefined') {
      resolve(false);
      return;
    }
    
    resemble(oldCellData)
      .compareTo(newCellData)
      .ignoreAntialiasing()
      .ignoreColors(false)
      .onComplete((data) => {
        const cellMismatch = typeof data.rawMisMatchPercentage !== 'undefined' 
          ? data.rawMisMatchPercentage 
          : parseFloat(data.misMatchPercentage) || 0;
        
        // If this cell has significant changes, highlight it
        if (cellMismatch > CELL_MISMATCH_THRESHOLD) {
          drawChangeRectangle(x, y, width, height, severity);
          resolve(true);
        } else {
          resolve(false);
        }
      });
  });
}

// Function to highlight changes using grid-based approach
async function highlightChangesWithGrid(oldScreenshot, newScreenshot, severity, overallMismatch) {
  console.log(`🎨 Starting grid-based highlighting (${GRID_SIZE}x${GRID_SIZE} grid)...`);
  
  // Clear existing highlights
  clearHighlights();
  
  // Get viewport dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  const cellWidth = viewportWidth / GRID_SIZE;
  const cellHeight = viewportHeight / GRID_SIZE;
  
  console.log(`📐 Viewport: ${viewportWidth}x${viewportHeight}, Cell size: ${cellWidth.toFixed(1)}x${cellHeight.toFixed(1)}`);
  
  // Create images from data URLs
  const oldImg = await loadImage(oldScreenshot);
  const newImg = await loadImage(newScreenshot);
  
  // Calculate cell dimensions in image space
  const cellImgWidth = Math.floor(oldImg.width / GRID_SIZE);
  const cellImgHeight = Math.floor(oldImg.height / GRID_SIZE);
  
  // Create canvas for extracting grid cells (size it to cell dimensions)
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = cellImgWidth;
  canvas.height = cellImgHeight;
  
  let changedCells = 0;
  const comparisonPromises = [];
  
  // Compare each grid cell
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const imgX = Math.floor((col / GRID_SIZE) * oldImg.width);
      const imgY = Math.floor((row / GRID_SIZE) * oldImg.height);
      
      // Extract cell from old screenshot
      ctx.clearRect(0, 0, cellImgWidth, cellImgHeight);
      ctx.drawImage(oldImg, imgX, imgY, cellImgWidth, cellImgHeight, 0, 0, cellImgWidth, cellImgHeight);
      const oldCellData = canvas.toDataURL('image/png');
      
      // Extract cell from new screenshot
      ctx.clearRect(0, 0, cellImgWidth, cellImgHeight);
      ctx.drawImage(newImg, imgX, imgY, cellImgWidth, cellImgHeight, 0, 0, cellImgWidth, cellImgHeight);
      const newCellData = canvas.toDataURL('image/png');
      
      // Compare this cell
      const cellPromise = compareGridCell(oldCellData, newCellData, col * cellWidth, row * cellHeight, cellWidth, cellHeight, severity)
        .then(changed => {
          if (changed) changedCells++;
        });
      
      comparisonPromises.push(cellPromise);
    }
  }
  
  // Wait for all comparisons to complete
  await Promise.all(comparisonPromises);
  
  console.log(`✅ Grid comparison complete: ${changedCells}/${GRID_SIZE * GRID_SIZE} cells changed`);
  
  // Show warning banner
  const banner = document.createElement('div');
  banner.id = 'tabnabbing-warning-banner';
  
  const colors = {
    'low': { bg: '#fff3cd', border: '#ffc107', text: '#856404' },
    'medium': { bg: '#ffeaa7', border: '#f39c12', text: '#d68910' },
    'high': { bg: '#f8d7da', border: '#dc3545', text: '#721c24' }
  };
  
  const color = colors[severity] || colors['medium'];
  
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background-color: ${color.bg};
    border-bottom: 3px solid ${color.border};
    color: ${color.text};
    padding: 15px 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 600;
    z-index: 1000000;
    text-align: center;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    pointer-events: auto;
  `;
  
  banner.innerHTML = `
    <span>⚠️ WARNING: This page has changed significantly since you last viewed it!</span>
    <button id="tabnabbing-dismiss" style="
      margin-left: 15px;
      padding: 5px 15px;
      background: ${color.border};
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
    ">Dismiss</button>
  `;
  
  document.body.appendChild(banner);
  
  // Add dismiss functionality
  document.getElementById('tabnabbing-dismiss').addEventListener('click', () => {
    banner.remove();
  });
  
  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    if (banner.parentNode) {
      banner.remove();
    }
  }, 10000);
}

// Function to create overlay for highlighting
function createOverlay() {
  // Remove existing overlay if present
  const existingOverlay = document.getElementById('tabnabbing-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }
  
  // Create new overlay
  const overlay = document.createElement('div');
  overlay.id = 'tabnabbing-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 999999;
  `;
  
  document.body.appendChild(overlay);
  return overlay;
}

// Function to draw change rectangles
function drawChangeRectangle(x, y, width, height, severity) {
  const overlay = document.getElementById('tabnabbing-overlay') || createOverlay();
  
  const rect = document.createElement('div');
  rect.className = 'tabnabbing-change-rect';
  
  // Color based on severity
  const colors = {
    'low': 'rgba(255, 255, 0, 0.3)',      // Yellow
    'medium': 'rgba(255, 165, 0, 0.4)',   // Orange
    'high': 'rgba(255, 0, 0, 0.5)'        // Red
  };
  
  rect.style.cssText = `
    position: absolute;
    left: ${x}px;
    top: ${y}px;
    width: ${width}px;
    height: ${height}px;
    background-color: ${colors[severity] || colors['medium']};
    border: 2px solid red;
    pointer-events: none;
  `;
  
  overlay.appendChild(rect);
}

// Function to clear all highlights
function clearHighlights() {
  const overlay = document.getElementById('tabnabbing-overlay');
  if (overlay) {
    overlay.remove();
  }
  
  const banner = document.getElementById('tabnabbing-warning-banner');
  if (banner) {
    banner.remove();
  }
}

// Function to show alert notification
function showAlert(message, status) {
  // Create a notification element
  const notification = document.createElement('div');
  notification.id = 'tabnabbing-notification';
  
  const bgColors = {
    'safe': '#d4edda',
    'warning': '#fff3cd',
    'danger': '#f8d7da'
  };
  
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background-color: ${bgColors[status] || bgColors['warning']};
    border: 2px solid ${status === 'danger' ? '#dc3545' : status === 'warning' ? '#ffc107' : '#28a745'};
    border-radius: 8px;
    padding: 15px 20px;
    max-width: 400px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 1000001;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    animation: slideIn 0.3s ease-out;
  `;
  
  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => notification.remove(), 300);
    }
  }, 5000);
}

