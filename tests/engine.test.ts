import { describe, expect, test } from "vitest";
import { makeDeck, SPELLS } from "../src/engine/content";
import {
  assertInvariants,
  createGame,
  hand,
  legalMoves,
  reduceGame,
  surface,
  towerLocation,
  wizardLocation,
} from "../src/engine/game";
import { chooseBotAction, publicView, remember } from "../src/engine/bot";
import { parseSave, replay, type Record } from "../src/engine/storage";
import type { Card, State } from "../src/engine/types";
const factions = ["Otters", "Badgers", "Rats", "Rabbits"] as const;
function game(n = 4, seed = 12) {
  return createGame({
    players: Array.from({ length: n }, (_, i) => ({
      name: `Seat ${i + 1}`,
      faction: factions[i % 4],
      bot: true,
    })),
    seed,
    spells: Object.keys(SPELLS) as (keyof typeof SPELLS)[],
  });
}
function giveCard(s: State, predicate: (c: Card) => boolean): number {
  const c = [...s.deck, ...s.discard, ...s.players.flatMap((p) => p.hand)].find(
    predicate,
  )!;
  if (!hand(s).includes(c)) {
    const source = s.deck.includes(c)
      ? s.deck
      : s.discard.includes(c)
        ? s.discard
        : s.players.find((p) => p.hand.includes(c))!.hand;
    const i = source.indexOf(c),
      old = hand(s).pop()!;
    source[i] = old;
    hand(s).push(c);
  }
  return c.id;
}
function putWizard(s: State, id: string, space: number, support?: string) {
  for (const c of s.board) c.ground = c.ground.filter((w) => w !== id);
  for (const t of Object.values(s.towers))
    t.residents = t.residents.filter((w) => w !== id);
  s.entered = s.entered.filter((w) => w !== id);
  if (support) s.towers[support].residents.push(id);
  else s.board[space].ground.push(id);
}
function putTower(s: State, id: string, space: number) {
  for (const c of s.board) c.towers = c.towers.filter((t) => t !== id);
  s.board[space].towers.push(id);
}
function potions(s: State, p = 0, full = 5) {
  const total = s.players[p].empty + s.players[p].full;
  s.players[p].empty = total - full;
  s.players[p].full = full;
}
function play(s: State, w: number, t: number) {
  return reduceGame(s, {
    type: "play",
    card: giveCard(s, (c) => !c.dice && c.wizard === w && c.tower === t),
  });
}
function towerMove(s: State, id: string, steps: number) {
  return reduceGame(s, {
    type: "move",
    move: { kind: "tower", target: id, steps },
  });
}
describe("Verified components and setup", () => {
  test("90 cards include asymmetric choice cards and real dice multiplicities", () => {
    const deck = makeDeck();
    expect(deck).toHaveLength(90);
    expect(deck.filter((c) => c.wizard === 1 && c.tower === 5)).toHaveLength(6);
    expect(deck.filter((c) => c.dice === 3)).toHaveLength(2);
    expect(new Set(deck.map((c) => c.id)).size).toBe(90);
  });
  for (const n of [2, 3, 4, 5, 6])
    test(`${n} seats get the published inventories and alternating towers`, () => {
      const s = game(n);
      assertInvariants(s);
      expect(s.players[0].wizardCount).toBe(n === 2 ? 5 : n <= 4 ? 4 : 3);
      expect(s.players[0].empty).toBe(n === 2 ? 6 : n <= 4 ? 5 : 4);
      expect(s.towers.T1.residents).toHaveLength(3);
      expect(s.towers.T2.raven).toBe(false);
      expect(s.players.every((p) => p.hand.length === 3)).toBe(true);
    });
  test("seeded deals reproduce and arbitrary starting seats place in turn order", () => {
    const config = {
      players: [
        { name: "A", faction: "Otters" as const },
        { name: "B", faction: "Badgers" as const },
      ],
      seed: 11,
      starter: 1,
    };
    expect(createGame(config)).toEqual(createGame(config));
    expect(createGame(config).towers.T1.residents[0]).toBe("P2-1");
  });
});
describe("Stack mechanics, exact movement, capture and memory", () => {
  test("lower tower carries higher towers and hidden residents; origin floor stays", () => {
    let s = game();
    putTower(s, "T2", 1);
    putWizard(s, "P1-1", 1, "T1");
    putWizard(s, "P2-1", 1, "T2");
    putWizard(s, "P3-1", 1);
    s = play(s, 0, 2);
    s = towerMove(s, "T1", 2);
    expect(s.board[3].towers.slice(-2)).toEqual(["T1", "T2"]);
    expect(wizardLocation(s, "P1-1")).toMatchObject({
      space: 3,
      visible: false,
    });
    expect(wizardLocation(s, "P3-1")).toMatchObject({
      space: 1,
      visible: true,
    });
  });
  test("capture several characters gives exactly one potion including own", () => {
    let s = game();
    const before = s.players[0].full;
    s = play(s, 0, 1);
    s = towerMove(s, "T1", 1);
    expect(s.players[0].full).toBe(before + 1);
    expect(surface(s, 2)).toEqual(s.towers.T1.residents);
    expect(wizardLocation(s, s.towers.T2.residents[0])!.visible).toBe(false);
  });
  test("moving cover away onto an empty surface reveals residents without filling a potion", () => {
    let s = game();
    putTower(s, "T2", 1);
    putTower(s, "T3", 1);
    putTower(s, "T6", 14);
    const before = s.players[0].full;
    s = play(s, 0, 5);
    s = towerMove(s, "T2", 5);
    expect(wizardLocation(s, s.towers.T1.residents[0])!.visible).toBe(true);
    expect(s.players[0].full).toBe(before);
  });
  test("keep travels with lower towers and is never covered", () => {
    let s = game();
    putTower(s, "keep", 1);
    s = play(s, 0, 2);
    s = towerMove(s, "T1", 2);
    expect(towerLocation(s, "keep").space).toBe(3);
    expect(s.board[3].towers.at(-1)).toBe("keep");
  });
  test("tower may pass the keep but cannot end there", () => {
    let s = game();
    putTower(s, "T1", 15);
    s = play(s, 0, 1);
    expect(legalMoves(s).some((m) => m.target === "T1")).toBe(false);
    expect(() => towerMove(s, "T1", 1)).toThrow();
  });
  test("hidden characters cannot move; visible landing capacity is six", () => {
    let s = game();
    putTower(s, "T2", 1);
    s = play(s, 1, 0);
    expect(legalMoves(s).some((m) => m.target === "P1-1")).toBe(false);
    const ids = Object.keys(s.wizards).slice(1, 7);
    ids.forEach((id) => putWizard(s, id, 12));
    putWizard(s, "P1-1", 11);
    expect(legalMoves(s).some((m) => m.target === "P1-1")).toBe(false);
  });
  test("entering the keep ends the turn and moves it to an empty raven surface", () => {
    let s = game();
    putWizard(s, "P1-1", 15);
    s = play(s, 1, 0);
    s = reduceGame(s, {
      type: "move",
      move: { kind: "wizard", target: "P1-1", steps: 1 },
    });
    expect(s.entered).toContain("P1-1");
    expect(s.current).toBe(1);
    expect(s.phase).toBe("choose");
    expect(towerLocation(s, "keep").space).toBe(9);
    expect(s.players[0].hand).toHaveLength(3);
  });
  test("overshooting the keep does not enter it", () => {
    let s = game();
    putWizard(s, "P1-1", 15);
    s = play(s, 2, 0);
    s = reduceGame(s, {
      type: "move",
      move: { kind: "wizard", target: "P1-1", steps: 2 },
    });
    expect(s.entered).not.toContain("P1-1");
    expect(wizardLocation(s, "P1-1")!.space).toBe(1);
  });
  test("refresh replaces two actions and advances a tower exactly one", () => {
    let s = game();
    s = reduceGame(s, { type: "refresh" });
    s = towerMove(s, "T1", 1);
    s = reduceGame(s, { type: "continue" });
    expect(s.current).toBe(1);
    expect(s.players[0].hand).toHaveLength(3);
    expect(s.players[0].full).toBe(1);
  });
  test("cannot skip a legal card or refresh after one action", () => {
    let s = play(game(), 0, 1);
    expect(() => reduceGame(s, { type: "skip" })).toThrow();
    s = towerMove(s, "T1", 1);
    s = reduceGame(s, { type: "continue" });
    expect(() => reduceGame(s, { type: "refresh" })).toThrow();
  });
  test("die rerolls replace results and target choice follows acceptance", () => {
    let s = game();
    s = reduceGame(s, {
      type: "play",
      card: giveCard(s, (c) => c.dice === 3 && c.tower !== 0),
    });
    expect(s.phase).toBe("roll");
    expect(legalMoves(s)).toHaveLength(0);
    s = reduceGame(s, { type: "reroll" });
    s = reduceGame(s, { type: "reroll" });
    expect(() => reduceGame(s, { type: "reroll" })).toThrow();
    s = reduceGame(s, { type: "accept" });
    expect(legalMoves(s).every((m) => m.steps === s.pending!.roll)).toBe(true);
  });
});
describe("All eight spells and final round", () => {
  test("potions spent disappear and continue to satisfy the filled objective", () => {
    let s = game();
    potions(s);
    s = reduceGame(s, { type: "spell", spell: "lift", target: "T1" });
    expect(s.players[0]).toMatchObject({ spent: 1, empty: 0 });
    expect(() =>
      reduceGame(s, { type: "spell", spell: "stride", target: "P1-1" }),
    ).toThrow();
  });
  test("counterclockwise spells wrap the track", () => {
    let s = game();
    potions(s);
    putWizard(s, "P1-1", 10);
    s = reduceGame(s, { type: "spell", spell: "headwind", target: "P1-1" });
    expect(wizardLocation(s, "P1-1")!.space).toBe(9);
    let t = game();
    potions(t);
    t = reduceGame(t, { type: "spell", spell: "undertow", target: "T1" });
    expect(towerLocation(t, "T1").space).toBe(15);
  });
  test("swap moves exposed towers with their residents and no capture award", () => {
    let s = game();
    potions(s);
    const residents = [...s.towers.T1.residents];
    s = reduceGame(s, {
      type: "spell",
      spell: "swap",
      target: "T1",
      other: "T2",
    });
    expect(s.board[2].towers.at(-1)).toBe("T1");
    expect(s.towers.T1.residents).toEqual(residents);
    expect(s.players[0].full).toBe(3);
    expect(s.events.some((e) => e.kind === "capture")).toBe(false);
  });
  test("nudge needs no raven shield", () => {
    let s = game();
    potions(s);
    s = reduceGame(s, { type: "spell", spell: "nudge", direction: -1 });
    expect(towerLocation(s, "keep").space).toBe(15);
  });
  test("rescue searches directly beneath the selected tower, and wrong guesses cost", () => {
    let s = game();
    potions(s);
    putTower(s, "T2", 1);
    s = reduceGame(s, { type: "spell", spell: "rescue", target: "T2" });
    expect(wizardLocation(s, "P1-1")!.visible).toBe(true);
    expect(s.players[0].spent).toBe(1);
    let t = game();
    potions(t);
    t = reduceGame(t, { type: "spell", spell: "rescue", target: "T9" });
    expect(t.events.some((e) => e.kind === "miss")).toBe(true);
    expect(t.players[0].spent).toBe(1);
  });
  test("rescue beneath a keep stack enters and ends the turn", () => {
    let s = game();
    potions(s);
    putTower(s, "T2", 1);
    putTower(s, "keep", 1);
    s = reduceGame(s, { type: "spell", spell: "rescue", target: "T2" });
    expect(s.entered).toContain("P1-1");
    expect(s.current).toBe(1);
  });
  test("piggyback is simultaneous and respects capacity", () => {
    let s = game();
    potions(s);
    putWizard(s, "P1-2", 1, "T1");
    s = play(s, 1, 0);
    s = reduceGame(s, { type: "spell", spell: "piggyback", target: "P1-2" });
    const m = legalMoves(s).find((m) => m.target === "P1-1")!;
    expect(m.passenger).toBe("P1-2");
    s = reduceGame(s, { type: "move", move: m });
    expect(wizardLocation(s, "P1-1")!.space).toBe(2);
    expect(wizardLocation(s, "P1-2")!.space).toBe(2);
  });
  test("end waits until everyone has equal turns, then full potions break ties", () => {
    let s = game(2);
    potions(s, 0, 6);
    potions(s, 1, 6);
    for (const id of Object.keys(s.wizards)) {
      putWizard(s, id, 12);
      s.board[12].ground = s.board[12].ground.filter((w) => w !== id);
      s.entered.push(id);
    }
    s.players[1].full = 5;
    s.players[1].spent = 1;
    s = reduceGame(s, { type: "refresh" });
    s = towerMove(s, "T1", 1);
    expect(s.finalRound).toBe(true);
    s = reduceGame(s, { type: "continue" });
    expect(s.phase).not.toBe("gameover");
    s = reduceGame(s, { type: "refresh" });
    s = towerMove(s, "T2", 1);
    s = reduceGame(s, { type: "continue" });
    expect(s.phase).toBe("gameover");
    expect(s.turns).toEqual([1, 1]);
    expect(s.winners).toEqual([0]);
  });
});
describe("Variants, persistence and bots", () => {
  test("committing a tower blocked by the keep consumes the turn without moving it", () => {
    let s = game();
    putTower(s, "T1", 15);
    s = play(s, 0, 1);
    s = reduceGame(s, { type: "mistake", tower: "T1" });
    expect(s.current).toBe(1);
    expect(towerLocation(s, "T1").space).toBe(15);
    expect(s.players[0].hand).toHaveLength(3);
  });
  test("cooperative players share the hand and the twelve travellers", () => {
    let s = createGame({
      players: [
        { name: "A", faction: "Otters" },
        { name: "B", faction: "Badgers" },
      ],
      mode: "cooperative",
      seed: 1,
    });
    expect(s.players[1].hand).toHaveLength(0);
    s = play(s, 0, 1);
    s = towerMove(s, "T1", 1);
    s = reduceGame(s, { type: "continue" });
    expect(s.current).toBe(1);
    expect(hand(s)).toHaveLength(3);
    expect(Object.keys(s.wizards)).toHaveLength(12);
  });
  test("solo loses immediately when the last deck card is drawn", () => {
    let s = createGame({
      players: [{ name: "A", faction: "Otters" }],
      mode: "solo",
      seed: 1,
    });
    s.discard.push(...s.deck.splice(1));
    s = play(s, 0, 1);
    s = towerMove(s, "T1", 1);
    s = reduceGame(s, { type: "continue" });
    expect(s.deck).toHaveLength(0);
    expect(s.lost).toBe(true);
    expect(s.phase).toBe("gameover");
  });
  test("solo uses twelve travellers, one action and no potion requirement without spells", () => {
    let s = createGame({
      players: [{ name: "Solo", faction: "Otters" }],
      mode: "solo",
      seed: 1,
    });
    expect(Object.keys(s.wizards)).toHaveLength(12);
    expect(s.players[0].empty).toBe(0);
    s = play(s, 0, 1);
    s = towerMove(s, "T1", 1);
    s = reduceGame(s, { type: "continue" });
    expect(s.round).toBe(2);
    expect(s.actions).toBe(0);
  });
  test("team swaps once per turn and can share full potions", () => {
    let s = createGame({
      players: Array.from({ length: 4 }, (_, i) => ({
        name: String(i),
        faction: factions[i],
      })),
      mode: "teams",
      seed: 1,
    });
    const give = s.players[0].hand[0].id,
      take = s.players[2].hand[0].id;
    s = reduceGame(s, { type: "exchange", give, take });
    expect(s.players[0].hand.some((c) => c.id === take)).toBe(true);
    expect(() =>
      reduceGame(s, { type: "exchange", give: take, take: give }),
    ).toThrow();
    potions(s, 0, 2);
    s = reduceGame(s, { type: "givePotion", count: 1 });
    expect(s.players[2].full).toBe(1);
  });
  test("public bot view hides other hands, deck, RNG and covered residents", () => {
    let s = game();
    putTower(s, "T2", 1);
    const view = publicView(s);
    expect(view.players[1].hand).toHaveLength(0);
    expect(view.deck).toHaveLength(0);
    expect(view.towers.T1.residents).toHaveLength(0);
    expect(view.rng).toBe(1);
  });
  test("replay and import produce the same state and reject malformed saves", () => {
    const initial = game();
    const actions = [
      { type: "refresh" as const },
      {
        type: "move" as const,
        move: { kind: "tower" as const, target: "T1", steps: 1 },
      },
      { type: "continue" as const },
    ];
    const r: Record = {
      format: "cascading-castles",
      version: 1,
      initial,
      actions,
      savedAt: "2026-10-03",
    };
    expect(replay(parseSave(JSON.stringify(r)))).toEqual(
      actions.reduce(reduceGame, initial),
    );
    expect(() => parseSave('{"version":99}')).toThrow();
  });
  for (const n of [2, 3, 4])
    test(`complete seeded ${n}-seat bot games conserve every component`, () => {
      for (const seed of [7, 31, 83]) {
        let s = game(n, seed),
          memories = s.players.map(() => remember(s)),
          count = 0;
        while (s.phase !== "gameover" && count++ < 8000) {
          memories = memories.map((m) => remember(s, m));
          s = reduceGame(s, chooseBotAction(s, memories[s.current]));
          assertInvariants(s);
        }
        expect(s.phase, `seed ${seed}, ${count} actions`).toBe("gameover");
        expect(s.winners.length).toBeGreaterThan(0);
      }
    }, 60000);
});
describe("Interrupt-spell variant", () => {
  function nasty() {
    return createGame({
      players: [
        { name: "A", faction: "Otters" },
        { name: "B", faction: "Badgers" },
      ],
      seed: 5,
      spells: Object.keys(SPELLS) as (keyof typeof SPELLS)[],
      nasty: true,
    });
  }
  function passWindow(s: State) {
    while (s.phase === "reaction") s = reduceGame(s, { type: "passReaction" });
    return s;
  }
  test("priority begins with active player, then proceeds clockwise", () => {
    let s = nasty();
    potions(s, 1, 4);
    s = play(s, 0, 1);
    expect(s.reaction!.cursor).toBe(0);
    s = reduceGame(s, { type: "passReaction" });
    expect(s.reaction!.cursor).toBe(1);
    s = reduceGame(s, { type: "spell", spell: "lift", target: "T8" });
    expect(s.players[1].spent).toBe(1);
    s = reduceGame(s, { type: "spell", spell: "lift", target: "T8" });
    expect(s.players[1].spent).toBe(2);
    expect(() =>
      reduceGame(s, { type: "spell", spell: "nudge", direction: 1 }),
    ).toThrow();
    s = passWindow(s);
    expect(s.phase).toBe("move");
  });
  test("an interrupt can invalidate a committed wizard move without restoring the card", () => {
    let s = nasty();
    potions(s, 1, 2);
    putWizard(s, "P1-1", 15);
    s = passWindow(play(s, 1, 0));
    s = reduceGame(s, {
      type: "move",
      move: { kind: "wizard", target: "P1-1", steps: 1 },
    });
    s = reduceGame(s, { type: "passReaction" });
    s = reduceGame(s, { type: "spell", spell: "undertow", target: "T1" });
    s = passWindow(s);
    s = passWindow(s);
    expect(s.discard).toHaveLength(1);
    expect(s.phase).toBe("after");
    expect(wizardLocation(s, "P1-1")!.visible).toBe(false);
    assertInvariants(s);
  });
  test("off-turn piggyback carries the caster’s traveller simultaneously into the keep", () => {
    let s = nasty();
    potions(s, 1, 1);
    putWizard(s, "P1-1", 15);
    putWizard(s, "P2-1", 15);
    s = passWindow(play(s, 1, 0));
    s = reduceGame(s, {
      type: "move",
      move: { kind: "wizard", target: "P1-1", steps: 1 },
    });
    s = reduceGame(s, { type: "passReaction" });
    s = reduceGame(s, { type: "spell", spell: "piggyback", target: "P2-1" });
    s = passWindow(s);
    expect(s.entered).toEqual(expect.arrayContaining(["P1-1", "P2-1"]));
    expect(s.current).toBe(1);
    expect(s.players[1].spent).toBe(1);
    assertInvariants(s);
  });
});
