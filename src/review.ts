import { createGame, reduceGame } from "./engine/game";
import type { State } from "./engine/types";
import { FACTIONS } from "./engine/content";
export const SCREENS = [
  ["table", "At the table"],
  ["setup", "Gather the houses"],
  ["stack", "Choose a tower"],
  ["dice", "Roll & choose"],
  ["movement", "In motion"],
  ["capture", "A potion earned"],
  ["spells", "The spellbook"],
  ["rescue", "Search beneath"],
  ["bot", "A bot’s turn"],
  ["handoff", "Pass the turn"],
  ["tutorial", "Tutorial on"],
  ["final", "The last round"],
  ["victory", "Victory"],
  ["height", "Ten-high stack"],
  ["records", "Saved games"],
  ["capacity", "Six on a roof"],
] as const;
export type Screen = (typeof SCREENS)[number][0];
export function reviewState(screen: Screen): State {
  let s = createGame({
    players: FACTIONS.map((f, i) => ({
      name: f.name,
      faction: f.name,
      bot: i === 2,
    })),
    seed: 1234,
    spells: ["stride", "lift"],
  });
  if (screen === "setup") return s;
  s.round = 6;
  s.players.forEach((p, i) => {
    p.empty = 2 + (i % 2);
    p.full = 5 - p.empty;
  });
  for (const c of s.board) c.towers = [];
  s.board[0].towers = ["keep"];
  s.board[2].towers = ["T1", "T2", "T3"];
  s.board[4].towers = ["T4"];
  s.board[6].towers = ["T5", "T6"];
  s.board[9].towers = ["T7"];
  s.board[12].towers = ["T8", "T9"];
  for (const t of Object.values(s.towers)) t.residents = [];
  const placements: Record<string, string[]> = {
    T1: ["P2-1", "P1-3"],
    T2: ["P3-3"],
    T3: ["P1-1", "P4-1"],
    T4: ["P2-2", "P4-2"],
    T5: ["P3-2"],
    T6: ["P1-2", "P2-3"],
    T7: ["P3-1", "P4-3"],
    T8: ["P2-4"],
    T9: ["P1-4", "P3-4", "P4-4"],
  };
  Object.entries(placements).forEach(([t, w]) => {
    s.towers[t].residents = w;
  });
  if (screen === "capacity") {
    const home = ["P1-1", "P1-2", "P2-1", "P3-1", "P4-1", "P4-2"];
    const roof = ["P1-3", "P1-4", "P2-2", "P3-2", "P4-3", "P4-4"];
    const moved = new Set([...home, ...roof]);
    for (const tower of Object.values(s.towers)) tower.residents = tower.residents.filter(id => !moved.has(id));
    for (const cell of s.board) cell.ground = cell.ground.filter(id => !moved.has(id));
    s.entered = home;
    s.towers.T3.residents = roof;
  }
  // Deliberate illustrative hands, transferred from the real component deck.
  for (const [slot, face] of [15, 7, 20].entries()) {
    const source = s.deck.find((c) => c.face === face);
    if (source) {
      const i = s.deck.indexOf(source);
      const old = s.players[0].hand[slot];
      s.players[0].hand[slot] = source;
      s.deck[i] = old;
    }
  }
  if (screen === "bot") {
    s.current = 2;
  }
  if (screen === "spells" || screen === "rescue")
    s.spells = ["stride", "lift", "rescue"];
  if (screen === "height") {
    s.board.forEach((c) => {
      c.towers = [];
      c.ground = [];
    });
    s.board[6].towers = [
      "T1",
      "T2",
      "T3",
      "T4",
      "T5",
      "T6",
      "T7",
      "T8",
      "T9",
      "keep",
    ];
  }
  if (screen === "capture") {
    s = reduceGame(s, {
      type: "play",
      card: s.players[0].hand.find((c) => c.tower === 2 && !c.dice)!.id,
    });
    s = reduceGame(s, {
      type: "move",
      move: { kind: "tower", target: "T4", steps: 2 },
    });
  }
  if (screen === "final" || screen === "victory") {
    Object.values(s.towers).forEach((t) => {
      t.residents = t.residents.filter((id) => s.wizards[id].owner !== 0);
    });
    s.entered = Object.keys(s.wizards).filter(
      (id) => s.wizards[id].owner === 0,
    );
    s.players[0].empty = 0;
    s.players[0].full = 4;
    s.players[0].spent = 1;
    s.finalRound = true;
    if (screen === "victory") {
      s.phase = "gameover";
      s.winners = [0];
    } else s.current = 1;
  }
  return s;
}
