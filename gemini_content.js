/**
 * Gemini Content Script
 * Injected into gemini.google.com to integrate extension features.
 */

// Global MutationObserver to handle upload menu injection
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === 1) { // Element node
        // Check for Upload Menu
        const menu = node.querySelector('#upload-file-menu') || (node.id === 'upload-file-menu' ? node : null);
        if (menu && !menu.querySelector('.ext-summarize-item')) {
          injectButtons(menu);
        }
      }
    });
  }
});

// Start observing target
const target = document.body;
if (target) {
  observer.observe(target, { childList: true, subtree: true });
}

/**
 * Injects multiple buttons into the Gemini upload menu.
 */
function injectButtons(menu) {
  console.log('Gemini Sidebar: Injecting tools into menu');

  // 1. Screenshot Button
  const screenshotBtn = createMenuButton('滚动截图 (至当前位置)', 'image', () => {
    chrome.runtime.sendMessage({ action: 'summarize_page' });
    return '正在滚动截屏...';
  });

  // 2. Full Text Button
  const fullTextBtn = createMenuButton('智能提取正文 (Markdown)', 'article', () => {
    chrome.runtime.sendMessage({ action: 'read_full_text' });
    return '正在提取正文...';
  });

  // Add them to the menu
  menu.insertBefore(fullTextBtn, menu.firstChild);
  menu.insertBefore(screenshotBtn, menu.firstChild);
}

/**
 * Helper to create a consistent Gemini-styled menu button.
 */
function createMenuButton(label, iconName, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mat-mdc-list-item mdc-list-item mat-mdc-list-item-interactive mdc-list-item--with-leading-icon mat-mdc-list-item-single-line mdc-list-item--with-one-line ext-summarize-item';
  button.setAttribute('role', 'menuitem');
  button.style.cursor = 'pointer';

  button.innerHTML = `
    <mat-icon role="img" class="mat-icon notranslate mat-mdc-list-item-icon menu-icon gem-menu-item-icon google-symbols mat-ligature-font mat-icon-no-color mdc-list-item__start" aria-hidden="true">${iconName}</mat-icon>
    <span class="mdc-list-item__content">
      <span class="mat-mdc-list-item-unscoped-content mdc-list-item__primary-text">
        <div class="flex content">
          <span class="item">
            <div class="menu-text gem-menu-item-label" style="font-weight: 500;">${label}</div>
          </span>
        </div>
      </span>
    </span>
    <div class="mat-focus-indicator"></div>
  `;

  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const statusLabel = onClick();
    
    const labelEl = button.querySelector('.gem-menu-item-label');
    labelEl.textContent = statusLabel;
    
    setTimeout(() => {
      labelEl.textContent = label;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    }, 2000);
  });

  return button;
}

// Global listener for messages from sidepanel (via postMessage)
window.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'screenshot_ready') {
    handleScreenshotReady(event.data.dataUrl);
  } else if (event.data && event.data.action === 'text_ready') {
    handleTextReady(event.data.text);
  }
});

/**
 * Handles the received text and simulates input.
 */
function handleTextReady(text) {
  try {
    const editor = document.querySelector('.ql-editor[contenteditable="true"]') || 
                   document.querySelector('div[role="textbox"]');
    
    if (editor) {
      editor.focus();
      // Use execCommand to insert text efficiently into contenteditable
      document.execCommand('insertText', false, text);
      console.log('Gemini Sidebar: Text auto-inserted successfully');
      
      // Feedback
      updateMenuLabels('已提取并插入对话框！');
    }
  } catch (error) {
    console.error('Gemini Sidebar: Text auto-insert error:', error);
  }
}

/**
 * Shared helper to update labels in the menu.
 */
function updateMenuLabels(statusText) {
  const labels = document.querySelectorAll('.gem-menu-item-label');
  labels.forEach(l => {
    if (l.textContent.includes('正在')) {
      const original = l.textContent.includes('截屏') ? '截图当前屏幕' : '读取网页全文';
      l.textContent = statusText;
      setTimeout(() => {
        l.textContent = original;
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      }, 1500);
    }
  });
}

/**
 * Handles the received screenshot and simulates a paste event.
 */
async function handleScreenshotReady(dataUrl) {
  try {
    // 1. Convert DataURL to Blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const file = new File([blob], `screenshot_${Date.now()}.png`, { type: 'image/png' });

    // 2. Locate the input editor
    const editor = document.querySelector('.ql-editor[contenteditable="true"]') || 
                   document.querySelector('div[role="textbox"]');
    
    if (editor) {
      editor.focus();

      // 3. Create DataTransfer and simulate Paste
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true
      });

      editor.dispatchEvent(pasteEvent);
      console.log('Gemini Sidebar: Screenshot auto-pasted successfully');
      
      // Update menu items if still open
      const labels = document.querySelectorAll('.gem-menu-item-label');
      labels.forEach(l => {
        if (l.textContent === '正在截屏...') {
          l.textContent = '已粘贴到对话框！';
          setTimeout(() => {
            l.textContent = '截图当前网页并粘贴';
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
          }, 1500);
        }
      });
    } else {
      console.error('Gemini Sidebar: Input editor not found');
    }
  } catch (error) {
    console.error('Gemini Sidebar: Auto-paste error:', error);
  }
}
