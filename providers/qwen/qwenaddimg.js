// extension.js - Run from background script or popup

async function uploadToQwen() {
  const tabId = await getActiveTabId();
  
  // Get file path from storage
  const { qwenFilePath } = await chrome.storage.local.get('qwenFilePath');
  if (!qwenFilePath) throw new Error('No file path in storage');
  
  await chrome.debugger.attach({ tabId }, '1.3');
  
  try {
    // Click plus button
    await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
      expression: `document.querySelector('.mode-select-open')?.click();`
    });
    await sleep(300);
    
    // Click upload menu item
    await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
      expression: `document.querySelector('[data-menu-id$="-upload"]')?.click();`
    });
    await sleep(500);
    
    // Read file from server
    const res = await fetch('http://localhost:3847/file/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: qwenFilePath })
    });
    const data = await res.json();
    const fileData = data.file;
    
    // Set file
    await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
      expression: `
        const fileData = ${JSON.stringify(fileData)};
        const byteCharacters = atob(fileData.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: fileData.mime });
        const file = new File([blob], fileData.name, { type: fileData.mime });
        
        const input = document.querySelector('input[type="file"]');
        if (input) {
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      `
    });
    
    await sleep(5000);
    
    // Press ESC
    await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
      expression: `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`
    });
    await sleep(300);
    
    // Get prompt from storage and send
    const { qwenPrompt } = await chrome.storage.local.get('qwenPrompt');
    
    await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
      expression: `
        const ta = document.querySelector('textarea.message-input-textarea');
        if (ta) {
          const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
          setter.call(ta, ${JSON.stringify(qwenPrompt || 'Analyze this file')});
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 300));
          ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        }
      `,
      awaitPromise: true
    });
    
    console.log('✅ Done');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await chrome.debugger.detach({ tabId });
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getActiveTabId() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0].id);
    });
  });
}