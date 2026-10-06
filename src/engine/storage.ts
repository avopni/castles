import type { Action, State } from "./types";
import { assertInvariants, reduceGame } from "./game";
export type Record = {
  format: "cascading-castles";
  version: 1;
  initial: State;
  actions: Action[];
  savedAt: string;
};
const KEY = "cascading-castles-save-v1";
export function replay(record: Record): State {
  return record.actions.reduce(reduceGame, structuredClone(record.initial));
}
export function parseSave(json: string): Record {
  const r = JSON.parse(json) as Record;
  if (
    r.format !== "cascading-castles" ||
    r.version !== 1 ||
    !Array.isArray(r.actions) ||
    r.actions.length > 100000 ||
    r.initial?.version !== 1
  )
    throw new Error("Unsupported save file");
  assertInvariants(r.initial);
  assertInvariants(replay(r));
  return r;
}
export function save(record: Record) {
  localStorage.setItem(
    KEY,
    JSON.stringify({ ...record, savedAt: new Date().toISOString() }),
  );
}
export function load(): Record | null {
  const raw = localStorage.getItem(KEY);
  return raw ? parseSave(raw) : null;
}
