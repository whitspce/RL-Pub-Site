(() => {
  const copyFeedback = document.querySelector('[data-copy-feedback]');
  if (navigator.clipboard?.writeText && copyFeedback) {
    document.querySelectorAll('[data-copy-text]').forEach(button => {
      button.hidden = false;
      button.addEventListener('click', async () => {
        const text = button.dataset.copyText;
        copyFeedback.textContent = '';
        try {
          await navigator.clipboard.writeText(text);
          copyFeedback.textContent = `Copied ${text}. Paste it into the Text field in Roam.`;
          button.textContent = 'Copied';
        } catch {
          copyFeedback.textContent = 'Copy was unavailable. Select the text beside the button and copy it.';
          button.textContent = 'Select text to copy';
        }
      });
    });
  }
  const openAnchor = () => {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    const detail = target.closest('details');
    if (detail) detail.open = true;
    target.querySelectorAll('details').forEach(node => { node.open = true; });
  };
  openAnchor();
  window.addEventListener('hashchange', openAnchor);

  const input = document.querySelector('[data-faq-search]');
  if (!input) return;
  input.closest('.faq-search').hidden = false;
  const items = [...document.querySelectorAll('.faq-item')];
  const groups = [...document.querySelectorAll('.faq-group')];
  const count = document.querySelector('[data-faq-count]');
  const empty = document.querySelector('[data-faq-empty]');
  const initialOpen = new Set(items.filter(item => item.open));
  input.addEventListener('input', () => {
    const words = input.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let visible = 0;
    items.forEach(item => {
      const matches = words.every(word => item.textContent.toLocaleLowerCase().includes(word));
      item.hidden = !matches;
      if (matches) visible++;
      item.open = words.length > 0 ? matches : initialOpen.has(item);
    });
    groups.forEach(group => { group.hidden = !group.querySelector('.faq-item:not([hidden])'); });
    count.textContent = words.length ? `${visible} ${visible === 1 ? 'answer' : 'answers'} found` : `${items.length} practical answers`;
    empty.hidden = visible > 0;
  });
  window.addEventListener('hashchange', () => {
    if (input.value) {
      input.value = '';
      input.dispatchEvent(new Event('input'));
      openAnchor();
    }
  });
})();
