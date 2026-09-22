// saves read/write/attach. A save always belongs to (user_id, app, kind) — guest work has no row
// here at all; it sits in the browser until a magic link is clicked, then attach() folds it in.
import { getJson, putJson, listPrefix, fetchJson } from './store.js';
import { paths, validateSave, isSaveId } from './schema.js';
import { randomId } from './ids.js';

export async function putSave(uid, { app, kind, id, payload }) {
  const err = validateSave({ app, kind, payload });
  if (err) return { error: err };

  const saveId = id === undefined || id === null || id === '' ? randomId() : String(id);
  if (!isSaveId(saveId)) return { error: 'Invalid save id.' };

  const path = paths.save(app, uid, kind, saveId);
  const prior = await getJson(path);
  const now = new Date().toISOString();
  const record = {
    id: saveId,
    user_id: uid,
    app,
    kind,
    payload,
    created_at: prior?.created_at || now,
    updated_at: now,
  };
  await putJson(path, record);
  return { save: record };
}

export async function getSave(uid, app, kind, id) {
  if (!isSaveId(id)) return null;
  return getJson(paths.save(app, uid, kind, id));
}

export async function listSaves(uid, app, kind) {
  const blobs = await listPrefix(paths.savePrefix(app, uid, kind)).catch(() => []);
  const rows = await Promise.all(blobs.map((b) => fetchJson(b.url)));
  return rows
    .filter(Boolean)
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
}

// Fold a batch of guest rows into the signed-in user. Each item is validated independently so one
// bad row doesn't lose the rest of someone's work; the caller gets a per-item result.
export async function attachSaves(uid, app, items) {
  const list = Array.isArray(items) ? items.slice(0, 50) : [];
  const results = [];
  for (const item of list) {
    const { save, error } = await putSave(uid, {
      app,
      kind: item?.kind,
      id: item?.id,
      payload: item?.payload,
    });
    results.push(error ? { ok: false, id: item?.id ?? null, error } : { ok: true, id: save.id });
  }
  return results;
}
