import type { Card, Faction, SpellId } from "./types";
export const FACTIONS: { name: Faction; color: string; motto: string }[] = [
  { name: "Otters", color: "#54b6ad", motto: "By river and reed" },
  { name: "Badgers", color: "#d6ab65", motto: "Steadfast as stone" },
  { name: "Rats", color: "#bf7180", motto: "Through shadow and thorn" },
  { name: "Rabbits", color: "#9ab37a", motto: "Swift beneath the moon" },
];
export const SPELLS: Record<
  SpellId,
  { name: string; original: string; cost: number; description: string }
> = {
  stride: {
    name: "Fleetfoot",
    original: "Advance a Wizard",
    cost: 2,
    description: "Move a visible traveller one space clockwise.",
  },
  lift: {
    name: "Walking Stone",
    original: "Advance a Turret",
    cost: 1,
    description: "Carry a turret and everything above it two spaces clockwise.",
  },
  headwind: {
    name: "Wayward Wind",
    original: "Headwind for a Wizard",
    cost: 2,
    description: "Move a visible traveller one space counterclockwise.",
  },
  undertow: {
    name: "Stone Tide",
    original: "Headwind for a Turret",
    cost: 1,
    description:
      "Carry a turret and everything above it two spaces counterclockwise.",
  },
  swap: {
    name: "Twinned Turrets",
    original: "Swap a Turret",
    cost: 2,
    description:
      "Exchange the exposed turrets in two spaces, carrying their travellers.",
  },
  nudge: {
    name: "Call the Keep",
    original: "Nudge Ravenskeep",
    cost: 2,
    description: "Move the keep to the next empty surface in either direction.",
  },
  rescue: {
    name: "Unbar the Door",
    original: "Free a Wizard",
    cost: 1,
    description:
      "Choose a turret to search beneath. Bring one of your travellers to the top; a mistaken search still costs a potion.",
  },
  piggyback: {
    name: "Fellowship",
    original: "Piggyback",
    cost: 1,
    description:
      "Bring a second traveller of yours along with a traveller leaving the same surface.",
  },
};
// Component facts transcribed from the licensed BGA adaptation's public material table.
// Independent engine and original artwork; no upstream implementation is incorporated.
const faces: [number, number, number, number][] = [
  [1, 0, 0, 4],
  [2, 0, 0, 4],
  [3, 0, 0, 4],
  [4, 0, 0, 4],
  [5, 0, 0, 4],
  [0, 1, 0, 4],
  [0, 2, 0, 4],
  [0, 3, 0, 4],
  [0, 4, 0, 4],
  [0, 5, 0, 4],
  [1, 1, 0, 3],
  [2, 2, 0, 3],
  [3, 3, 0, 3],
  [4, 4, 0, 3],
  [1, 5, 0, 6],
  [2, 4, 0, 6],
  [4, 2, 0, 6],
  [5, 1, 0, 6],
  [-1, -1, 1, 6],
  [0, -1, 2, 3],
  [-1, 0, 2, 3],
  [0, -1, 3, 1],
  [-1, 0, 3, 1],
];
export function makeDeck(): Card[] {
  let id = 0;
  return faces.flatMap(([wizard, tower, dice, count], i) =>
    Array.from({ length: count }, () => ({
      id: ++id,
      face: i + 1,
      wizard,
      tower,
      dice,
    })),
  );
}
export function cardText(c: Card): string {
  if (c.dice)
    return `${c.wizard ? "Traveller" : ""}${c.wizard && c.tower ? " / " : ""}${c.tower ? "Turret" : ""} · ${c.dice} roll${c.dice > 1 ? "s" : ""}`;
  return [c.wizard && `Traveller ${c.wizard}`, c.tower && `Turret ${c.tower}`]
    .filter(Boolean)
    .join(" / ");
}
