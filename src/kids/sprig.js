/*
 * The link between "doing things" elsewhere in the app (chores, books, stories, savings…) and the sprig.
 *
 * reward(uid, kind, ref) gives the sprig energy (which can send it on an adventure), cosmetic acorns and,
 * for a few special moments, a keepsake item for its room or wardrobe. Rules:
 *  - Once per (person, kind, ref): finishing the same book twice doesn't pay twice.
 *  - Repeatable kinds have a gentle daily cap, so it's never a grind.
 *  - Nothing is ever taken away, and nothing here touches real money or stars — acorns are cosmetic only.
 * Returns { messages: [...toasts], energy } for the UI.
 */
const { pool } = require('../db');
const game = require('../game');

// energy → the sprig's day bar; acorns → cosmetic shop; item → a free keepsake (catalog.js id).
const KINDS = {
  chore:          { energy: 5, acorns: 2, cap: 6, say: '⭐ Job done!' },
  care:           { energy: 5, acorns: 2, cap: 4, say: '💛 Kind to yourself!' },
  book_started:   { energy: 3, acorns: 2, cap: 3, say: '📖 A new book!' },
  book_finished:  { energy: 10, acorns: 10, say: '📚 You finished a book!' },
  book_chat:      { energy: 5, acorns: 5, say: '🎙️ Thanks for telling me about it!', firstItem: 'hat-bookworm' },
  books_milestone:{ acorns: 15, say: '🏆 Look at your bookshelf!', item: 'furn-tall-books' },
  story:          { energy: 3, acorns: 2, cap: 2, say: '🌙 A brand-new story!' },
  story_listened: { energy: 2, acorns: 1, cap: 3, say: '🎧 Lovely listening!' },
  learn:          { energy: 5, acorns: 5, cap: 4, say: '🧠 You learned something!' },
  game:           { energy: 2, acorns: 1, cap: 3, say: '🎮 Nice playing!' },
  savings_pot:    { acorns: 5, say: '🐷 A new savings pot!', firstItem: 'furn-piggy' },
  savings_goal:   { acorns: 20, say: '🎉 You saved up for it!', item: 'furn-trophy' },
  money_saved:    { energy: 2, acorns: 1, cap: 2, say: '🐷 Saving!' },
  wishlist:       { energy: 1, acorns: 1, cap: 2, say: '✨ Added to your list!' },
  collection:     { energy: 1, acorns: 1, cap: 2, say: '⭐ Added to your collection!' },
  buddy:          { energy: 2, acorns: 1, cap: 2, say: '💬 Nice chat!' },
  village_chat:   { acorns: 1, say: '🌾 Lovely to meet you!' },   // once per townsperson (ref = their name)
};

async function giveItem(uid, itemId) {
  const { rowCount } = await pool.query(
    `INSERT INTO inventory(user_id, item_id, source) SELECT $1,$2,'reward'
      WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE user_id=$1 AND item_id=$2)`, [uid, itemId]);
  return rowCount > 0;
}

async function reward(uid, kind, ref) {
  const k = KINDS[kind];
  if (!k || !uid) return { messages: [], energy: null };
  const pet = await game.getPet(uid);
  if (!pet) return { messages: [], energy: null };          // no sprig hatched yet — nothing to give
  const user = await game.getUser(uid);
  const day = game.localDay(user.tz);
  if (k.cap) {
    const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int n FROM sprig_rewards WHERE user_id=$1 AND kind=$2 AND day=$3', [uid, kind, day]);
    if (n >= k.cap) return { messages: [], energy: null };
  }
  const { rows: [{ first }] } = await pool.query('SELECT NOT EXISTS (SELECT 1 FROM sprig_rewards WHERE user_id=$1 AND kind=$2) AS first', [uid, kind]);
  const itemId = k.item || (first ? k.firstItem : null) || null;
  const { rowCount } = await pool.query(
    `INSERT INTO sprig_rewards(user_id, kind, ref, day, energy, acorns, item_id) VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (user_id, kind, ref) DO NOTHING`, [uid, kind, String(ref).slice(0, 200), day, k.energy || 0, k.acorns || 0, itemId]);
  if (!rowCount) return { messages: [], energy: null };
  const messages = [k.say];
  let energy = null;
  if (k.energy) energy = await game.addEnergy(uid, k.energy, kind);
  if (k.acorns) { await game.addAcorns(uid, k.acorns, `${kind}`); messages.push(`+${k.acorns} 🌰`); }
  if (itemId && await giveItem(uid, itemId)) {
    const { item } = require('../catalog');
    messages.push(`🎁 ${pet.name} got a ${item(itemId)?.name || 'present'}!`);
  }
  if (energy?.started) messages.push(`🎒 ${pet.name} is off on an adventure!`);
  return { messages, energy };
}

module.exports = { reward, KINDS };
