import { makeDeck, SPELLS } from "./content";
import { random, shuffle } from "./random";
import type { Action, Config, Move, SpellId, State } from "./types";
export const mod = (n: number) => ((n % 16) + 16) % 16;
const requireRule = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message);
};
export function towerLocation(
  s: State,
  id: string,
): { space: number; level: number } {
  for (let space = 0; space < 16; space++) {
    const level = s.board[space].towers.indexOf(id);
    if (level >= 0) return { space, level };
  }
  throw new Error("Turret not found");
}
export function surface(s: State, space: number): string[] {
  const c = s.board[space],
    top = c.towers.at(-1);
  return top === "keep" ? [] : top ? s.towers[top].residents : c.ground;
}
export function wizardLocation(
  s: State,
  id: string,
): { space: number; support: string; visible: boolean } | null {
  if (s.entered.includes(id)) return null;
  for (let space = 0; space < 16; space++) {
    const c = s.board[space];
    if (c.ground.includes(id))
      return {
        space,
        support: `ground-${space}`,
        visible: c.towers.length === 0,
      };
    for (const t of c.towers)
      if (s.towers[t].residents.includes(id))
        return { space, support: t, visible: c.towers.at(-1) === t };
  }
  return null; // Public observations deliberately omit hidden residents.
}
export const partner = (s: State, p: number) =>
  s.mode === "teams" ? (p + s.players.length / 2) % s.players.length : null;
export function controller(s: State): number {
  if (s.mode === "solo" || s.mode === "cooperative") return 0;
  const p = s.current,
    mate = partner(s, p);
  return mate !== null &&
    s.entered.filter((id) => s.wizards[id].owner === p).length ===
      s.players[p].wizardCount
    ? mate
    : p;
}
export function hand(s: State) {
  return s.players[s.mode === "cooperative" ? 0 : s.current].hand;
}
const caster = (s: State) =>
  s.mode === "cooperative"
    ? 0
    : s.phase === "reaction" && s.reaction
      ? s.reaction.cursor
      : s.current;
function actor(s: State) {
  return s.players[caster(s)];
}
function spellOwner(s: State) {
  const p = caster(s);
  return p === s.current ? controller(s) : p;
}
function draw(s: State) {
  const p = actor(s),
    ids: string[] = [];
  while (p.hand.length < 3) {
    if (!s.deck.length) {
      if (s.mode === "solo" || s.mode === "cooperative") {
        s.lost = true;
        s.phase = "gameover";
        break;
      }
      s.deck = shuffle(s, s.discard);
      s.discard = [];
    }
    const card = s.deck.pop();
    if (!card) break;
    p.hand.push(card);
    ids.push(String(card.id));
    if (!s.deck.length && (s.mode === "solo" || s.mode === "cooperative")) {
      s.lost = true;
      s.phase = "gameover";
      break;
    }
  }
  if (ids.length) s.events.push({ kind: "draw", ids });
}
export function createGame(config: Config): State {
  const mode = config.mode ?? "competitive",
    n = config.players.length;
  requireRule(n >= 1 && n <= 6, "Choose one to six seats.");
  requireRule(
    mode !== "competitive" || n >= 2,
    "Competitive games need at least two seats.",
  );
  requireRule(
    mode !== "teams" || n === 4 || n === 6,
    "Partnership games need four or six seats.",
  );
  requireRule(mode !== "solo" || n === 1, "Solo mode has one seat.");
  requireRule(
    !config.nasty || mode === "competitive" || mode === "teams",
    "Interrupt spells are a multiplayer competitive variant.",
  );
  const shared = mode === "solo" || mode === "cooperative",
    starter = config.starter ?? 0;
  requireRule(starter >= 0 && starter < n, "Invalid starting seat.");
  const wizardCount = shared ? 12 : n === 2 ? 5 : n <= 4 ? 4 : 3;
  const spells = config.spells ?? (shared ? [] : ["stride", "lift"]);
  requireRule(
    new Set(spells).size === spells.length &&
      spells.every((id) => id in SPELLS),
    "Invalid spell selection.",
  );
  requireRule(
    !shared || spells.length === 0 || spells.length === 3,
    "Solo/cooperative games use zero or three spells.",
  );
  const s: State = {
    nasty: !!config.nasty,
    reaction: null,
    actionSpell: null,
    queued: null,
    version: 1,
    rng: (config.seed ?? Date.now()) >>> 0 || 1,
    mode,
    players: config.players.map((p, i) => ({
      ...p,
      bot: !!p.bot,
      hand: [],
      empty: shared
        ? i === 0 && spells.length
          ? 6
          : 0
        : n === 2
          ? 6
          : n <= 4
            ? 5
            : 4,
      full: 0,
      spent: 0,
      wizardCount: shared ? (i === 0 ? 12 : 0) : wizardCount,
    })),
    board: Array.from({ length: 16 }, (_, i) => ({
      towers: [],
      ground: [],
      raven: i % 4 === 0,
    })),
    towers: { keep: { id: "keep", raven: true, residents: [] } },
    wizards: {},
    entered: [],
    deck: [],
    discard: [],
    spells: [...spells],
    current: starter,
    starter,
    round: 1,
    turns: Array(n).fill(0),
    phase: "choose",
    actions: 0,
    spellUsed: false,
    exchanged: false,
    pending: null,
    finalRound: false,
    winners: [],
    lost: false,
    events: [],
    cardsPlayed: 0,
  };
  Object.assign(s, {
    nasty: !!config.nasty,
    reaction: null,
    actionSpell: null,
    queued: null,
  });
  s.board[0].towers = ["keep"];
  for (let i = 1; i <= 9; i++) {
    const id = `T${i}`;
    s.towers[id] = { id, raven: i % 2 === 1, residents: [] };
    s.board[i].towers = [id];
  }
  const queue: string[] = [];
  for (let w = 0; w < wizardCount; w++)
    for (let j = 0; j < (shared ? 1 : n); j++) {
      const owner = shared ? 0 : (starter + j) % n,
        id = `P${owner + 1}-${w + 1}`;
      s.wizards[id] = { id, owner };
      queue.push(id);
    }
  let at = 0;
  for (let i = 1; i <= 9; i++)
    for (let j = 0; j < (i <= 3 ? 3 : i <= 6 ? 2 : 1) && at < queue.length; j++)
      s.towers[`T${i}`].residents.push(queue[at++]);
  s.deck = shuffle(s, makeDeck());
  if (shared) {
    const current = s.current;
    s.current = 0;
    draw(s);
    s.current = current;
  } else
    for (let p = 0; p < n; p++) {
      s.current = p;
      draw(s);
    }
  s.current = starter;
  s.events = [];
  return s;
}
function eligibleWizard(s: State, id: string, any = false): boolean {
  return (
    !!s.wizards[id] &&
    !!wizardLocation(s, id)?.visible &&
    (any || s.wizards[id].owner === controller(s))
  );
}
export function validMove(s: State, m: Move, anyWizard = false): boolean {
  if (!Number.isInteger(m.steps) || m.steps === 0) return false;
  if (m.kind === "tower") {
    if (m.target === "keep" || !s.towers[m.target]) return false;
    const from = towerLocation(s, m.target).space,
      to = mod(from + m.steps);
    return to !== from && !s.board[to].towers.includes("keep");
  }
  if (!eligibleWizard(s, m.target, anyWizard)) return false;
  const from = wizardLocation(s, m.target)!,
    to = mod(from.space + m.steps);
  if (m.passenger) {
    const other = wizardLocation(s, m.passenger);
    if (
      m.passenger === m.target ||
      !other?.visible ||
      other.support !== from.support ||
      s.wizards[m.passenger].owner !== controller(s)
    )
      return false;
  }
  return (
    s.board[to].towers.at(-1) === "keep" ||
    surface(s, to).length +
      (m.passenger ? 2 : 1) -
      (to === from.space ? (m.passenger ? 2 : 1) : 0) <=
      6
  );
}
export function movesFor(
  s: State,
  wizardSteps: number,
  towerSteps: number,
  anyWizard = false,
): Move[] {
  const out: Move[] = [];
  if (wizardSteps)
    for (const id of Object.keys(s.wizards)) {
      const m: Move = {
        kind: "wizard",
        target: id,
        steps: wizardSteps,
        ...(s.pending?.passenger ? { passenger: s.pending.passenger } : {}),
      };
      if (validMove(s, m, anyWizard)) out.push(m);
    }
  if (towerSteps && !s.pending?.passenger)
    for (const id of Object.keys(s.towers)) {
      const m: Move = { kind: "tower", target: id, steps: towerSteps };
      if (validMove(s, m)) out.push(m);
    }
  return out;
}
export function legalMoves(s: State): Move[] {
  const p = s.pending;
  if (!p || !p.accepted) return [];
  if (p.refresh) return movesFor(s, 0, 1);
  const c = p.card!;
  return movesFor(
    s,
    c.wizard < 0 ? p.roll! : c.wizard,
    c.tower < 0 ? p.roll! : c.tower,
  );
}
function detachWizard(s: State, id: string) {
  const loc = wizardLocation(s, id)!;
  const a = loc.support.startsWith("ground-")
    ? s.board[loc.space].ground
    : s.towers[loc.support].residents;
  a.splice(a.indexOf(id), 1);
}
function keepMove(s: State, direction: 1 | -1, ravenOnly: boolean) {
  const old = towerLocation(s, "keep").space;
  for (let d = 1; d < 16; d++) {
    const to = mod(old + d * direction),
      c = s.board[to],
      top = c.towers.at(-1);
    if (
      surface(s, to).length === 0 &&
      (!ravenOnly || (top ? s.towers[top].raven : c.raven))
    ) {
      s.board[old].towers.pop();
      c.towers.push("keep");
      s.events.push({
        kind: "keep",
        ids: ["keep"],
        from: old,
        to,
        steps: d * direction,
      });
      return;
    }
  }
}
function capture(s: State, ids: string[]) {
  if (!ids.length) return;
  const p = actor(s);
  let recipient = caster(s);
  if (!p.empty) {
    const mate = partner(s, caster(s));
    if (mate !== null && s.players[mate].empty) recipient = mate;
  }
  const potions = s.players[recipient];
  if (potions.empty) {
    potions.empty--;
    potions.full++;
  }
  s.events.push({ kind: "capture", ids: [...ids], value: recipient });
}
function executeMove(s: State, m: Move) {
  const from =
      m.kind === "tower"
        ? towerLocation(s, m.target).space
        : wizardLocation(s, m.target)!.space,
    to = mod(from + m.steps);
  if (m.kind === "tower") {
    const level = towerLocation(s, m.target).level,
      ids = s.board[from].towers.splice(level),
      covered = [...surface(s, to)];
    s.board[to].towers.push(...ids);
    s.events.push({ kind: "move", ids, from, to, steps: m.steps });
    capture(s, covered);
    const exposed = surface(s, from);
    if (exposed.length)
      s.events.push({ kind: "reveal", ids: [...exposed], from });
    return false;
  }
  const ids = [m.target, ...(m.passenger ? [m.passenger] : [])];
  ids.forEach((id) => detachWizard(s, id));
  s.events.push({ kind: "move", ids, from, to, steps: m.steps });
  if (s.board[to].towers.at(-1) === "keep") {
    s.entered.push(...ids);
    s.events.push({ kind: "enter", ids, to });
    keepMove(s, 1, true);
    return true;
  }
  surface(s, to).push(...ids);
  return false;
}
function qualified(s: State, p: number) {
  return (
    s.players[p].empty === 0 &&
    s.entered.filter((id) => s.wizards[id].owner === p).length ===
      s.players[p].wizardCount
  );
}
function groups(s: State): number[][] {
  if (s.mode === "teams")
    return Array.from({ length: s.players.length / 2 }, (_, i) => [
      i,
      i + s.players.length / 2,
    ]);
  if (s.mode === "solo" || s.mode === "cooperative") return [[0]];
  return s.players.map((_, i) => [i]);
}
function checkEnd(s: State) {
  const candidates = groups(s).filter((g) => g.every((p) => qualified(s, p)));
  if (!candidates.length) return;
  s.finalRound = true;
  if (s.mode === "solo" || s.mode === "cooperative") {
    s.winners = s.players.map((_, i) => i);
    s.phase = "gameover";
  }
}
function finishTurn(s: State) {
  s.reaction = null;
  s.queued = null;
  s.actionSpell = null;
  s.pending = null;
  checkEnd(s);
  if (s.phase === "gameover") return;
  s.turns[s.current]++;
  draw(s);
  if (s.lost) return;
  const next = (s.current + 1) % s.players.length;
  if (next === s.starter && s.finalRound) {
    const candidates = groups(s).filter((g) => g.every((p) => qualified(s, p))),
      best = Math.max(
        ...candidates.map((g) => g.reduce((v, p) => v + s.players[p].full, 0)),
      );
    s.winners = candidates
      .filter((g) => g.reduce((v, p) => v + s.players[p].full, 0) === best)
      .flat();
    s.phase = "gameover";
    return;
  }
  if (next === s.starter) s.round++;
  s.current = next;
  s.actions = 0;
  s.spellUsed = false;
  s.exchanged = false;
  s.pending = null;
  s.phase = "choose";
  s.events.push({ kind: "turn", ids: [], value: next });
}
function windowFor(s: State, stage: "before" | "during" | "after") {
  s.phase = "reaction";
  s.reaction = { stage, cursor: s.actionSpell?.caster ?? s.current, passed: 0 };
}
function afterMove(s: State, entered: boolean) {
  s.pending = null;
  if (entered) finishTurn(s);
  else {
    s.phase = "after";
    checkEnd(s);
    if (s.nasty && !s.winners.length) windowFor(s, "after");
  }
}
function spend(s: State, id: SpellId) {
  if (s.nasty) {
    requireRule(
      s.phase === "reaction",
      "Cast interrupt spells in a reaction window.",
    );
    requireRule(
      !s.actionSpell ||
        (s.actionSpell.spell === id && s.actionSpell.caster === caster(s)),
      "Only one spell and one caster per action.",
    );
  } else requireRule(!s.spellUsed, "One spell per turn.");
  requireRule(s.spells.includes(id), "That spell is not in this game.");
  const p = actor(s),
    cost = SPELLS[id].cost;
  requireRule(p.full >= cost, "Not enough full potions.");
  if (s.mode === "solo" || s.mode === "cooperative")
    requireRule(
      s.actions === 1 && s.phase === "after",
      "Cast after the movement card in this mode.",
    );
  p.full -= cost;
  p.spent += cost;
  s.spellUsed = true;
  if (s.nasty) s.actionSpell = { spell: id, caster: caster(s) };
  s.events.push({ kind: "spell", ids: [], text: id });
}
function cast(s: State, a: Extract<Action, { type: "spell" }>) {
  const id = a.spell;
  if (id === "piggyback") {
    if (s.nasty) {
      requireRule(
        s.reaction?.stage === "during" && s.queued?.kind === "wizard",
        "Fellowship needs a committed traveller move.",
      );
      const w = a.target ?? "",
        move = s.queued!,
        loc = wizardLocation(s, w),
        from = wizardLocation(s, move.target);
      requireRule(
        w !== move.target &&
          s.wizards[w]?.owner === spellOwner(s) &&
          loc?.visible &&
          loc.support === from?.support,
        "The passenger must belong to the caster and share the departing surface.",
      );
      const to = mod(from!.space + move.steps);
      requireRule(
        s.board[to].towers.at(-1) === "keep" || surface(s, to).length + 2 <= 6,
        "No room for the passenger.",
      );
      requireRule(
        !move.passenger,
        "Only one passenger can join this movement.",
      );
      spend(s, id);
      move.passenger = w;
      return;
    }
    requireRule(
      s.phase === "move" && !s.pending?.refresh,
      "Select Fellowship after the final die result and before moving.",
    );
    const wizard = a.target,
      loc = wizard ? wizardLocation(s, wizard) : null;
    requireRule(
      wizard &&
        eligibleWizard(s, wizard) &&
        movesFor(
          s,
          s.pending!.card!.wizard < 0
            ? s.pending!.roll!
            : s.pending!.card!.wizard,
          0,
        ).some(
          (m) =>
            m.target !== wizard &&
            wizardLocation(s, m.target)?.support === loc?.support &&
            validMove(s, { ...m, passenger: wizard }),
        ),
      "Choose a traveller sharing a surface with a legal moving traveller.",
    );
    spend(s, id);
    s.pending!.passenger = wizard!;
    return;
  }
  if (["stride", "headwind", "lift", "undertow"].includes(id)) {
    const kind = id === "stride" || id === "headwind" ? "wizard" : "tower",
      steps =
        id === "stride" ? 1 : id === "headwind" ? -1 : id === "lift" ? 2 : -2;
    const m: Move = { kind, target: a.target ?? "", steps };
    requireRule(validMove(s, m, true), "Illegal spell target.");
    spend(s, id);
    const entered = executeMove(s, m);
    if (entered) finishTurn(s);
    else checkEnd(s);
    return;
  }
  if (id === "nudge") {
    requireRule(a.direction === 1 || a.direction === -1, "Choose a direction.");
    spend(s, id);
    keepMove(s, a.direction!, false);
    return;
  }
  if (id === "swap") {
    const first = a.target ?? "",
      second = a.other ?? "";
    requireRule(
      first !== second &&
        first !== "keep" &&
        second !== "keep" &&
        s.towers[first] &&
        s.towers[second],
      "Choose two distinct exposed turrets.",
    );
    const A = towerLocation(s, first),
      B = towerLocation(s, second);
    requireRule(
      s.board[A.space].towers.at(-1) === first &&
        s.board[B.space].towers.at(-1) === second,
      "Only top turrets can be swapped.",
    );
    spend(s, id);
    s.board[A.space].towers.pop();
    s.board[B.space].towers.pop();
    s.board[A.space].towers.push(second);
    s.board[B.space].towers.push(first);
    s.events.push(
      { kind: "move", ids: [first], from: A.space, to: B.space },
      { kind: "move", ids: [second], from: B.space, to: A.space },
    );
    return;
  }
  const t = a.target ?? "";
  requireRule(
    t !== "keep" && !!s.towers[t],
    "Choose a turret to search beneath.",
  );
  const loc = towerLocation(s, t),
    c = s.board[loc.space],
    below =
      loc.level === 0 ? c.ground : s.towers[c.towers[loc.level - 1]].residents;
  const allowed = [
    spellOwner(s),
    ...(partner(s, caster(s)) === null ? [] : [partner(s, caster(s))!]),
  ];
  const choices = below.filter((w) => allowed.includes(s.wizards[w].owner));
  requireRule(
    !a.other || choices.includes(a.other),
      "That traveller is not immediately beneath the selected turret.",
  );
  const keep = c.towers.at(-1) === "keep";
  requireRule(
    keep || !choices.length || surface(s, loc.space).length < 6,
    "The destination is full.",
  );
  spend(s, id);
  if (choices.length > 1 && !a.other) {
    s.search = {tower:t, choices, resume:s.phase as NonNullable<State['search']>['resume']};
    s.phase = 'rescue';
    return;
  }
  const w = a.other ?? choices[0];
  if (!w) {
    s.events.push({ kind: "miss", ids: [t] });
    return;
  }
  detachWizard(s, w);
  s.events.push({ kind: "reveal", ids: [w], from: loc.space });
  if (keep) {
    s.entered.push(w);
    s.events.push({ kind: "enter", ids: [w], to: loc.space });
    keepMove(s, 1, true);
    finishTurn(s);
  } else surface(s, loc.space).push(w);
}
export function reduceGame(original: State, a: Action): State {
  requireRule(original.phase !== "gameover", "The game is finished.");
  const s = structuredClone(original);
  s.events = [];
  if (s.phase === 'rescue') {
    requireRule(a.type === 'chooseRescue', 'Choose the traveller found in the search.');
    const choice = a as Extract<Action,{type:'chooseRescue'}>;
    requireRule(s.search?.choices.includes(choice.wizard), 'That traveller was not found in this search.');
    const search=s.search!,space=towerLocation(s,search.tower).space;
    s.phase=search.resume;delete s.search;
    detachWizard(s,choice.wizard);
    s.events.push({kind:'reveal',ids:[choice.wizard],from:space});
    if(s.board[space].towers.at(-1)==='keep'){
      s.entered.push(choice.wizard);s.events.push({kind:'enter',ids:[choice.wizard],to:space});keepMove(s,1,true);finishTurn(s);
    } else surface(s,space).push(choice.wizard);
    assertInvariants(s);
    return s;
  }
  if (a.type === "play") {
    requireRule(s.phase === "choose", "Finish the current action first.");
    const cards = hand(s),
      index = cards.findIndex((c) => c.id === a.card);
    requireRule(index >= 0, "Card not in hand.");
    const card = cards.splice(index, 1)[0];
    s.discard.push(card);
    s.cardsPlayed++;
    s.actions++;
    s.pending = {
      card,
      roll: card.dice ? Math.floor(random(s) * 6) + 1 : null,
      rerolls: Math.max(0, card.dice - 1),
      accepted: !card.dice,
      refresh: false,
      passenger: null,
    };
    s.phase = card.dice ? "roll" : "move";
    if (card.dice)
      s.events.push({ kind: "roll", ids: [], value: s.pending.roll! });
    s.actionSpell = null;
    if (s.nasty) windowFor(s, "before");
  } else if (a.type === "reroll") {
    requireRule(
      s.phase === "roll" && s.pending && s.pending.rerolls > 0,
      "No rerolls remaining.",
    );
    s.pending!.roll = Math.floor(random(s) * 6) + 1;
    s.pending!.rerolls--;
    s.events.push({ kind: "roll", ids: [], value: s.pending!.roll! });
  } else if (a.type === "accept") {
    requireRule(s.phase === "roll", "No roll to accept.");
    s.pending!.accepted = true;
    s.phase = "move";
  } else if (a.type === "move") {
    requireRule(s.phase === "move", "Play a card first.");
    requireRule(
      legalMoves(s).some(
        (m) =>
          m.kind === a.move.kind &&
          m.target === a.move.target &&
          m.steps === a.move.steps &&
          m.passenger === a.move.passenger,
      ),
      "That move does not match the played card.",
    );
    if (s.nasty) {
      s.queued = { ...a.move };
      windowFor(s, "during");
    } else afterMove(s, executeMove(s, a.move));
  } else if (a.type === "skip") {
    requireRule(
      s.phase === "move" && legalMoves(s).length === 0,
      "A card must be used when a legal move exists.",
    );
    afterMove(s, false);
  } else if (a.type === "continue") {
    requireRule(s.phase === "after", "Finish the move first.");
    const limit = s.mode === "solo" || s.mode === "cooperative" ? 1 : 2;
    if (s.actions >= limit) finishTurn(s);
    else s.phase = "choose";
  } else if (a.type === "refresh") {
    requireRule(
      s.mode !== "solo" &&
        s.mode !== "cooperative" &&
        s.phase === "choose" &&
        s.actions === 0,
      "Refreshing replaces both card actions.",
    );
    s.discard.push(...hand(s).splice(0));
    s.actions = 2;
    s.pending = {
      card: null,
      roll: null,
      rerolls: 0,
      accepted: true,
      refresh: true,
      passenger: null,
    };
    s.phase = "move";
    s.actionSpell = null;
    if (s.nasty) windowFor(s, "before");
  } else if (a.type === "passReaction") {
    requireRule(
      s.phase === "reaction" && s.reaction,
      "No interrupt window is open.",
    );
    const reaction = s.reaction!,
      done = s.actionSpell !== null || reaction.passed + 1 === s.players.length;
    if (!done) {
      reaction.cursor = (reaction.cursor + 1) % s.players.length;
      reaction.passed++;
    } else {
      const stage = reaction.stage;
      s.reaction = null;
      if (stage === "before") s.phase = s.pending!.accepted ? "move" : "roll";
      else if (stage === "after") s.phase = "after";
      else {
        s.phase = "move";
        const move = s.queued!;
        s.queued = null;
        // A passenger is allowed to belong to the interrupt caster. Validate the main move separately.
        const base = { ...move };
        delete base.passenger;
        const passenger = move.passenger
            ? wizardLocation(s, move.passenger)
            : null,
          main = wizardLocation(s, move.target);
        const legal =
          validMove(s, base) &&
          (!move.passenger ||
            (passenger?.visible &&
              passenger.support === main?.support &&
              (s.board[mod(main!.space + move.steps)].towers.at(-1) ===
                "keep" ||
                surface(s, mod(main!.space + move.steps)).length + 2 <= 6)));
        if (legal) afterMove(s, executeMove(s, move));
        else {
          s.events.push({
            kind: "miss",
            ids: [move.target],
            text: "An interrupt prevented the committed move.",
          });
          afterMove(s, false);
        }
      }
    }
  } else if (a.type === "mistake") {
    requireRule(
      s.phase === "move" &&
        s.pending?.accepted &&
        a.tower !== "keep" &&
        s.towers[a.tower],
      "A turret must be committed after the movement value is known.",
    );
    const p = s.pending!,
      steps = p.refresh ? 1 : p.card!.tower < 0 ? p.roll! : p.card!.tower;
    requireRule(
      steps > 0 &&
        s.board[(towerLocation(s, a.tower).space + steps) % 16].towers.includes(
          "keep",
        ),
      "This turret is not blocked by the keep.",
    );
    s.events.push({
      kind: "miss",
      ids: [a.tower],
      text: "The committed lift would land on the keep.",
    });
    s.pending = null;
    finishTurn(s);
  } else if (a.type === "spell") {
    cast(s, a);
  } else if (a.type === "exchange") {
    const mate = partner(s, s.current);
    requireRule(
      mate !== null && !s.exchanged && s.phase === "choose",
      "One card exchange per partnership turn.",
    );
    const own = hand(s),
      other = s.players[mate!].hand,
      i = own.findIndex((c) => c.id === a.give),
      j = other.findIndex((c) => c.id === a.take);
    requireRule(i >= 0 && j >= 0, "Cards not in those hands.");
    [own[i], other[j]] = [other[j], own[i]];
    s.exchanged = true;
  } else if (a.type === "givePotion") {
    const mate = partner(s, s.current);
    requireRule(mate !== null, "Potions can be shared with a partner.");
    const from = a.fromPartner ? mate! : s.current,
      to = a.fromPartner ? s.current : mate!;
    requireRule(
      Number.isInteger(a.count) &&
        a.count > 0 &&
        s.players[from].full >= a.count,
      "Invalid potion transfer.",
    );
    s.players[from].full -= a.count;
    s.players[to].full += a.count;
  } else throw new Error('Unsupported game action.');
  assertInvariants(s);
  return s;
}
export function assertInvariants(s: State): void {
  requireRule(['choose','roll','move','after','reaction','rescue','gameover'].includes(s.phase), 'Unsupported game phase.');
  requireRule(['competitive','solo','cooperative','teams'].includes(s.mode), 'Unsupported game mode.');
  requireRule(s.players.length>=1&&s.players.length<=6&&Number.isInteger(s.current)&&s.current>=0&&s.current<s.players.length, 'Invalid acting seat.');
  requireRule(s.phase!=='rescue'||!!s.search&&s.search.choices.length>1&&s.search.choices.every(id=>!!s.wizards[id])&&!!s.towers[s.search.tower], 'Invalid rescue checkpoint.');
  requireRule(s.board.length === 16, "Board must have sixteen spaces.");
  const towers = s.board.flatMap((c) => c.towers);
  requireRule(
    towers.length === 10 &&
      new Set(towers).size === 10 &&
      towers.every((t) => !!s.towers[t]),
    "Every turret exists exactly once.",
  );
  requireRule(
    s.board.every(
      (c) => !c.towers.includes("keep") || c.towers.at(-1) === "keep",
    ),
    "The keep is always on top.",
  );
  const residents = [
    ...s.entered,
    ...s.board.flatMap((c) => c.ground),
    ...Object.values(s.towers).flatMap((t) => t.residents),
  ];
  requireRule(
    residents.length === Object.keys(s.wizards).length &&
      new Set(residents).size === residents.length &&
      residents.every((id) => !!s.wizards[id]),
    "Traveller conservation failed.",
  );
  requireRule(
    s.board.every((c) => c.ground.length <= 6) &&
      Object.values(s.towers).every((t) => t.residents.length <= 6),
    "Surface capacity exceeded.",
  );
  requireRule(
    s.players.every((p) =>
      [p.empty, p.full, p.spent].every((n) => Number.isInteger(n) && n >= 0),
    ),
    "Invalid potions.",
  );
  const cards = [...s.deck, ...s.discard, ...s.players.flatMap((p) => p.hand)];
  requireRule(
    cards.length === 90 && new Set(cards.map((c) => c.id)).size === 90,
    "Card conservation failed.",
  );
}
