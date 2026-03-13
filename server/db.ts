import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = process.env.ARCADE_DB_PATH || path.join(
  process.env.ARCADE_ROOT || '/home/pratham2/gt/gt_arcade/crew/manager',
  '.runtime',
  'arcade.db'
)

const db = new Database(DB_PATH)

// WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL')

// --- Schema ---

db.exec(`
  CREATE TABLE IF NOT EXISTS cost_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL DEFAULT (unixepoch()),
    key TEXT NOT NULL,
    data TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_cost_history_key_ts ON cost_history (key, ts);

  CREATE TABLE IF NOT EXISTS layouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rig_id TEXT NOT NULL UNIQUE,
    layout_json TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS agent_customizations (
    agent_id TEXT PRIMARY KEY,
    traits_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`)

// --- Cost History ---

const insertSnapshot = db.prepare(
  'INSERT INTO cost_history (key, data) VALUES (?, ?)'
)

const queryHistory = db.prepare(
  'SELECT ts, data FROM cost_history WHERE key = ? AND ts >= ? ORDER BY ts ASC'
)

const pruneOld = db.prepare(
  'DELETE FROM cost_history WHERE ts < ?'
)

export function recordSnapshot(key: string, data: string): void {
  insertSnapshot.run(key, data)
}

export function getHistory(key: string, sinceUnix: number): { ts: number; data: string }[] {
  return queryHistory.all(key, sinceUnix) as { ts: number; data: string }[]
}

export function pruneSnapshots(olderThanUnix: number): void {
  pruneOld.run(olderThanUnix)
}

// --- Preferences ---

const upsertPref = db.prepare(`
  INSERT INTO preferences (key, value, updated_at) VALUES (?, ?, unixepoch())
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()
`)

const getPref = db.prepare('SELECT key, value FROM preferences WHERE key = ?')
const getAllPrefs = db.prepare('SELECT key, value FROM preferences')

export function setPreference(key: string, value: string): void {
  upsertPref.run(key, value)
}

export function getPreference(key: string): string | null {
  const row = getPref.get(key) as { key: string; value: string } | undefined
  return row?.value ?? null
}

export function getAllPreferences(): Record<string, string> {
  const rows = getAllPrefs.all() as { key: string; value: string }[]
  const prefs: Record<string, string> = {}
  for (const row of rows) prefs[row.key] = row.value
  return prefs
}

// --- Layouts ---

const getLayout = db.prepare('SELECT rig_id, layout_json, created_at, updated_at FROM layouts WHERE rig_id = ?')
const upsertLayout = db.prepare(`
  INSERT INTO layouts (rig_id, layout_json, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())
  ON CONFLICT(rig_id) DO UPDATE SET layout_json = excluded.layout_json, updated_at = unixepoch()
`)
const deleteLayout = db.prepare('DELETE FROM layouts WHERE rig_id = ?')

export function getLayoutByRigId(rigId: string): { rig_id: string; layout_json: string; created_at: number; updated_at: number } | null {
  return (getLayout.get(rigId) as { rig_id: string; layout_json: string; created_at: number; updated_at: number } | undefined) ?? null
}

export function upsertLayoutForRig(rigId: string, layoutJson: string): void {
  upsertLayout.run(rigId, layoutJson)
}

export function deleteLayoutForRig(rigId: string): boolean {
  const result = deleteLayout.run(rigId)
  return result.changes > 0
}

// --- Agent Customizations ---

const upsertAgentTraits = db.prepare(`
  INSERT INTO agent_customizations (agent_id, traits_json, updated_at) VALUES (?, ?, unixepoch())
  ON CONFLICT(agent_id) DO UPDATE SET traits_json = excluded.traits_json, updated_at = unixepoch()
`)

const getAgentTraits = db.prepare('SELECT agent_id, traits_json FROM agent_customizations WHERE agent_id = ?')

export function setAgentTraits(agentId: string, traitsJson: string): void {
  upsertAgentTraits.run(agentId, traitsJson)
}

export function getAgentTraitsById(agentId: string): string | null {
  const row = getAgentTraits.get(agentId) as { agent_id: string; traits_json: string } | undefined
  return row?.traits_json ?? null
}

// --- Game Saves ---

db.exec(`
  CREATE TABLE IF NOT EXISTS game_saves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    state_json TEXT NOT NULL,
    is_autosave INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`)

const upsertSave = db.prepare(`
  INSERT INTO game_saves (slot, name, state_json, is_autosave, created_at, updated_at)
  VALUES (?, ?, ?, ?, unixepoch(), unixepoch())
  ON CONFLICT(slot) DO UPDATE SET
    name = excluded.name,
    state_json = excluded.state_json,
    is_autosave = excluded.is_autosave,
    updated_at = unixepoch()
`)

const getSave = db.prepare('SELECT slot, name, state_json, is_autosave, created_at, updated_at FROM game_saves WHERE slot = ?')
const listSaves = db.prepare('SELECT slot, name, is_autosave, created_at, updated_at FROM game_saves ORDER BY updated_at DESC')
const deleteSaveStmt = db.prepare('DELETE FROM game_saves WHERE slot = ?')

export function saveGameState(slot: string, name: string, stateJson: string, isAutosave: boolean): void {
  upsertSave.run(slot, name, stateJson, isAutosave ? 1 : 0)
}

export function loadGameState(slot: string): { slot: string; name: string; state_json: string; is_autosave: number; created_at: number; updated_at: number } | null {
  return (getSave.get(slot) as { slot: string; name: string; state_json: string; is_autosave: number; created_at: number; updated_at: number } | undefined) ?? null
}

export function listGameSaves(): { slot: string; name: string; is_autosave: number; created_at: number; updated_at: number }[] {
  return listSaves.all() as { slot: string; name: string; is_autosave: number; created_at: number; updated_at: number }[]
}

export function deleteGameSave(slot: string): boolean {
  const result = deleteSaveStmt.run(slot)
  return result.changes > 0
}

export function closeDb(): void {
  db.close()
}

export default db
