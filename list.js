const COLS = { todo: 'Not following back', important: 'Important', ok: 'OK', considering: 'Considering unfollow', unfollowed: 'Unfollowed' };
const SHORT = { todo: 'Unsorted', important: 'Important', ok: 'OK', considering: 'Considering', unfollowed: 'Unfollowed' }; // fits the card dropdown
const MOVABLE = Object.keys(COLS); // every column accepts drops; scans also fill 'unfollowed'

(async () => {
  const meta = document.getElementById('meta');
  const boardEl = document.getElementById('board');
  const search = document.getElementById('q');
  const { snapshots = [] } = await chrome.storage.local.get('snapshots');
  const cur = snapshots.at(-1);
  if (!cur) {
    search.hidden = true;
    boardEl.replaceWith(el('div', { className: 'card empty-state' },
      el('strong', { textContent: 'No scan yet' }), 'Run a scan from the extension popup first.'));
    return;
  }
  const key = 'board_' + cur.owner;
  let board = (await chrome.storage.local.get(key))[key] || { ts: 0, items: {} };
  const save = () => chrome.storage.local.set({ [key]: board });

  const reconciled = reconcileBoard(snapshots, board);
  if (reconciled) {
    board = reconciled;
    await save();
  }

  function move(pk, col) {
    if (col === 'todo') delete board.items[pk];
    else board.items[pk] = { col, name: cur.following[pk] };
    save();
    render();
  }

  function card(pk, name, col) {
    const li = el('li', { className: 'kcard' }, userLink(name));
    // Accounts a scan saw you unfollow are history; only ones you still follow can move.
    if (pk in cur.following) {
      li.draggable = true;
      li.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', pk); li.classList.add('dragging'); });
      li.addEventListener('dragend', () => li.classList.remove('dragging'));
      // Keyboard / no-mouse alternative to dragging.
      const sel = el('select');
      sel.setAttribute('aria-label', `Move @${name} to`);
      for (const c of MOVABLE) sel.add(new Option(SHORT[c], c, false, c === col));
      sel.addEventListener('change', () => move(pk, sel.value));
      li.append(sel);
    }
    return li;
  }

  function render() {
    const groups = Object.fromEntries(Object.keys(COLS).map((c) => [c, []]));
    for (const pk of notFollowingBackPks(cur)) groups[board.items[pk]?.col || 'todo'].push([pk, cur.following[pk]]);
    for (const [pk, e] of Object.entries(board.items)) if (e.col === 'unfollowed' && !(pk in cur.following)) groups.unfollowed.push([pk, e.name]);
    const q = search.value.trim().toLowerCase().replace(/^@/, '');

    meta.textContent = `${notFollowingBackPks(cur).length.toLocaleString()} accounts don't follow you back · scanned ${timeAgo(cur.ts)}`;
    boardEl.replaceChildren();
    for (const [col, title] of Object.entries(COLS)) {
      const shown = q ? groups[col].filter(([, name]) => name.toLowerCase().includes(q)) : groups[col];
      const section = el('section', { className: 'col' });
      section.dataset.col = col;
      const head = el('h2', { className: 'col-head' }, title, el('span', { className: 'pill', textContent: shown.length }));
      if (col === 'unfollowed' && groups[col].length) {
        const clear = el('button', { className: 'btn btn-ghost', textContent: 'Clear all' });
        clear.addEventListener('click', () => {
          for (const [pk] of groups.unfollowed) delete board.items[pk];
          save();
          render();
        });
        head.append(clear);
      }
      const ul = el('ul', { className: 'cards' }, ...shown.map(([pk, name]) => card(pk, name, col)));
      if (!shown.length) ul.append(el('li', { className: 'drop-empty', textContent: q ? 'No matches' : 'Drop cards here' }));
      if (MOVABLE.includes(col)) {
        section.addEventListener('dragover', (e) => { e.preventDefault(); section.classList.add('over'); });
        section.addEventListener('dragleave', (e) => { if (!section.contains(e.relatedTarget)) section.classList.remove('over'); });
        section.addEventListener('drop', (e) => {
          e.preventDefault();
          section.classList.remove('over');
          const pk = e.dataTransfer.getData('text/plain');
          if (pk in cur.following) move(pk, col);
        });
      }
      section.append(head, ul);
      boardEl.append(section);
    }
  }

  search.addEventListener('input', render);
  render();
})();
