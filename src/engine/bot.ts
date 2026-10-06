import type { Action, Move, State } from "./types";
import {
  controller,
  hand,
  legalMoves,
  mod,
  movesFor,
  partner,
  surface,
  towerLocation,
  wizardLocation,
} from "./game";
import { SPELLS } from "./content";
export type Memory = Record<string, { support: string; space: number }>;
// Bots retain observations of the shared board, just as a player may remember them.
// No opponent card faces, deck order, RNG state, or unseen resident lists enter policy.
export function remember(s: State, memory: Memory = {}): Memory {
  const next = structuredClone(memory);
  for (const w of Object.keys(s.wizards)) {
    if (s.entered.includes(w)) {
      delete next[w];
      continue;
    }
    const loc = wizardLocation(s, w)!;
    if (loc.visible) next[w] = { support: loc.support, space: loc.space };
  }
  for (const id of Object.keys(next)) {
    const support = next[id].support;
    if (!support.startsWith("ground-"))
      next[id].space = towerLocation(s, support).space;
  }
  return next;
}
export function publicView(s: State): State {
  const out = structuredClone(s);
  out.rng = 1;
  out.deck = [];
  out.discard = [];
  out.events = [];
  const player = s.mode === "cooperative" ? 0 : s.current;
  out.players.forEach((p, i) => {
    if (i !== player) p.hand = [];
  });
  out.board.forEach((c, i) => {
    if (c.towers.length) c.ground = [];
    for (const id of c.towers)
      if (id !== c.towers.at(-1)) out.towers[id].residents = [];
  });
  return out;
}
function value(s: State, m: Move, memory: Memory): number {
  const own = controller(s),
    keep = towerLocation(s, "keep").space,
    p = s.players[s.mode === "cooperative" ? 0 : s.current];
  if (m.kind === "wizard") {
    const loc = wizardLocation(s, m.target)!,
      to = mod(loc.space + m.steps);
    if (to === keep) return 120 + (m.passenger ? 80 : 0);
    return (
      8 +
      (16 - mod(keep - to) - (16 - mod(keep - loc.space))) * 0.75 -
      (surface(s, to).length >= 5 ? 3 : 0)
    );
  }
  const loc = towerLocation(s, m.target),
    c = s.board[loc.space],
    to = mod(loc.space + m.steps),
    carried = c.towers.slice(loc.level),
    top = c.towers.at(-1)!;
  const captive = surface(s, to),
    below = loc.level ? c.towers[loc.level - 1] : `ground-${loc.space}`;
  const freed = Object.keys(memory).filter(
    (w) => memory[w].support === below && s.wizards[w]?.owner === own,
  ).length;
  const riding =
    top === "keep"
      ? 0
      : s.towers[top].residents.filter((w) => s.wizards[w].owner === own)
          .length;
  const rememberedRiders = Object.keys(memory).filter(
    (w) => carried.includes(memory[w].support) && s.wizards[w]?.owner === own,
  ).length;
  const progress = riding * (mod(keep - loc.space) - mod(keep - to)) * 0.65;
  return (
    (captive.length ? (p.empty ? 27 : 1) : 0) +
    freed * 20 +
    progress +
    rememberedRiders * 0.5 -
    (carried.includes("keep") ? 5 : 0)
  );
}
function best(s: State, moves: Move[], memory: Memory) {
  return [...moves].sort(
    (a, b) =>
      value(s, b, memory) - value(s, a, memory) ||
      a.target.localeCompare(b.target),
  )[0];
}
export function chooseBotAction(state: State, memory: Memory): Action {
  if(state.phase==='rescue')return {type:'chooseRescue',wizard:state.search!.choices[0]};
  const s = publicView(state);
  if (s.phase === "reaction") return { type: "passReaction" };
  if (s.phase === "roll") {
    const p = s.pending!,
      c = p.card!,
      moves = movesFor(s, c.wizard ? p.roll! : 0, c.tower ? p.roll! : 0),
      v = moves.length ? value(s, best(s, moves, memory), memory) : -100;
    const average =
      Array.from({ length: 6 }, (_, i) => {
        const candidates = movesFor(
          s,
          c.wizard ? i + 1 : 0,
          c.tower ? i + 1 : 0,
        );
        return candidates.length
          ? value(s, best(s, candidates, memory), memory)
          : -100;
      }).reduce((a, b) => a + b, 0) / 6;
    return p.rerolls > 0 && v < average
      ? { type: "reroll" }
      : { type: "accept" };
  }
  if (s.phase === "move") {
    const moves = legalMoves(s);
    return moves.length
      ? { type: "move", move: best(s, moves, memory) }
      : { type: "skip" };
  }
  if (
    !s.nasty &&
    ((!s.spellUsed &&
      !(s.mode === "solo" || s.mode === "cooperative") &&
      s.phase === "choose") ||
      (!s.spellUsed && s.phase === "after"))
  ) {
    const p = s.players[s.mode === "cooperative" ? 0 : s.current];
    for (const spell of s.spells) {
      if (p.full < SPELLS[spell].cost) continue;
      if (["stride", "headwind", "lift", "undertow"].includes(spell)) {
        const ws = spell === "stride" ? 1 : spell === "headwind" ? -1 : 0,
          ts = spell === "lift" ? 2 : spell === "undertow" ? -2 : 0;
        const moves = movesFor(s, ws, ts, true).filter(
          (m) =>
            m.kind === "tower" || s.wizards[m.target].owner === controller(s),
        );
        const m = best(s, moves, memory);
        if (m && value(s, m, memory) >= (m.kind === "wizard" ? 100 : 24))
          return { type: "spell", spell, target: m.target };
      }
      if (spell === "rescue")
        for (const [w, loc] of Object.entries(memory)) {
          if (s.wizards[w]?.owner !== controller(s)) continue;
          const c = s.board[loc.space],
            level = loc.support.startsWith("ground-")
              ? -1
              : c.towers.indexOf(loc.support),
            cover = c.towers[level + 1];
          if (
            cover &&
            cover !== "keep" &&
            (c.towers.at(-1) === "keep" || surface(s, loc.space).length < 6)
          )
            return { type: "spell", spell, target: cover };
        }
    }
  }
  if (s.phase === "after") return { type: "continue" };
  if (s.phase === "choose") {
    let card = hand(s)[0],
      score = -Infinity;
    for (const c of hand(s)) {
      const rolls = c.dice ? Array.from({ length: 6 }, (_, i) => i + 1) : [0];
      const scores = rolls.map((r) => {
        const m = movesFor(
          s,
          c.wizard < 0 ? r : c.wizard,
          c.tower < 0 ? r : c.tower,
        );
        return m.length ? value(s, best(s, m, memory), memory) : -50;
      });
      const v =
        scores.reduce((a, b) => a + b, 0) / scores.length +
        (c.dice ? c.dice * 2 : 0);
      if (v > score) {
        card = c;
        score = v;
      }
    }
    if (s.actions === 0 && s.mode !== "solo" && s.mode !== "cooperative") {
      const m = best(s, movesFor(s, 0, 1), memory);
      if (m && value(s, m, memory) > score + 8) return { type: "refresh" };
    }
    return { type: "play", card: card.id };
  }
  throw new Error("Bot called after game over");
}
