// Run: node diff.test.js
const assert = require('assert');
const diff = require('./diff.js');

const prev = { followers: { 1: 'ann', 2: 'bob', 3: 'cat' }, following: {} };
const cur = {
  followers: { 1: 'ann', 3: 'cat_renamed', 4: 'dan' },
  following: { 1: 'ann', 5: 'eve' },
};

assert.deepStrictEqual(diff(prev, cur), {
  newFollowers: ['dan'],
  unfollowers: ['bob'],
  notFollowingBack: ['eve'],
});
// First scan: nothing to compare against yet.
assert.deepStrictEqual(diff(undefined, cur).newFollowers, []);
assert.deepStrictEqual(diff(undefined, cur).unfollowers, []);
console.log('diff ok');

const { reconcile } = diff;
const base = {
  followers: { 1: 'a', 7: 'g' },
  following: { 1: 'a', 2: 'b', 3: 'c', 4: 'd', 5: 'e', 6: 'f', 7: 'g' },
};
const now = { followers: { 1: 'a' }, following: { 1: 'a', 2: 'b2', 3: 'c', 4: 'd' } };
const items = {
  2: { col: 'important', name: 'b' },
  3: { col: 'unfollowed', name: 'c' },
  6: { col: 'considering', name: 'f' },
};
assert.deepStrictEqual(reconcile(items, base, now), {
  2: { col: 'important', name: 'b2' }, // still not following back: kept, rename picked up
  // 3 re-followed: back to todo; 4 never tagged: todo
  6: { col: 'unfollowed', name: 'f' }, // tagged, then user unfollowed
  5: { col: 'unfollowed', name: 'e' }, // untagged non-follower the user unfollowed
  // 7 followed back before the unfollow, so it isn't a "not following back" unfollow
});
// Followed back: drops off the board.
assert.deepStrictEqual(reconcile(items, null, { followers: { 2: 'b' }, following: { 2: 'b', 3: 'c' } }), {
  6: { col: 'unfollowed', name: 'f' },
});
console.log('reconcile ok');
