// "Ask a grown-up": a simple sum that young children can't answer, shown before anything
// meant for parents (recording a voice, sending it to family). Resolves true if answered.

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

export function grownUpCheck(reason = 'This part is for grown-ups.') {
  return new Promise(resolve => {
    const a = 6 + ((Math.random() * 7) | 0), b = 5 + ((Math.random() * 8) | 0), answer = a + b;
    const choices = new Set([answer]);
    while (choices.size < 3) choices.add(answer + (((Math.random() * 9) | 0) - 4) || answer + 5);
    const box = el('div', 'gate');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    const card = el('div', 'card');
    const buttons = el('div', 'answers');
    for (const n of [...choices].sort(() => Math.random() - 0.5)) {
      const b = el('button', 'begin', String(n));
      b.onclick = () => finish(n === answer);
      buttons.append(b);
    }
    const cancel = el('button', 'cancel', 'Not now');
    cancel.onclick = () => finish(false);
    card.append(el('div', 'eyebrow', 'Ask a grown-up'), el('p', '', reason), el('h3', '', `What is ${a} + ${b}?`), buttons, cancel);
    box.append(card);
    document.body.append(box);
    setTimeout(() => box.classList.add('in'), 30);
    function finish(ok) {
      box.classList.remove('in');
      setTimeout(() => box.remove(), 300);
      resolve(ok);
    }
  });
}
