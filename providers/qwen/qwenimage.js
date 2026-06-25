(async () => {
  const { tempMessage, tempImageSize } = await chrome.storage.local.get(['tempMessage', 'tempImageSize']);
  if (!tempMessage) throw new Error('No prompt');

  const ratio = tempImageSize || '16:9';
  const IMGBB_KEY = '1f8ae6b0fb0849dbb9a72bdb61b58185';

  // Step 1 — open a new chat
  const newChat = document.querySelector('.sidebar-entry-fixed-list-content');
  if (!newChat) throw new Error('New Chat button not found');
  newChat.click();
  await new Promise(r => setTimeout(r, 800));

  // Step 2 — open mode menu and click Create Image
  document.querySelector('.mode-select-open').click();
  await new Promise(r => setTimeout(r, 400));

  const t2i = document.querySelector('[data-menu-id$="-t2i"]');
  if (!t2i) throw new Error('Create Image menu item not found');
  t2i.click();
  await new Promise(r => setTimeout(r, 600));

  // Step 3 — select ratio
  await new Promise((resolve, reject) => {
    document.querySelector('.size-selector .ant-dropdown-trigger').click();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const items = document.querySelectorAll('.ant-dropdown.size-selector-popup li');
      const item = [...items].find(el => el.innerText === ratio);
      if (!item) return reject(new Error(`Ratio ${ratio} not found`));
      item.click();
      resolve();
    }));
  });

  await new Promise(r => setTimeout(r, 400));

  // Step 4 — type prompt and send
  const ta = document.querySelector('textarea.message-input-textarea');
  if (!ta) throw new Error('Textarea not found');

  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, tempMessage);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 300));
  ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

  // Step 5 — wait for image with class qwen-image to appear
  const beforeImgs = document.querySelectorAll('img.qwen-image').length;
  let qwenSrc = null;

  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const imgs = document.querySelectorAll('img.qwen-image');
    if (imgs.length > beforeImgs) {
      const src = imgs[imgs.length - 1].src;
      if (src && src.startsWith('https://')) {
        qwenSrc = src;
        break;
      }
    }
  }

  if (!qwenSrc) throw new Error('Timeout waiting for generated image');

  // Step 6 — fetch image and convert to base64
  const blob = await fetch(qwenSrc).then(r => r.blob());
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  // Step 7 — upload to ImgBB
  const formData = new FormData();
  formData.append('image', base64);

  const uploadRes = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
    method: 'POST',
    body: formData,
  });

  if (!uploadRes.ok) throw new Error(`ImgBB upload failed: ${uploadRes.status}`);

  const uploadData = await uploadRes.json();
  if (!uploadData.success) throw new Error(`ImgBB error: ${JSON.stringify(uploadData.error)}`);

  await chrome.storage.local.set({ tempOutput: uploadData.data.url });
})();
