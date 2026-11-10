// Shared DOM helpers for the extension pages and the phone page (plain script, no build step).
function el(tag, props = {}, ...kids) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids.filter((k) => k != null));
  return e;
}

// Profile link with a coloured initial; the hue is stable per username so people are easy to spot again.
function userLink(name) {
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const av = el('span', { className: 'avatar', textContent: name[0]?.toUpperCase() || '?' });
  av.style.setProperty('--h', hue);
  av.setAttribute('aria-hidden', 'true');
  return el('a', { className: 'user', href: `https://www.instagram.com/${encodeURIComponent(name)}/`, target: '_blank', rel: 'noopener', title: '@' + name },
    av, el('span', { className: 'handle', textContent: '@' + name }));
}

function userList(names, emptyText) {
  if (!names.length) return el('p', { className: 'empty', textContent: emptyText });
  return el('ul', { className: 'users' }, ...names.map((n) => el('li', {}, userLink(n))));
}

// Collapsible people list: <details class="section"> with a count pill.
function section(title, names, tone, open, emptyText) {
  const pill = el('span', { className: 'pill ' + (names.length ? tone : ''), textContent: names.length });
  return el('details', { className: 'section', open },
    el('summary', {}, el('span', { className: 'title' }, title, pill)), userList(names, emptyText));
}

function stat(label, num, delta) {
  const d = el('div', { className: 'stat' }, el('div', { className: 'num', textContent: num.toLocaleString() }), el('div', { className: 'label', textContent: label }));
  if (delta) d.append(el('div', { className: 'delta ' + (delta > 0 ? 'up' : 'down'), textContent: (delta > 0 ? '+' : '−') + Math.abs(delta).toLocaleString() + ' net' }));
  return d;
}

function timeAgo(ts) {
  const s = (Date.now() - ts) / 1000;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [unit, n] of [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]]) {
    if (s >= n) return rtf.format(-Math.floor(s / n), unit);
  }
  return 'just now';
}
