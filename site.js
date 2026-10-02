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

  // Home OBS guide: builds the two SRT addresses from the reader's details.
  // Nothing typed here is stored, sent anywhere or added to the page address.
  const builder = document.querySelector('[data-url-builder]');
  if (builder) {
    const inputs = {
      address: builder.querySelector('[data-builder-input="address"]'),
      passphrase: builder.querySelector('[data-builder-input="passphrase"]'),
    };
    const errors = {
      address: document.getElementById('builder-address-error'),
      passphrase: document.getElementById('builder-passphrase-error'),
    };
    const problems = {
      address: 'That doesn\'t look like a Tailscale address. It should start with 100.',
      passphrase: 'Use letters and numbers only, at least 20.',
    };
    const placeholders = { address: 'YOUR-COMPUTER-ADDRESS', passphrase: 'YOUR-PASSPHRASE' };
    const addresses = {
      obs: (address, passphrase) => `srt://${address}:1234?mode=listener&passphrase=${passphrase}&pbkeylen=32&latency=2000000`,
      roam: (address, passphrase) => `srt://${address}:1234/live?passphrase=${passphrase}&pbkeylen=256&latency=2000`,
    };
    const nextSteps = {
      obs: 'Copied. Paste it into Input in OBS.',
      roam: 'Copied. Paste it into Stream URL in Roam.',
    };
    const copyButtons = [...builder.querySelectorAll('[data-builder-copy]')];
    const statuses = [...builder.querySelectorAll('[data-builder-status]')];
    const generate = builder.querySelector('[data-builder-generate]');
    const generated = builder.querySelector('[data-builder-generated]');

    // Tailscale gives each device an IPv4 address from 100.64.0.0 to 100.127.255.255.
    const octetRanges = [[100, 100], [64, 127], [0, 255], [0, 255]];
    const wholeNumber = /^(0|[1-9]\d{0,2})$/;
    const fits = (part, [low, high]) => wholeNumber.test(part) && +part >= low && +part <= high;
    const canStart = (part, [low, high]) => {
      if (part === '') return true;
      if (!wholeNumber.test(part)) return false;
      for (let n = low; n <= high; n++) if (String(n).startsWith(part)) return true;
      return false;
    };
    // 'partial' means more typing could still make the value valid.
    const checks = {
      address: value => {
        const parts = value.split('.');
        if (parts.length > 4) return 'invalid';
        if (parts.length === 4 && parts.every((part, i) => fits(part, octetRanges[i]))) return 'valid';
        const last = parts.length - 1;
        return parts.every((part, i) => (i < last ? fits : canStart)(part, octetRanges[i])) ? 'partial' : 'invalid';
      },
      passphrase: value => {
        if (/^[A-Za-z0-9]{20,79}$/.test(value)) return 'valid';
        return /^[A-Za-z0-9]{1,19}$/.test(value) ? 'partial' : 'invalid';
      },
    };
    const read = name => {
      const value = inputs[name].value.trim();
      return { value, status: value ? checks[name](value) : 'empty' };
    };
    const showProblem = (name, show) => {
      const text = show ? problems[name] : '';
      if (errors[name].textContent !== text) errors[name].textContent = text;
      if (show) inputs[name].setAttribute('aria-invalid', 'true');
      else inputs[name].removeAttribute('aria-invalid');
    };
    const render = () => {
      const details = { address: read('address'), passphrase: read('passphrase') };
      builder.querySelectorAll('[data-builder-fill]').forEach(part => {
        const detail = details[part.dataset.builderFill];
        part.textContent = detail.status === 'valid' ? detail.value : placeholders[part.dataset.builderFill];
      });
      const ready = details.address.status === 'valid' && details.passphrase.status === 'valid';
      copyButtons.forEach(button => { button.disabled = !ready; });
    };
    const clearStatuses = () => statuses.forEach(line => { line.textContent = ''; });
    // Errors show at once for a character that can never fit, and on leaving
    // the field when the value is still unfinished. Typing is never blocked.
    const check = (name, leaving) => {
      const { status } = read(name);
      showProblem(name, status === 'invalid' || (leaving && status === 'partial'));
      render();
    };
    Object.keys(inputs).forEach(name => {
      inputs[name].addEventListener('input', () => { clearStatuses(); check(name, false); });
      inputs[name].addEventListener('blur', () => check(name, true));
    });

    if (window.crypto?.getRandomValues) {
      // 32 characters, so each random byte maps evenly. Leaves out 0, 1, l and o,
      // which are easy to mix up when typing the passphrase on a phone.
      const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
      generate.addEventListener('click', () => {
        const bytes = crypto.getRandomValues(new Uint8Array(24));
        inputs.passphrase.value = Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
        clearStatuses();
        check('passphrase', true);
        generated.textContent = '';
        setTimeout(() => { generated.textContent = 'Passphrase filled in.'; }, 50);
      });
    } else {
      generate.hidden = true;
    }

    copyButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const address = read('address');
        const passphrase = read('passphrase');
        if (address.status !== 'valid' || passphrase.status !== 'valid') return;
        const which = button.dataset.builderCopy;
        const status = builder.querySelector(`[data-builder-status="${which}"]`);
        clearStatuses();
        let message = nextSteps[which];
        try {
          await navigator.clipboard.writeText(addresses[which](address.value, passphrase.value));
        } catch {
          const range = document.createRange();
          range.selectNodeContents(builder.querySelector(`[data-builder-url="${which}"]`));
          getSelection().removeAllRanges();
          getSelection().addRange(range);
          message = 'Copy didn\'t work here. The address is selected, so copy it yourself.';
        }
        setTimeout(() => { status.textContent = message; }, 50);
      });
    });

    builder.querySelectorAll('[data-builder-only]').forEach(node => { node.hidden = false; });
    builder.querySelectorAll('[data-builder-nojs]').forEach(node => { node.hidden = true; });
    render();
    // Showing the form moves the page. Put a linked section back in view.
    let target;
    try { target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { target = null; }
    if (target) target.scrollIntoView();
  }

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
