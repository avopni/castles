export type Faction = "Otters" | "Badgers" | "Rats" | "Rabbits";
export type SpellId =
  | "stride"
  | "lift"
  | "headwind"
  | "undertow"
  | "swap"
  | "nudge"
  | "rescue"
  | "piggyback";
export type Mode = "competitive" | "solo" | "cooperative" | "teams";
export type Card = {
  id: number;
  face: number;
  wizard: number;
  tower: number;
  dice: number;
};
export type Wizard = { id: string; owner: number };
export type Tower = { id: string; raven: boolean; residents: string[] };
export type Cell = { towers: string[]; ground: string[]; raven: boolean };
export type Player = {
  name: string;
  faction: Faction;
  bot: boolean;
  hand: Card[];
  empty: number;
  full: number;
  spent: number;
  wizardCount: number;
};
export type Move = {
  kind: "wizard" | "tower";
  target: string;
  steps: number;
  passenger?: string;
};
export type Pending = {
  card: Card | null;
  roll: number | null;
  rerolls: number;
  accepted: boolean;
  refresh: boolean;
  passenger: string | null;
};
export type GameEvent = {
  kind:
    | "move"
    | "capture"
    | "enter"
    | "keep"
    | "spell"
    | "roll"
    | "draw"
    | "turn"
    | "reveal"
    | "miss";
  ids: string[];
  from?: number;
  to?: number;
  steps?: number;
  value?: number;
  text?: string;
};
export type State = {
  version: 1;
  rng: number;
  mode: Mode;
  players: Player[];
  board: Cell[];
  towers: Record<string, Tower>;
  wizards: Record<string, Wizard>;
  entered: string[];
  deck: Card[];
  discard: Card[];
  spells: SpellId[];
  current: number;
  starter: number;
  round: number;
  turns: number[];
  phase: "choose" | "roll" | "move" | "after" | "reaction" | "rescue" | "gameover";
  search?: {tower: string; choices: string[]; resume: "choose" | "roll" | "move" | "after" | "reaction"};
  actions: number;
  spellUsed: boolean;
  exchanged: boolean;
  pending: Pending | null;
  finalRound: boolean;
  winners: number[];
  lost: boolean;
  events: GameEvent[];
  cardsPlayed: number;
  nasty: boolean;
  reaction: {
    stage: "before" | "during" | "after";
    cursor: number;
    passed: number;
  } | null;
  actionSpell: { spell: SpellId; caster: number } | null;
  queued: Move | null;
};
export type Config = {
  players: { name: string; faction: Faction; bot?: boolean }[];
  seed?: number;
  starter?: number;
  spells?: SpellId[];
  mode?: Mode;
  nasty?: boolean;
};
export type Action =
  | { type: "chooseRescue"; wizard: string }
  | { type: "play"; card: number }
  | { type: "reroll" }
  | { type: "accept" }
  | { type: "move"; move: Move }
  | { type: "skip" }
  | { type: "continue" }
  | { type: "refresh" }
  | { type: "mistake"; tower: string }
  | { type: "passReaction" }
  | {
      type: "spell";
      spell: SpellId;
      target?: string;
      other?: string;
      direction?: 1 | -1;
    }
  | { type: "exchange"; give: number; take: number }
  | { type: "givePotion"; count: number; fromPartner?: boolean };
