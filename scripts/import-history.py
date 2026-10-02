#!/usr/bin/env python3
"""Import contact METADATA from message history into Pippin's "your people".

Reads ONLY: which 1:1 chat, when, and whether the message was sent or received.
Never reads message text (WhatsApp `text_data`, Facebook `content` are not selected/used).
Group chats are skipped. Output: per-handle, per-day sent/received counts → Pippin's contact_days.

Sources (both optional):
  --whatsapp-db  decrypted Android msgstore.db
  --facebook-dir Facebook "Download your information" folder (JSON format)

Usage:
  import-history.py --user-name Alex --whatsapp-db .../msgstore.db --facebook-dir .../facebook [--dry-run]
Writes via `docker exec <prefix>-postgres psql` (default pippin-postgres) (the DB is localhost-only).
"""
import argparse, collections, datetime, glob, json, os, sqlite3, subprocess, sys
PG_CONTAINER = os.environ.get('PG_CONTAINER', 'pippin-postgres')
DB_USER = os.environ.get('DB_USER', 'pippin')
DB_NAME = os.environ.get('DB_NAME', 'pippin')

ap = argparse.ArgumentParser()
ap.add_argument('--user-name', required=True)
ap.add_argument('--whatsapp-db')
ap.add_argument('--facebook-dir')
ap.add_argument('--tz', default='Europe/London')
ap.add_argument('--exclude', default='', help='comma-separated handles to skip (e.g. work contacts)')
ap.add_argument('--dry-run', action='store_true')
a = ap.parse_args()

from zoneinfo import ZoneInfo
TZ = ZoneInfo(a.tz)
day = lambda ms: datetime.datetime.fromtimestamp(ms / 1000, TZ).strftime('%Y-%m-%d')
excl = {x.strip() for x in a.exclude.split(',') if x.strip()}
counts = collections.defaultdict(lambda: [0, 0])          # (kind, handle, day) -> [sent, received]
names = {}                                                # (kind, handle) -> display

if a.whatsapp_db:
    c = sqlite3.connect(f'file:{a.whatsapp_db}?mode=ro', uri=True)
    rows = c.execute("""
        SELECT j.user, j.server, m.from_me, m.timestamp
        FROM message m JOIN chat ch ON ch._id = m.chat_row_id JOIN jid j ON j._id = ch.jid_row_id
        WHERE j.server IN ('s.whatsapp.net', 'lid') AND m.timestamp > 0 AND m.message_type NOT IN (7)""")
    n = 0
    for user, server, from_me, ts in rows:
        if not user or user in excl: continue
        counts[('whatsapp', user, day(ts))][0 if from_me else 1] += 1
        n += 1
    print(f'whatsapp: {n} messages (metadata) from 1:1 chats', file=sys.stderr)

if a.facebook_dir:
    fix = lambda s: s.encode('latin1').decode('utf8') if isinstance(s, str) else s   # FB exports mojibake UTF-8
    files = glob.glob(os.path.join(a.facebook_dir, '**', 'messages', '**', 'message_*.json'), recursive=True)
    threads = []
    for f in files:
        try: d = json.load(open(f, encoding='utf8'))
        except Exception: continue
        parts = [fix(p.get('name', '')) for p in d.get('participants', [])]
        if len(parts) != 2: continue                                  # 1:1 only
        threads.append((parts, d.get('messages', [])))
    # The owner is whoever appears in the most 1:1 threads.
    me = collections.Counter(p for parts, _ in threads for p in parts).most_common(1)
    me = me[0][0] if me else None
    n = 0
    for parts, msgs in threads:
        other = next((p for p in parts if p != me), None)
        if not other or other in excl: continue
        names[('facebook', other)] = other
        for m in msgs:
            ts = m.get('timestamp_ms')
            if not ts: continue
            counts[('facebook', other, day(ts))][0 if fix(m.get('sender_name')) == me else 1] += 1
            n += 1
    print(f'facebook: {n} messages (metadata) across {len(threads)} 1:1 threads; owner detected as "{me}"', file=sys.stderr)

print(f'{len(counts)} handle-days, {len({(k, h) for k, h, _ in counts})} handles', file=sys.stderr)
if a.dry_run: sys.exit(0)

def psql(sql, stdin=None):
    r = subprocess.run(['docker', 'exec', '-i', PG_CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-v', 'ON_ERROR_STOP=1', '-tAc', sql],
                       input=stdin, capture_output=True, text=True)
    if r.returncode: sys.exit(r.stderr)
    return r.stdout.strip()

uid = psql(f"SELECT id FROM users WHERE trim(name) = '{a.user_name.strip().replace(chr(39), '')}' AND deleted_at IS NULL ORDER BY created_at LIMIT 1")
if not uid: sys.exit(f'no Pippin user named {a.user_name}')
esc = lambda s: str(s).replace('\\', '\\\\').replace('\t', ' ').replace('\n', ' ')
cd = ''.join(f'{uid}\t{k}\t{esc(h)}\t{d}\t{s}\t{r}\n' for (k, h, d), (s, r) in counts.items())
nm = ''.join(f'{uid}\t{k}\t{esc(h)}\t{esc(v)}\n' for (k, h), v in names.items())
def script(sql_before, data, sql_after):
    r = subprocess.run(['docker', 'exec', '-i', PG_CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-v', 'ON_ERROR_STOP=1', '-q'],
                       input=f'{sql_before}\n{data}\\.\n{sql_after}\n', capture_output=True, text=True)
    if r.returncode: sys.exit(r.stderr)
script("CREATE TEMP TABLE x (user_id uuid, kind text, handle text, day date, sent int, received int); COPY x FROM STDIN;", cd,
       "INSERT INTO contact_days SELECT * FROM x ON CONFLICT (user_id, kind, handle, day) DO UPDATE "
       "SET sent = GREATEST(contact_days.sent, EXCLUDED.sent), received = GREATEST(contact_days.received, EXCLUDED.received);")
if nm:
    script("CREATE TEMP TABLE y (user_id uuid, kind text, handle text, display text); COPY y FROM STDIN;", nm,
           "INSERT INTO handle_names SELECT * FROM y ON CONFLICT (user_id, kind, handle) DO UPDATE SET display = EXCLUDED.display;")
print(f'imported into Pippin user {a.user_name}', file=sys.stderr)
