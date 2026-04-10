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
  // Reusable Summarize Function (Now Screenshot Based)
  async function triggerSummarize() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tab) throw new Error('No active tab found');

      if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        alert('抱歉，浏览器限制了在系统页面（如扩展程序页）进行截屏。请在普通网页上使用此功能。');
        return;
      }

      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // Backup to clipboard
      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      
      // 5. Send message directly to the Gemini iframe via postMessage
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ 
          action: 'screenshot_ready', 
          dataUrl: dataUrl 
        }, '*');
      }

      frame.focus();
    } catch (error) {
      console.error('Screenshot error:', error);
    }
  }

  // New Function: Full Text Extraction (Fix for infinite scroll)
  async function triggerFullText() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tab) throw new Error('No active tab found');

      // 1. Extract content from the tab
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const title = document.title;
          // Capture larger text for long pages (100k chars)
          const body = document.body.innerText.substring(0, 100000); 
          return { title, body, url: window.location.href };
        }
      });

      const prompt = `请总结以下网页内容：\n标题：${result.title}\n网址：${result.url}\n\n内容：\n${result.body}`;

      // 2. Write to clipboard (as fallback)
      await navigator.clipboard.writeText(prompt);
      
      // 3. Send message directly to the Gemini iframe via postMessage
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ 
          action: 'text_ready', 
          text: prompt 
        }, '*');
      }

      frame.focus();

    } catch (error) {
      console.error('Full text extraction error:', error);
    }
  }

  // Listen for messages from injected content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'summarize_page') {
      triggerSummarize();
    } else if (request.action === 'read_full_text') {
      triggerFullText();
    }
  });
});
