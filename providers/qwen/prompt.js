(async () => {
  const { tempMessage } = await chrome.storage.local.get('tempMessage');
  if (!tempMessage) throw new Error('No message');
  
  const ta = document.querySelector('textarea.message-input-textarea');
  if (!ta) throw new Error('Textarea not found');
  
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, tempMessage);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  
  let lastLength = 0, stableCount = 0;
  const getText = () => {
    const candidates = [...document.querySelectorAll('.qwen-markdown, .response-message-content')].reverse();
    for (const el of candidates) {
      const text = (el.innerText || el.textContent || '').trim();
      if (text && text.length >= 50) return text;
    }
    return '';
  };
  const initial = getText();
  
  while (true) {
    await new Promise(r => setTimeout(r, 500));
    const current = getText();
    if (current !== initial && current.length === lastLength && current.length > 0) {
      stableCount++;
      if (stableCount >= 3) {
        await chrome.storage.local.set({ tempOutput: current });
        break;
      }
    } else {
      stableCount = 0;
    }
    lastLength = current.length;
  }
})();