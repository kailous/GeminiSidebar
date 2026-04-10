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

// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.settings-section');
const saveBtn = document.getElementById('save-btn');
const resetBtn = document.getElementById('reset-btn');
const statusMsg = document.getElementById('status-message');
const delayInput = document.getElementById('capture-delay');
const delayVal = document.getElementById('delay-val');
const mappingList = document.getElementById('mapping-list');
const addMappingBtn = document.getElementById('add-mapping-btn');
const versionDisplay = document.getElementById('current-version');
const checkUpdateBtn = document.getElementById('check-update');
const updateStatus = document.getElementById('update-status');

// Your Update Source (GitHub Releases API)
const UPDATE_URL = "https://api.github.com/repos/kailous/GeminiSidebar/releases/latest";
const REPO_URL = "https://github.com/kailous/GeminiSidebar";

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  displayVersion();
});

function displayVersion() {
  if (versionDisplay) {
    versionDisplay.textContent = chrome.runtime.getManifest().version;
  }
}

// Check for updates
if (checkUpdateBtn) {
  checkUpdateBtn.addEventListener('click', (e) => {
    e.preventDefault();
    checkForUpdates();
  });
}

async function checkForUpdates() {
  if (!updateStatus) return;
  
  updateStatus.textContent = "正在检查更新...";
  updateStatus.className = "update-status checking";

  try {
    const response = await fetch(UPDATE_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error('网络异常');
    
    const release = await response.json();
    // tag_name is usually "v1.1", remove 'v' if present
    const latestVersion = release.tag_name.replace(/^v/, '');
    const currentVersion = chrome.runtime.getManifest().version;
    const downloadUrl = (release.assets && release.assets.length > 0) 
      ? release.assets[0].browser_download_url 
      : release.html_url;

    if (isNewer(latestVersion, currentVersion)) {
      updateStatus.innerHTML = `
        <div class="update-guide">
          <div class="update-alert">发现新版本: <strong>${latestVersion}</strong></div>
          <ol class="steps">
            <li><a href="${downloadUrl}" target="_blank" class="primary-btn-mini">1. 下载最新 ZIP 包</a></li>
            <li>解压并将内容覆盖到当前插件所在目录</li>
            <li>前往 <a href="#" id="open-extensions" class="link">chrome://extensions</a> 刷新本插件</li>
          </ol>
        </div>
      `;
      updateStatus.className = "update-status new-version";

      // Listener for the extension page link (Instructional)
      document.getElementById('open-extensions').addEventListener('click', (e) => {
        e.preventDefault();
        alert('请在浏览器地址栏输入 chrome://extensions 并回车，然后点击本插件的“刷新”图标。');
      });
    } else {
      updateStatus.textContent = "当前已是最新版本 (" + currentVersion + ")";
      updateStatus.className = "update-status";
    }
  } catch (error) {
    console.error('Update Check Error:', error);
    updateStatus.textContent = "检查失败，请确认已在 GitHub 发布 Release。";
    updateStatus.className = "update-status error";
  }
}

/**
 * Simple version comparison (e.g. 1.1 > 1.0)
 */
function isNewer(latest, current) {
  const l = latest.replace(/^v/, '').split('.').map(Number);
  const c = current.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const lVal = l[i] || 0;
    const cVal = c[i] || 0;
    if (lVal > cVal) return true;
    if (lVal < cVal) return false;
  }
  return false;
}

// Navigation
navItems.forEach(item => {
  item.addEventListener('click', () => {
    const target = item.dataset.target;
    navItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    sections.forEach(s => {
      s.classList.remove('active');
      if (s.id === target) s.classList.add('active');
    });
  });
});

// Update delay label
if (delayInput) {
  delayInput.addEventListener('input', (e) => {
    delayVal.textContent = `${e.target.value}ms`;
  });
}

// Load settings
function loadSettings() {
  chrome.storage.sync.get(DEFAULTS, (settings) => {
    document.getElementById('auto-jump').checked = settings.autoJump;
    document.getElementById('default-gem').value = settings.defaultGem;
    document.getElementById('auto-focus').checked = settings.autoFocus;
    document.getElementById('capture-delay').value = settings.captureDelay;
    delayVal.textContent = `${settings.captureDelay}ms`;
    document.getElementById('capture-retries').value = settings.captureRetries;
    
    // Render Mappings
    mappingList.innerHTML = '';
    settings.gemMappings.forEach(m => {
      addMappingRow(m.domain, m.gemUrl);
    });
  });
}

// Add row to mapping list
function addMappingRow(domain = '', gemUrl = '') {
  const row = document.createElement('div');
  row.className = 'mapping-row';
  row.innerHTML = `
    <input type="text" class="mapping-domain" placeholder="域名 (如 github.com)" value="${domain}">
    <input type="text" class="mapping-url" placeholder="Gem 链接" value="${gemUrl}">
    <button class="remove-mapping-btn">&times;</button>
  `;
  
  row.querySelector('.remove-mapping-btn').addEventListener('click', () => {
    row.remove();
  });
  
  mappingList.appendChild(row);
}

addMappingBtn.addEventListener('click', () => addMappingRow());

// Save settings
saveBtn.addEventListener('click', () => {
  const mappings = [];
  document.querySelectorAll('.mapping-row').forEach(row => {
    const dom = row.querySelector('.mapping-domain').value.trim();
    const url = row.querySelector('.mapping-url').value.trim();
    if (dom) mappings.push({ domain: dom, gemUrl: url });
  });

  const settings = {
    autoJump: document.getElementById('auto-jump').checked,
    defaultGem: document.getElementById('default-gem').value.trim(),
    autoFocus: document.getElementById('auto-focus').checked,
    captureDelay: parseInt(document.getElementById('capture-delay').value),
    captureRetries: parseInt(document.getElementById('capture-retries').value),
    gemMappings: mappings
  };

  chrome.storage.sync.set(settings, () => {
    showStatus('设置已保存！');
  });
});

// Reset settings
resetBtn.addEventListener('click', () => {
  if (confirm('确定要重置所有设置吗？')) {
    chrome.storage.sync.set(DEFAULTS, () => {
      loadSettings();
      showStatus('已恢复默认设置');
    });
  }
});

function showStatus(text) {
  statusMsg.textContent = text;
  statusMsg.classList.add('show');
  setTimeout(() => {
    statusMsg.classList.remove('show');
  }, 2000);
}
