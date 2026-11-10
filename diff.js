// Snapshots map Instagram pk (permanent id) -> username, so renamed accounts don't show as unfollow+follow.
function diff(prev, cur) {
  const minus = (a, b) => Object.keys(a).filter((k) => !(k in b)).map((k) => a[k]);
  return {
    newFollowers: prev ? minus(cur.followers, prev.followers) : [],
    unfollowers: prev ? minus(prev.followers, cur.followers) : [],
    notFollowingBack: minus(cur.following, cur.followers),
  };
}

const notFollowingBackPks = (s) => Object.keys(s.following).filter((k) => !(k in s.followers));

// Board items: {pk: {col: 'important'|'considering'|'unfollowed', name}}; pks not on the board sit in 'todo'.
// base = the snapshot the board was last reconciled against (or the previous one).
function reconcile(items, base, cur) {
  const nfb = new Set(notFollowingBackPks(cur));
  const next = {};
  for (const [pk, e] of Object.entries(items)) {
    if (!(pk in cur.following)) next[pk] = { col: 'unfollowed', name: e.name };
    // Still not following back and still tagged: keep. Followed back or re-followed: drop back to todo.
    else if (nfb.has(pk) && e.col !== 'unfollowed') next[pk] = { col: e.col, name: cur.following[pk] };
  }
  if (base) {
    for (const pk of notFollowingBackPks(base)) {
      if (!(pk in cur.following) && !next[pk]) next[pk] = { col: 'unfollowed', name: base.following[pk] };
    }
  }
  return next;
}

// Reconcile once per new scan, against the snapshot the board last saw, so unfollows between visits aren't missed.
// Returns the updated board, or null when it's already current.
function reconcileBoard(snapshots, board) {
  const cur = snapshots.at(-1);
  if (board?.ts === cur.ts) return null;
  const older = snapshots.filter((s) => s.owner === cur.owner && s !== cur);
  const base = older.find((s) => s.ts === board?.ts) || older.at(-1);
  return { ts: cur.ts, items: reconcile(board?.items || {}, base, cur) };
}

if (typeof module !== 'undefined') module.exports = Object.assign(diff, { reconcile, reconcileBoard, notFollowingBackPks });
