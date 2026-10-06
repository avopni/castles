# Physical model and 3D presentation contract

Rules are authoritative, and animation follows their output. No rigid-body simulation is needed: gravity, collisions, wobble, and turret shape must never change a legal outcome.

## Logical bodies and support

There are sixteen cells. Each has a ground resident list, a ground raven flag, and an ordered turret-id list from bottom to top. Turret bodies have stable ids, a raven flag, and a resident list for the floor immediately above them. The keep is a special body with no standing residents; completed travellers are stored separately.

A stack at one cell is a **chain of supports**. Ground residents can be covered by the first turret. Residents on each turret can be covered by the next turret. A figure is visible only on the exposed ground or exposed topmost movable turret. The keep always caps a stack.

Moving turret index `k` removes the suffix `stack[k…]` and appends it to the destination. Resident lists remain attached to their supporting body. This preserves both buried and standing passengers. A traveller on ground remains at that ground cell when its cover moves away. Only newly covered destination residents award a capture potion.

For traveller motion, compute `(origin + signedSteps) mod 16`. Height does not count as distance. Attach the figure to the final exposed support. If that support is the keep, move the figure into the completed pool, resolve keep relocation, and terminate the turn.

## Component manifest

Nine movable turrets, five raven-marked and four plain; one keep; sixteen cells; up to thirty physical traveller figures across six colors; thirty-six physical potion tokens across six colors; ninety cards; eight base spells; one fair six-sided die; one starting-seat marker. Unused inventory is outside the active state.

The active competitive inventories depend on player count; see [rules.md](rules.md). The four requested factions distinguish the four normal visual seats. Five/six-seat engine configurations can repeat faction identities with distinct seat names.

### Exact movement deck

| Traveller value       | Turret value          | Dice icons |      Copies |
| --------------------- | --------------------- | ---------: | ----------: |
| Each of 1, 2, 3, 4, 5 | —                     |          0 | 4 each = 20 |
| —                     | Each of 1, 2, 3, 4, 5 |          0 | 4 each = 20 |
| Each of 1, 2, 3, 4    | Same value            |          0 | 3 each = 12 |
| 1                     | 5                     |          0 |           6 |
| 2                     | 4                     |          0 |           6 |
| 4                     | 2                     |          0 |           6 |
| 5                     | 1                     |          0 |           6 |
| Die result            | Die result            |          1 |           6 |
| —                     | Die result            |          2 |           3 |
| Die result            | —                     |          2 |           3 |
| —                     | Die result            |          3 |           1 |
| Die result            | —                     |          3 |           1 |
| **Total**             |                       |            |      **90** |

The deck is shuffled with Fisher–Yates using a saved nonzero xorshift32 state. Every die result is generated from the same saved random stream. A seed reproduces setup and all later draws/rolls. RNG state is excluded from bot observation. Competitive discard recycling preserves every physical card id. Solo and cooperation never recycle it.

## Animation model

The implementation is in GameBoard.tsx and sceneLayout.ts. Sixteen clearing centers were measured on the selected board painting. A closed centripetal Catmull-Rom curve joins them in clockwise order; fractional indices wrap modulo sixteen. Physical path length never changes the rules distance.

Stone turrets, coloured bases, shadows and stacks use Three.js geometry. Transparent original animal figures are mapped onto compact camera-facing planes above their bases. Turret pitch is fixed at 0.92. The painting fills the entire area below the header: its physical plane depth adapts to the canvas aspect and camera angle. The overview and roof inspection use a fixed 35.26-degree isometric camera elevation, matching the painted landing ellipses. The overview compacts the vertical geometry and spacing of stacks when headroom is limited, including lift clearance during motion; horizontal roof dimensions and six-unit slots retain their size. Unit bases follow the compacted floor height, while the painted figures retain their size and face the camera. Roof inspection uses full-height geometry. Roof inspection uses a separate closeup with all turret levels available as controls.

The immutable reducer resolves each accepted action first. The session saves that checkpoint, then presents the before/after state and ordered event output. Input and bot actions are locked until presentation settles. Reloading during motion restores the resolved checkpoint without repeating the action.

Selected turrets and visible passengers follow the same signed route and lift displacement, retaining their support association. Already hidden passengers are not instantiated. Newly revealed residents appear after their cover lifts; newly covered residents disappear as the moving body lands. Traveller moves hop to the correct exposed support. Entering animals reach the old keep, disappear into its completed pool, then the keep follows its relocation event. Swapped exposed turrets fly between their destinations with their residents.

Reduced motion applies final poses immediately, preserving the same rules events. Pausing stops subsequent actions while an in-flight presentation settles. A failed WebGL initialization leaves the painted board, sixteen accessible cells and the normal action/inspection controls.

House, spell and arrival overlays never change the board's dimensions or camera fit. Roof inspection and movement choices share the fixed card-panel footprint: preview on the left, tower levels in the middle and exposed units on the right. Playing a card or accepting a roll opens these choices automatically. Choosing a clearing removes other origin highlights; choosing a piece highlights its destination, which is clicked to perform the move. Main-board clearings have no visible space indices, and units display only their house names. Cards fit the available panel area. After a manual move, Confirm and Undo replace the entire panel contents, including with reduced motion enabled. Space navigation, card undo and move review keep the same panel size. The keep's public Home badge follows its animated position and flips left near the right edge to remain readable.

## Information boundaries

### Six-unit footprint and completed-traveller display

Six fixed hexagonal slots are independent of occupancy. The conservative clear roof radius is 0.45, slot-center radius 0.29 and base radius 0.12. A figure's complete horizontal envelope stays within radius 0.13, including its painted plane and selection ring. Adjacent centers are 0.29 apart, so worst-case pair and wall clearance are both 0.03. The runtime measures actual transformed vertices, rather than assuming that the base alone fits.

Each painted figure is 0.18 wide and at most 0.23 high, tilted toward the current camera. The height is additionally bounded by 0.184 / abs(sin(tilt)), keeping its horizontal rectangle envelope below approximately 0.129 at every camera angle. Occupancy never changes slot size. Slot assignments preserve the positions of animals remaining on a support when a companion leaves. Decorative house-colour halos may extend beyond the physical figure envelope and are excluded from collision-clearance measurements.

surfaceLayout.ts defines slot and floor coordinates. A turret roof is 0.84 above the cell origin plus 0.92 per additional level. Figure origin is floor height minus base-center offset plus half base height, placing its base bottom on the floor.

Overview figures cannot convey all their painted detail. Roof inspection supplies a magnified exposed-roof view and individually selectable figures, while the main board stays present. Buried resident identities, counts and silhouettes remain hidden unless the user explicitly enables Peek.

Completed travellers are in state.entered, separate from surfaces, and cannot move. The compact Home badge opens the arrival ledger above the board. House counts and gold seals identify completed animals; blank slots mean not yet home, not a hidden location. Slot totals follow configured inventory. The completed pool has no six-person limit.

A multi-choice rescue uses a paid, persistent search checkpoint. Eligible choices are disclosed only after the search has been paid for; selecting one resumes the previous rules phase without another payment.

Keep contents, roof occupancy, exposed factions, visible turret identities, potion status, discard top, and active turn are public. Covered residents, opponent hands, future deck order, and random generator state are private.

Normal stack inspection shows turret levels and exposed residents only. The user-requested Peek aid adds per-space identity badges and a layer-by-layer inspector. It is presentation-only, switches off on a turn change, is concealed during private handoff, and never changes the saved state, legal moves, rescue availability or bot observations. Turning it off removes the hidden identities from the displayed DOM. A rescue target still names the covering turret and is available even when the player's memory is wrong.

The active house's exposed figures have softly pulsing halos; selecting another house adds its exposed figures. Covered figures do not receive halos. Reduced motion uses steady halos. Dice use six CSS 3D faces and an 850ms tumble to the reducer's saved result, with a 900ms input lock. Rerolls animate even when the result repeats. Reduced motion settles immediately; animation never draws randomness or changes the result.

Bots receive redacted observations and keep their own memory of already observed figure/support associations. Stable support ids let them remember a covered figure riding inside a turret without inspecting it. Their perfect memory is a policy feature; it does not reveal unknown card faces or draw order.

## Conservation and invariants

- Every active traveller exists exactly once, on a ground/turret floor or in the keep.
- Every turret exists exactly once, across exactly sixteen cells.
- The keep is always the exposed topmost body at its cell.
- Each standing or covered floor has capacity six. Completed keep contents have no six-person limit.
- Ninety unique cards remain distributed among deck, discard, and hands.
- Potion counts remain nonnegative integers. Spent potions cannot be refilled. Transfers in partnership mode conserve the combined stock.
- A completed traveller never leaves the keep and cannot be selected for ordinary movement.
- Finish the final competitive round with equal turn counts; compare only qualified players/partnerships.
