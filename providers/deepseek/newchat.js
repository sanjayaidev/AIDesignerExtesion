(async () => {
  const btn = document.querySelector('div._5a8ac7a.a084f19e');
  if (!btn) {
    await chrome.storage.local.set({ tempOutput: JSON.stringify({ error: 'New chat button not found' }) });
    return;
  }
  btn.click();
  await new Promise(r => setTimeout(r, 500));
  await chrome.storage.local.set({ tempOutput: JSON.stringify({ ok: true, action: 'newchat' }) });
})();
