/*
 * Family → child → Data & removal: download everything held about a child, or remove them.
 * Removal stops them signing in at once; their data is kept for CHILD_PURGE_DAYS days, then deleted for good.
 * (src/family/children.js: GET …/export, GET …/export/files, DELETE /api/family/children/:id)
 */
(function () {
  const { esc, toast, sheet, api } = F;
  F.family.childPanel({ id: 'data', emoji: '🗂️', name: 'Data & removal', sub: 'Download, or remove', order: 60, render: panel });

  function panel(el, child) {
    const base = `/api/family/children/${encodeURIComponent(child.id)}`;
    const days = child.purge_days || 30;
    el.innerHTML = `<h1>Data & removal</h1>
      <div class="card">
        <h2 style="margin-top:0">Download</h2>
        <p class="small muted">Everything Pippin holds about ${esc(child.name)}: their messages, progress, jobs, money, books and settings, in one file. Passwords and PIN codes are left out.</p>
        <a class="btn block" href="${base}/export" download>Download everything</a>
        <p class="small muted" style="margin-top:14px">Their files: voice notes and recordings that are kept on the server.</p>
        <a class="btn ghost block" href="${base}/export/files" download>Download the files</a>
        <p class="small muted" style="margin-top:14px">Their audio library: stories and listening.</p>
        <a class="btn ghost block" href="${base}/export/files?root=library" download>Download the library</a>
      </div>
      <div class="card">
        <h2 style="margin-top:0">Remove ${esc(child.name)}</h2>
        <p class="small">They can no longer sign in. Their data is kept for ${days} days, in case you change your mind, and then permanently deleted. Grown-up accounts are not affected.</p>
        <button class="btn ghost block" id="rmKid" style="color:var(--danger)">Remove this child…</button>
      </div>`;
    el.querySelector('#rmKid').onclick = () => sheet(`<h1>Remove ${esc(child.name)}?</h1>
      <p class="small">They will be signed out and can’t sign in again. Their data is kept for ${days} days, then permanently deleted.</p>
      <div class="field"><label for="rmName">To confirm, type their name: <b>${esc(child.name)}</b></label><input id="rmName" autocomplete="off"></div>
      <button class="btn block" id="rmGo" style="color:var(--danger)" disabled>Remove ${esc(child.name)}</button>`, (sh, close) => {
      const input = sh.querySelector('#rmName'), go = sh.querySelector('#rmGo');
      const want = String(child.name).trim();
      input.oninput = () => { go.disabled = input.value.trim() !== want; };
      go.onclick = async () => {
        go.disabled = true;
        try {
          await api(base, { method: 'DELETE', body: { confirm: input.value.trim() } });
          close();
          toast(`${child.name} has been removed`);
          location.hash = '#family';
        } catch (e) { toast(e.message); go.disabled = input.value.trim() !== want; }
      };
    });
  }
})();
