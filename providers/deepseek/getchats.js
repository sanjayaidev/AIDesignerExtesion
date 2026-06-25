(async () => {
  const chats = document.querySelectorAll('a._546d736');
  if (!chats.length) {
    await chrome.storage.local.set({ tempOutput: JSON.stringify([]) });
    return;
  }
  const result = Array.from(chats).map((chat, index) => ({
    index,
    title: chat.querySelector('div.c08e6e93')?.innerText?.trim() || 'No title',
    href:  'https://chat.deepseek.com' + chat.getAttribute('href')
  }));
  await chrome.storage.local.set({ tempOutput: JSON.stringify(result) });
})();
