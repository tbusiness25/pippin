/*
 * Obsidian "source of truth". The app writes ONLY into its own folder of the vault (mounted at
 * VAULT_DIR, e.g. <vault>/Companion) and ONLY content the person approved: journal entries,
 * weekly reviews, people notes (their own notes + contact dates) and open plans.
 * Raw coach conversations never go here — the vault syncs to phones and other tools read it.
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

const DIR = (process.env.VAULT_DIR || process.env.FINCH_VAULT_DIR) || '';
const enabled = () => !!DIR && fs.existsSync(DIR);
// The vault belongs to the server owner. Other household members' data NEVER goes into it.
async function ownerOnly(uid) {
  if (!enabled()) return false;
  const { rows } = await pool.query('SELECT is_owner FROM users WHERE id=$1', [uid]);
  return !!rows[0]?.is_owner;
}
const safe = (s) => String(s).replace(/[\\/:*?"<>|#^[\]]/g, '').trim().slice(0, 80) || 'untitled';

function write(rel, text) {
  const p = path.join(DIR, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
  return rel;
}

/** Approved memory → Journal/YYYY-MM-DD.md (appended) or Weekly/YYYY-MM-DD.md. */
async function writeMemory(uid, m, day) {
  if (!(await ownerOnly(uid))) return null;
  if (m.kind === 'weekly') {
    return write(`Weekly/${day}.md`, `---\ntype: pippin-weekly\ndate: ${day}\n---\n# ${m.title}\n\n${m.body}\n`);
  }
  const rel = `Journal/${day}.md`;
  const p = path.join(DIR, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (!fs.existsSync(p)) fs.writeFileSync(p, `---\ntype: pippin-journal\ndate: ${day}\n---\n# ${day}\n`);
  const icon = { win: '🏆', insight: '💡', note: '📝' }[m.kind] || '📝';
  fs.appendFileSync(p, `\n## ${icon} ${m.title}\n${m.body}\n`);
  return rel;
}

/** One note per person + an index. Only the person's own notes and contact dates — nothing inferred. */
async function syncPeople(uid) {
  if (!(await ownerOnly(uid))) return;
  const { rows } = await pool.query(
    `SELECT name, ring, cadence_days, birthday, notes, last_sent_at, last_received_at, archived_at
     FROM people WHERE user_id=$1 ORDER BY name`, [uid]);
  const d = (t) => (t ? new Date(t).toISOString().slice(0, 10) : '—');
  for (const p of rows) {
    if (p.archived_at) continue;
    write(`People/${safe(p.name)}.md`, `---\ntype: pippin-person\nring: ${p.ring}\n${p.birthday ? `birthday: "${p.birthday}"\n` : ''}${p.cadence_days ? `rhythm_days: ${p.cadence_days}\n` : ''}last_sent: ${d(p.last_sent_at)}\nlast_received: ${d(p.last_received_at)}\n---\n# ${p.name}\n\n${p.notes || '_Your notes about them go here (Pippin → Friends → Your people)._'}\n`);
  }
  write('People/_index.md', `# People\n\n${['closest', 'close', 'friends', 'wider'].map((r) =>
    `## ${r}\n${rows.filter((p) => p.ring === r && !p.archived_at).map((p) => `- [[${safe(p.name)}]] — last in touch ${d(p.last_sent_at > p.last_received_at ? p.last_sent_at : p.last_received_at || p.last_sent_at)}`).join('\n') || '_none_'}`).join('\n\n')}\n`);
}

/** Open plans and inbox as a checklist, regenerated on change. */
async function syncPlans(uid) {
  if (!(await ownerOnly(uid))) return;
  const { rows: plans } = await pool.query(`SELECT what, when_text, barrier, backup FROM commitments WHERE user_id=$1 AND status='open' ORDER BY due_at NULLS LAST`, [uid]);
  const { rows: inbox } = await pool.query(`SELECT text, due_on FROM inbox_items WHERE user_id=$1 AND status='open' ORDER BY due_on NULLS LAST, created_at`, [uid]);
  write('Plans.md', `---\ntype: pippin-plans\nupdated: ${new Date().toISOString()}\n---\n# Plans (from Pippin — edit in the app)\n\n## If-then plans\n${plans.map((p) =>
    `- [ ] **${p.when_text ? `When ${p.when_text}: ` : ''}${p.what}**${p.barrier ? ` — if ${p.barrier}, then ${p.backup || '…'}` : ''}`).join('\n') || '_none_'}\n\n## Inbox\n${inbox.map((i) => `- [ ] ${i.text}${i.due_on ? ` (due ${i.due_on})` : ''}`).join('\n') || '_empty_'}\n`);
}

module.exports = { enabled, writeMemory, syncPeople, syncPlans };
