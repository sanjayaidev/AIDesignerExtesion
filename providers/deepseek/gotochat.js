(async () => {
  const { tempChatIndex } = await chrome.storage.local.get('tempChatIndex');
  const index = parseInt(tempChatIndex) || 0;

  const chats = document.querySelectorAll('a._546d736');
  if (index >= chats.length) {
    await chrome.storage.local.set({ tempOutput: JSON.stringify({ error: `Index ${index} out of range. Max: ${chats.length - 1}` }) });
    return;
  }

  chats[index].click();
  await new Promise(r => setTimeout(r, 500));

  const title = chats[index].querySelector('div.c08e6e93')?.innerText?.trim();
  await chrome.storage.local.set({ tempOutput: JSON.stringify({ ok: true, index, title }) });
})();
