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

// Initialize
document.addEventListener('DOMContentLoaded', loadSettings);

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
