document.addEventListener('DOMContentLoaded', () => {
  const loader = document.getElementById('loader-container');
  const frame = document.getElementById('gemini-frame');

  // Handle iframe load event
  frame.addEventListener('load', () => {
    setTimeout(() => {
      loader.classList.add('hidden');
      frame.classList.add('loaded');
    }, 500);
  });
  // Default Settings
  const DEFAULTS = {
    autoJump: true,
    defaultGem: "https://gemini.google.com/app",
    captureDelay: 800,
    captureRetries: 3,
    autoFocus: true,
    gemMappings: [
      { domain: "github.com", gemUrl: "" },
      { domain: "wikipedia.org", gemUrl: "" }
    ],
    extractPrompt: "请分析以下网页内容：\n标题：{{title}}\n网址：{{url}}\n\n内容（Markdown）：\n{{body}}"
  };

  /**
   * Helper: Load current settings
   */
  async function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(DEFAULTS, resolve);
    });
  }

  /**
   * Auto-Jump Strategy: Redirect iframe based on current tab domain or URL
   */
  async function checkAndJump(tabId) {
    const settings = await getSettings();
    if (!settings.autoJump) return;

    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab || !tab.url || tab.url.startsWith('chrome://')) return;

      const currentUrl = tab.url;
      const currentHost = new URL(currentUrl).hostname;

      // Find best match by checking mapping against full URL or hostname
      const match = settings.gemMappings.find(m => {
        const rule = m.domain.trim();
        if (!rule) return false;
        
        // Convert wildcard '*' to regex '.*'
        const pattern = rule.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*');
        const regex = new RegExp(pattern, 'i');
        
        // Match against hostname or full URL
        return regex.test(currentHost) || regex.test(currentUrl);
      });
      
      // ONLY jump if a match is found. If no match, we don't force a redirect (stays on current or default)
      if (match && match.gemUrl) {
        if (frame.src !== match.gemUrl) {
          console.log(`Matched rule! Auto-jumping to Gem: ${match.gemUrl} for: ${currentUrl}`);
          frame.src = match.gemUrl;
          loader.classList.remove('hidden');
          frame.classList.remove('loaded');
        }
      } else if (!frame.src || frame.src === 'about:blank') {
        // Fallback for initial load if no match
        frame.src = settings.defaultGem;
      }
    } catch (e) {
      console.error('Auto-jump error:', e);
    }
  }

  // Monitor tab updates ONLY (ignore tab activation/switching as per user request)
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
      checkAndJump(tabId);
    }
  });

  // Initial check on load
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab) checkAndJump(tab.id);
  });

  // Helper: Sleep
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Reusable Summarize Function (Now Scrolling Screenshot)
  async function triggerSummarize() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tab) throw new Error('No active tab found');

      if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        alert('抱歉，浏览器限制了在系统页面进行截屏。请在普通网页上使用此功能。');
        return;
      }

      // 1. Get page dimensions and current scroll
      const [{ result: dimensions }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return {
            scrollY: window.scrollY,
            innerHeight: window.innerHeight,
            scrollHeight: document.documentElement.scrollHeight,
            devicePixelRatio: window.devicePixelRatio
          };
        }
      });

      const settings = await getSettings();
      const { scrollY, innerHeight, devicePixelRatio } = dimensions;
      const targetHeight = scrollY + innerHeight;
      const slices = [];
      const sliceHeight = innerHeight;

      // 2. Capture slices from top to current position
      for (let currentY = 0; currentY < targetHeight; currentY += sliceHeight) {
        // Ensure we don't go past the target too much, though last frame will just be what's visible
        const scrollToY = Math.min(currentY, scrollY);
        
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (y) => window.scrollTo(0, y),
          args: [scrollToY]
        });

        // Wait for rendering and rate limit (using user setting)
        await sleep(settings.captureDelay);

        const dataUrl = await captureWithRetry(tab.windowId, settings.captureRetries);
        slices.push({
          dataUrl,
          y: scrollToY
        });

        // If we reached the target scroll position, we are done
        if (scrollToY >= scrollY) break;
      }

      // 3. Restore original scroll
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (y) => window.scrollTo(0, y),
        args: [scrollY]
      });

      // 4. Stitch slices
      const finalDataUrl = await stitchSlices(slices, targetHeight, innerHeight, devicePixelRatio);
      
      // 5. Send to Gemini
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ 
          action: 'screenshot_ready', 
          dataUrl: finalDataUrl 
        }, '*');
      }

      frame.focus();
    } catch (error) {
      console.error('Scrolling screenshot error:', error);
    }
  }

  /**
   * Stitches multiple screenshot slices into a single DataURL.
   */
  async function stitchSlices(slices, totalHeight, viewportHeight, dpr) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size (scaled by DPR)
    canvas.width = (slices[0] ? await getImageWidth(slices[0].dataUrl) : 1000); 
    canvas.height = totalHeight * dpr;

    for (const slice of slices) {
      const img = await loadImage(slice.dataUrl);
      // Draw the slice at its scrolled position
      ctx.drawImage(img, 0, slice.y * dpr);
    }

    return canvas.toDataURL('image/png');
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = src;
    });
  }

  async function getImageWidth(src) {
    const img = await loadImage(src);
    return img.width;
  }

  /**
   * Captures the visible tab with a retry mechanism to handle quota limits.
   */
  async function captureWithRetry(windowId, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        return await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
      } catch (error) {
        if (error.message.includes('quota') && i < retries - 1) {
          console.warn(`Capture quota hit, retrying in 1s... (Attempt ${i + 1}/${retries})`);
          await sleep(1000);
          continue;
        }
        throw error;
      }
    }
  }

  // New Function: Smart Extraction (Readability + Markdown)
  async function triggerSmartExtraction() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tab) throw new Error('No active tab found');

      // 1. Fetch settings
      const settings = await getSettings();

      // 2. Inject and execute extractor.js
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['extractor.js']
      });

      if (!result) throw new Error('Extraction failed');

      // 3. Format prompt using template from settings
      let prompt = settings.extractPrompt
        .replace('{{title}}', result.title)
        .replace('{{url}}', result.url)
        .replace('{{body}}', result.body);

      // 4. Send message directly to the Gemini iframe via postMessage
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ 
          action: 'text_ready', 
          text: prompt 
        }, '*');
      }

      frame.focus();

    } catch (error) {
      console.error('Smart extraction error:', error);
    }
  }

  // Listen for messages from injected content script (legacy/other)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'summarize_page') {
      triggerSummarize();
    } else if (request.action === 'read_full_text') {
      triggerSmartExtraction();
    }
  });
});
