# Cascading Castles rule specification

Terminology is reskinned without granting faction powers. A **traveller** is a wizard; **High Keep** is Ravenskeep. Animal houses replace player colors. Turrets, potions, cards, and raven marks retain their original mechanical roles. All houses are mechanically identical.

The sources and edition decisions are in [sources.md](sources.md). Coordinates below are zero-based, increasing clockwise.

## Setup

Use sixteen track spaces, ground raven marks at 0/4/8/12, nine movable turrets, and one keep. Put the keep at 0 and turrets at 1–9; odd-numbered turrets are raven-marked. The top surface, rather than the ground beneath a turret, determines whether a space offers a raven mark.

| Seats | Travellers each | Empty potions each |
| ----: | --------------: | -----------------: |
|     2 |               5 |                  6 |
|   3–4 |               4 |                  5 |
|   5–6 |               3 |                  4 |

Place travellers in starting-seat order, one per player per placement. Fill the first three turret roofs to three travellers each, the next three to two each, then the final three to one each, stopping when every traveller has been placed. These are setup limits; the usual capacity is six per ground surface or turret floor.

Shuffle the ninety movement cards and deal three per player. The standard opening spell pair is Fleetfoot and Walking Stone. Experienced players may select any subset of the eight base spells. Choose a starting seat; that player begins each round.

## Turn

The active player plays one movement card, resolves it, then plays a second and resolves it. When the first card remains resolvable, its move is mandatory. A played card with no legal move is discarded without movement. Do not refill between actions.

Instead of both card actions, discard the **whole hand** and advance one turret one space clockwise. This alternative is unavailable after playing the first card. Cast at most one available spell at any point in the turn, spending its full potions. After the second action or refresh, a short resolution checkpoint permits the optional spell, then the player explicitly continues; the UI should automatically continue when there is no remaining decision.

Refill to three cards and pass clockwise. Whenever the draw pile runs out in competitive play, shuffle the discard pile to replace it.

Landing a traveller in the keep ends the active turn immediately, including when a spell causes the entry. Refill and pass even when fewer than two cards were played. There is no further spell window after an entry.

## Cards and dice

Each card has separate traveller and turret values, either numeric, absent, or die-driven. Numeric movement must use the complete printed value. A dual card offers one choice, not both movements.

Dice cards roll a fair die once. Two dice icons permit one reroll; three permit two. A reroll replaces the previous result. Choose the piece and, for a dual card, the piece type **after** accepting the final result. No target is fixed in advance. The face counts are in [physics.md](physics.md).

## Traveller movement

A movement card can move only a visible traveller controlled by the active player. Move clockwise by the exact number of ground track spaces; turret floors do not consume steps. Pass over intervening turrets and the keep without interaction.

On landing, join the exposed roof, or the ground when no turret is present. The destination surface holds at most six travellers. Covered travellers on separate floors do not count toward its occupancy. A hidden traveller cannot move until revealed or rescued.

Landing exactly in the keep permanently completes that traveller. Advance the keep clockwise to the first empty exposed surface with a raven mark, skipping occupied surfaces and marks hidden by other turrets. If no other eligible surface exists, the keep stays. The contents of the keep are public and persist wherever it moves.

## Turret movement

Choose any movable turret, including a turret within a stack. Lift the chosen turret with **all turrets, residents, and the keep above it**, retaining their order. Ground residents and lower turret floors stay at the origin. Covered residents carried inside the moving substack stay covered.

Land the moving substack above the destination's existing turrets. Its newly covered exposed residents become hidden. Fill exactly one empty potion if one or more travellers were newly imprisoned, even when all are your own. Already hidden residents do not generate another reward merely because their enclosing stack moves.

Never land a turret above the keep. Passing over the keep is allowed. The keep cannot be selected as a normal turret. A turret below it can carry it. If a player physically commits a lift that would land on the keep, the distinct mistake action discards the played card and ends the turn without moving the turret.

Removing a cover reveals the immediately exposed floor at the origin. Revealing a traveller does not itself award a potion. No peeking at covered floors is allowed.

## Spellbook

Full potions spent on spells leave the game. They do not become empty, and count as previously filled for the winning objective. Spell cards remain shared and reusable.

| Cascading Castles | Published rules      | Cost | Effect                                                                                                                                                                                                                   |
| ----------------- | --------------------- | ---: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fleetfoot         | Advance a Wizard      |    2 | Any visible traveller, clockwise one.                                                                                                                                                                                    |
| Walking Stone     | Advance a Turret      |    1 | Any turret and everything above it, clockwise two.                                                                                                                                                                       |
| Wayward Wind      | Headwind for a Wizard |    2 | Any visible traveller, counterclockwise one.                                                                                                                                                                             |
| Stone Tide        | Headwind for a Turret |    1 | Any turret and everything above it, counterclockwise two.                                                                                                                                                                |
| Twinned Turrets   | Swap a Turret         |    2 | Exchange the exposed turrets of two distinct occupied spaces, carrying their roof residents. The keep is excluded. No newly covered floor is created and no capture potion is earned.                                    |
| Call the Keep     | Nudge Ravenskeep      |    2 | Move the keep in either direction to the nearest empty exposed surface. No raven mark is needed.                                                                                                                         |
| Unbar the Door    | Free a Wizard         |    1 | Select a turret and search the floor immediately beneath it. Move one eligible traveller to the top of that stack. If the top is the keep, complete the traveller. A mistaken search still consumes the potion and spell. |
| Fellowship        | Piggyback             |    1 | Attach a second traveller of the caster from the same departing surface to the committed traveller move, with the same distance and destination. Both count toward the six-person capacity.                              |

The two direct traveller spells can target another house's visible traveller when useful to the caster. Rescue targets a covered **floor by its covering turret**, not an automatically disclosed hidden traveller. Where more than one eligible traveller is found, the action can identify the one to rescue; otherwise it selects the first found eligible traveller. Hidden identities must never be offered before the search resolves.

Paid multi-choice rescue is a saveable checkpoint: after the search finds several eligible travellers, choose one to rescue. The remaining travellers stay on their original covered floor. No further card, spell, or movement action is allowed until that choice is resolved, and it does not spend a second potion.

## Winning

Fulfill both conditions in either order: every traveller completed and no empty potions left. Spent potions do not disqualify the player. Trigger the final round and finish through the seat immediately before the starting seat, giving every player equal turns.

Among qualified players, most full, unspent potions wins. If that number ties, share the victory. A player with all travellers home but empty bottles still takes turns, using turrets to finish filling them.

## Printed variants

### Solo and solo with spells

Control twelve travellers from one shared pool. Use one card per turn and refill to three. Do not recycle the deck: drawing its last card ends the game in defeat unless the goal has already been achieved. Aim to finish using thirty or fewer movement cards.

Without spells, there are no potions to fill. With spells, use exactly three selected spells and six empty potions. Cast after resolving the single movement card, rather than before it. The goal includes filling all six bottles, counting spent ones as filled. Whole-hand refresh is unavailable.

### Cooperation

Solo mechanics apply with clockwise local seats, twelve shared travellers, and one face-up three-card hand. With spells, share six potions and three selected spells. The physical rule prohibits gameplay discussion; the software records this convention but cannot police conversation.

### Partnerships

Four or six seats form opposite-seat pairs. Once per turn, partners can exchange one card in each direction; accepting and returning the offered card is mechanically a no-op. Share full potions freely. If the acting player has no empty bottle, a new capture can fill the partner's bottle. Once the acting player has completed all their own travellers, their movement cards control their partner's travellers. Rescue can help either partner.

Both partners must complete both goals to qualify. Finish the round; compare total unspent full potions per qualifying partnership; ties share the victory.

### Interrupt spells / Nasty variant

Spell priority starts with the active seat and proceeds clockwise. A played card is committed and cannot be exchanged in response to a spell. Reaction windows occur before selecting a move, after committing its target but before applying it, and after resolution. They preserve the printed before/during/after timing without representing animation time as a rules opportunity.

Only one caster and one spell type may be used per action. That caster may repeat the same spell while paying for each use. Spells can help or hinder any house. Interrupts may move the committed target or cover it. Before completing the main move, recheck visibility, destination capacity, and keep restrictions. If completion is now impossible, the card stays discarded and the action ends without its move. Completed actions cannot be reversed. Fellowship can attach an off-turn caster's traveller to the active move.

The current bot policy passes interrupt windows; humans can use every reaction action. Bot capability in this variant is intentionally basic, not an optimal adversarial search.
