const scanBtn = document.getElementById('scan');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const STALE_MS = 2 * 60 * 1000; // no progress for 2 min = scan died (tab closed, etc.)

// Runs inside the instagram.com tab (isolated world): same-origin fetch sends the login cookies.
// Self-contained on purpose: executeScript serializes only this function.
async function scanInPage() {
  const progress = (text, running = true) =>
    chrome.storage.local.set({ progress: { text, running, ts: Date.now() } });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    const me = document.cookie.match(/(?:^|;\s*)ds_user_id=(\d+)/)?.[1];
    if (!me) throw new Error('Log in to Instagram in this tab first.');
    const result = {};
    for (const kind of ['followers', 'following']) {
      const map = {};
      let maxId = '';
      do {
        const url = `/api/v1/friendships/${me}/${kind}/?count=50` +
          (maxId ? `&max_id=${encodeURIComponent(maxId)}` : '');
        const res = await fetch(url, { headers: { 'X-IG-App-ID': '936619743392459' }, credentials: 'include' });
        // Stop at the first sign of throttling instead of retrying: retries are what get accounts blocked.
        if (!res.ok) throw new Error(`Instagram returned ${res.status}. Stopped to protect your account; try again in a few hours.`);
        const data = await res.json().catch(() => null);
        if (!data || data.status !== 'ok' || !Array.isArray(data.users)) {
          throw new Error(data?.message || 'Unexpected response from Instagram (logged out or checkpoint?).');
        }
        for (const u of data.users) map[String(u.pk_id ?? u.pk)] = u.username;
        maxId = data.next_max_id;
        await progress(`Fetching ${kind}: ${Object.keys(map).length}…`);
        if (maxId) await sleep(1500 + Math.random() * 1500);
      } while (maxId);
      result[kind] = map;
    }
    const { snapshots = [] } = await chrome.storage.local.get('snapshots');
    snapshots.push({ ts: Date.now(), owner: me, ...result });
    // ponytail: keeps the last 20 snapshots across all accounts; make it per-owner if multi-account matters.
    await chrome.storage.local.set({ snapshots: snapshots.slice(-20) });
    await progress('Scan complete.', false);
  } catch (e) {
    await progress('Error: ' + e.message, false);
  }
}

const showStatus = (text, error = false) => {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', error);
};

async function render() {
  const { snapshots = [], progress } = await chrome.storage.local.get(['snapshots', 'progress']);
  const running = !!(progress?.running && Date.now() - progress.ts < STALE_MS);
  const cur = snapshots.at(-1);
  scanBtn.disabled = running;
  scanBtn.setAttribute('aria-busy', running);
  scanBtn.textContent = running ? 'Scanning…' : cur ? 'Scan again' : 'Scan followers';
  document.getElementById('progress').hidden = !running;
  // Show live progress and errors; a finished scan speaks through the results instead.
  const error = progress?.text?.startsWith('Error: ');
  showStatus(running || error ? progress.text.replace(/^Error: /, '') : '', error);

  resultsEl.replaceChildren();
  if (!cur) {
    resultsEl.append(el('div', { className: 'empty-state' },
      el('strong', { textContent: 'No scans yet' }),
      'Open instagram.com in this tab while logged in, then click Scan. It takes about a minute per 1,000 accounts.'));
    return;
  }
  const prev = snapshots.slice(0, -1).filter((s) => s.owner === cur.owner).at(-1);
  const r = diff(prev, cur);
  const nfb = r.notFollowingBack.length;
  resultsEl.append(
    el('div', { className: 'stats' },
      stat('Followers', Object.keys(cur.followers).length, prev && r.newFollowers.length - r.unfollowers.length),
      stat('Following', Object.keys(cur.following).length),
      stat('Not following back', nfb)),
    el('p', { className: 'small muted', textContent: `Scanned ${timeAgo(cur.ts)}` +
      (prev ? ` · compared with ${new Date(prev.ts).toLocaleDateString()}` : ' · changes appear from your next scan') }),
  );
  if (prev) {
    resultsEl.append(
      section('Unfollowed you', r.unfollowers, 'bad', r.unfollowers.length > 0, 'Nobody unfollowed you since the last scan.'),
      section('New followers', r.newFollowers, 'good', r.newFollowers.length > 0, 'No new followers since the last scan.'),
    );
  }
  if (nfb) {
    const open = el('button', { className: 'btn btn-secondary btn-block', textContent: `Review ${nfb.toLocaleString()} not following back →` });
    open.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('list.html') }));
    resultsEl.append(open);
  }
}

scanBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.startsWith('https://www.instagram.com/')) {
    showStatus('Open instagram.com in this tab first, then click Scan.', true);
    return;
  }
  await chrome.storage.local.set({ progress: { text: 'Starting…', running: true, ts: Date.now() } });
  // Not awaited: the scan outlives the popup and reports through storage.
  chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scanInPage }).catch((e) =>
    chrome.storage.local.set({ progress: { text: 'Error: ' + e.message, running: false, ts: Date.now() } }));
});

chrome.storage.onChanged.addListener(render);
render();
