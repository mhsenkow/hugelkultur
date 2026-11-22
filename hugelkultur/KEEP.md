# The keep

The second worklist. `FIFTY.md` deepened what the clearing already was. This one gives
it a long arc: over decades the clearing becomes a keep — a small dungeon of earth,
wood, and water built around the idol by a druid who never stops adding.

The arc is already half there by accident. `settleMounds` turns every berm into a
cube each year, so the ring rises and the idol's court, which never rises, sinks
below it. Water only ever arrives and pools. Nothing visits that wants harm. Nothing
is kept for later. These fifty make the accident the design:

- **Water goes somewhere.** It can be led off the side into a river that cuts its own
  bed, drops silt, freezes, jams, and leaves the cube by a door the druid chose.
- **Ground builds into rooms.** Walls, doors, stairs, worn corridors, a sunk court.
- **The druid keeps things.** A woodpile, a root cellar, a seed bank, a wall of years.
- **Others come.** Some help, some take, some dig. Each is stopped by a different thing.
- **Plants build and break.** Ivy binds walls, roots split them, canopy becomes a roof.

One design axis runs under all of it — **what stops what**:

| Barrier | Water | Beasts | People |
|---|---|---|---|
| Stack, berm, cube, dam | stops | stops if 1+ cube | stops if 2+ cubes |
| Hurdle (willow wattle), thorn | passes | stops | slows |
| Door (lintel + hurdle) | passes unless sill | stops | stops |
| Sluice (shut) | stops | stops | stops |

A wall that holds water does not hold a deer, and a hedge that turns a boar lets the
flood straight through. The druid has to build for all three.

## How to work

The rules in `FIFTY.md` › *How to work* still hold: tone is law, draw through the
frame-splat paint list, respect the solver caps, persist through `memory.js`, verify
in the browser across a season, run `node --test tests/*.test.js`.

Additions for this list:

- **New cell fields** go in *both* places in `memory.js`: the `lived` test at the top
  of `cellRow` and the returned row, plus `applyForest`. Missing the `lived` test is
  the easy way to lose a field on a cell with nothing else on it.
- **New sim fields** (`sim.store`, `sim.visitors`, `sim.niches`, `sim.era`, …) go in
  `snapshotForest`/`applyForest` with a safe default for old saves.
- **Anything that changes the bed** (`sill`, `land`, `ice`, `sluice`, `burrow`) sets
  `sim.bedDirty = true` and stays inside `bedHeight`'s limits (under `CREST`).
- **New guide methods** go in `BLOCKS`/`BLOCK_LINE` in `guide.js` and get a
  `goalHolds` branch, or the druid will freeze on them.
- **Visitors live in a new `visitors.js`**: `updateVisitors(sim, dt)` in the step loop
  in `main.js` (beside `updateSigns`) and `drawVisitors` in the paint list in
  `createStickSystem` (`sticks.js`).
- Grow the motion cap (`MOTION_CAP = 24` in `motions.js`) only if a section needs it.

---

## I. The long arc

- [x] 1. **Eras read from the land, not the calendar.** Add `eraOf(sim)` to
  `clearing.js` returning `glade` → `ring` → `keep` → `undercroft`. Ring: the circle
  has held a full year. Keep: two or more rooms (item 19). Undercroft: the ring's
  crest stands three cubes above the hearth floor and the court is roofed (item 46).
  Store `sim.era`, persist it, and speak once on each change: "The ring is a wall."
  "The wall makes rooms." "The court is under the ground." Test it in
  `clearing-rules.test.js`.
- [x] 2. **Each era changes the picture.** Layer an era multiplier over `SEASON_LOOK`
  in `shownLook()` (`main.js`): ink and grain rise a step per era, and the undercroft
  leans `blue-noise`. Let the night veil (`#night` opacity, capped at 0.85 in
  `paintHud`) reach 0.92 when the camera's look point is inside the court. Older
  should look heavier and darker.
- [x] 3. **The world rises around the court.** `raiseLand` caps `cell.land` at 0.42.
  Lift the cap by era (0.42, 0.7, 1.0, 1.3) for cells outside `COURT`, so silt
  (item 11), compost, and litter slowly bury the old glade while the hearth never
  rises. The court becomes a pit because everything else kept growing.
- [x] 4. **Late years change the threat from height to breach.** Today `pressureOf`
  climbs forever, but cubes climb faster, so a long run is solved by about year
  fifteen. From the keep era on, halve the yearly climb and let burrows, roots,
  boars, and jams (sections V and VI) be what floods the idol. The figure is lost
  through a hole in the wall, not a wave over it.
- [ ] 5. **A wall of years.** At the year roll in `closeSeason`, the druid sets one
  object into the inner face of a wall cube near the court: the wood that took the
  gate (`chronicle.wood`), a husk, a flake, or a stone. Keep
  `sim.niches = [{ i, k, face, kind, year, title }]` and persist it. Draw a dark
  recess point with the object's color on that face. Clicking a niche reads its
  year title through `focusSubject`. The chronicle becomes architecture.
- [x] 6. **Long absence keeps building.** `catchUp` stops at four seasons. Add
  `passYear(sim)` that folds a cheap year of erosion, silt, visitors, and growth,
  allowing up to eight years away with the line "Years passed. The keep held." or
  "Years passed. The water found a way." Guard `longevity.test.js`.

## II. Water that goes somewhere

- [x] 7. **Outlets anywhere on the edge.** Today water only drains at the opposite
  mouth (`atMouth(sim.cells, x, z, leave)` in `updateWater`). Mark an edge cell
  `cell.outlet` when its `sill <= -0.3`, and add `+0.05` drain there. Say it once
  per edge: "The water leaves by the west." Every other water item depends on this.
- [x] 8. **Races: a road for the water.** Add a `race` method to `BLOCKS` in
  `guide.js`. When the live gate is held and water stands outside the ring, search
  breadth-first from the live mouth through cells at least four from the hearth to
  the nearest edge cell that is not on the mouth's edge, and cut that path with the
  existing `cut` goal, deepening toward the outlet. `spillPath` already does this
  along the mouth's own edge; generalize it. Line: "You give the water a road."
  Mark cut cells `cell.race = true`.
- [x] 9. **Levees.** In `placeScore`, add a bonus for cells next to a `race` cell on
  the idol's side. Stacks along a race turn it from a ditch into a channel. Nothing
  new to draw: they are stacks.
- [x] 10. **Scour.** Fast water deepens its bed. Once a second in `updateWater`,
  sample each cell's velocity; add `speed * dt` to `cell.scour`; past a threshold,
  lower `sill` by 0.04 (to a floor of -0.9), set `channel = true`, and set
  `bedDirty`. Never on `clearing` or the hearth. Rivers dig where they run, so a
  race the druid scratched becomes a real cut in three springs.
- [x] 11. **Silt.** Slow, deep water drops land. When depth is over 0.06 and speed
  is under 0.01, add to `cell.silt`; past a threshold, `raiseLand(sim, cell, 0.01)`.
  Ponds fill in over the years and old pools become meadow. Autumn's sediment look
  (strength 0.48) is already drawn; make it true.
- [x] 12. **A river has banks.** Cells whose lifetime `scour` crosses a mark become
  `cell.river`. Draw two sand-and-humus bank streaks along the cell's summer flow
  direction, kept for good. `stain` says water was here; `river` says it lives here.
- [x] 13. **Each season moves water its own way.**
  - Spring freshet: for the first eight seconds of SPR, inflow is ×1.8 and scour ×2.
  - Summer: off-channel drain rises and channel drain falls, so the river shrinks to
    a thread and pools stand alone.
  - Autumn: leaf rafts lodge on any narrow `race` cell, not only the gate (extend
    the raft clause in `updateWeather`).
  - Winter: standing water past the first tenth of WIN sets `cell.ice`. Ice is
    walkable (`walkHeight` uses the water level), has no scour, and raises friction.
    At the thaw, ice cells let go together as a surge.
- [ ] 14. **The flood carries debris.** In SPR above pressure 4, the mouth sometimes
  delivers a floating oak log, a loose stick with `drift: true` that follows the
  water's velocity the way birch already does. Where two banks pinch, a log lodges
  as `cell.jam` (bed +0.3), which can turn the river into the ring. The druid
  clears a jam with an `unjam` goal that takes the log as carried oak. Line: "The
  river brings a trunk."
- [ ] 15. **A sump.** When water appears inside the walls, a `sump` method digs one
  cell inside the ring, as far from the idol as the room allows, to `sill -0.6`, so
  water gathers there and not at the hearth. Draw a dark rim. Silt refills it over
  years, so it needs tending. This is the cistern room of the keep.
- [ ] 16. **The sluice.** A one-cell gap in a wall can take `cell.sluice` set to
  `'open'` or `'shut'`; `bedHeight` adds 1.2 when shut. The druid opens it in SUM to
  empty the court and the sump, and shuts it at the turn into AUT and SPR. Draw two
  oak posts and a crossbar at the height it sits. Lines: "The sluice is open." / "The
  sluice is shut." This is the keep's first machine and its first portcullis.
- [ ] 17. **Weirs.** Two layers across a race hold a pond upstream and pass the flood
  over the top. The guide places one where a race crosses low ground. When depth
  over the weir exceeds its bed, draw white spill dashes, reusing the mouth-foam
  stroke. A weir pond is where the heron stands (item 40).
- [ ] 18. **The river has a voice.** Next to `keepDrone` in `main.js`, run a
  low-passed noise buffer whose gain follows the summed depth at `outlet` cells
  (≤ 0.015). It goes silent under ice. A held river sounds like it is leaving.

## III. Ground that builds

- [x] 19. **Rooms.** Add `roomsOf(sim)` to `clearing.js`: flood-fill the walkable floor
  and treat any step up of more than 0.9 (two cubes) as wall. A room is a region that
  does not touch the cube's edge. Name each room by what it holds: court (the hearth),
  store (the woodpile), cistern (the sump), garden (plots or fruit), and hall for
  anything else. Recompute at each season turn. When a new room closes: "The wall
  makes a room." Unit test the fill.
- [ ] 20. **Doors.** A one-cell gap between two wall cells is a doorway. The druid
  lays an oak lintel across it (`cell.lintel`), drawn at the height of the wall top,
  and can hang a willow hurdle (`cell.hurdle`) that stops beasts and people but
  passes her and passes water. With a lintel the gap is a room's door; without one
  it is a breach.
- [ ] 21. **Stairs that stay.** The `stair` method lays stacks to climb. Mark those
  cells `cell.stair`, draw stick ends in steps, and have `settleOne` turn a stair into
  a half-height brick (draw with `scaleY` 0.5 in `putBrick`). Years of stairs become
  a stone staircase.
- [ ] 22. **Walls show their years.** In `drawRises`, put a thin seam line between
  stacked bricks on the two faces toward the camera, offset every other course. Tint
  each course with the band color (`BAND` in `growth.js`) of the cause that made that
  year's mound. Then the inside of a wall reads like the strata on the side of the
  box.
- [x] 23. **A brick budget for a keep.** `drawRises` stops at 72 bricks and six per
  column, so a keep will be clipped. Past three bricks, draw one model per column
  scaled to the column's height; raise the cap to about 160; spend it nearest the
  court first. Check the splat count against `CAPACITY` (8400).
- [x] 24. **Cutaway.** Walls between the camera and the court sink. Reuse
  `crownFade(dx, dz, sim.viewYaw)` from `world.js`: when a column taller than one
  cube has fade under 0.62, draw it at most 0.6 of a brick high with a charcoal cut
  line on top, like an architect's section. Without this a dungeon in isometric view
  is a wall you cannot see past.
- [x] 25. **Worn paths.** Add `dt` to `cell.worn` wherever she walks. Past a
  threshold, draw packed pale ground. A worn cell refuses nuts and saplings
  (`openGround`) and scours at half rate. Her habits become the corridors.
- [ ] 26. **Flagstones.** When `settleOne` settles a `rock` cell, it yields a flag:
  a new carry kind, `stone`, with weight 1.8 and the oak slowdown. The guide's `pave`
  method lays flags on the most worn cells and on door sills (`cell.paved`). Paved
  cells take no scour, no burrow, and no hoofprints.
- [ ] 27. **The wall walk.** Once a ring of equal-height wall exists, let pathing
  follow wall tops; stairs are the way up. At dusk, before going home, she stands one
  breath on the highest wall facing the live gate (a `look` goal). Line: "She keeps
  the wall."

## IV. Stores

- [x] 28. **The woodpile.** Choose one store cell that is dry, inside the ring, and
  outside `COURT`: `sim.store = { i, k, sticks: [] }`, capped at twelve. In AUT, when
  there are more than six loose sticks and no leak, a `store` method carries the
  surplus there. In WIN, when nothing is loose, she draws from the pile before she
  digs in snow. Draw crossed sticks in the wood's color. Lines: "You keep wood for
  winter." / "You take from the store."
- [ ] 29. **Kept wood keeps.** Sticks in the pile never compost. A wet pile (depth
  over 0.03) loses one stick a season. A roofed pile (a wall of two cubes on two
  sides, or canopy, item 46) loses nothing. The fire body standing by the pile marks
  it `parched`. Where you build the store matters.
- [ ] 30. **The root cellar.** A ripe crop she does not eat (eat measure under 0.5)
  goes into a cellar cut into the inner face of a wall cube (`cell.cellar`, up to six
  crops). In WIN, with the beds bare, she eats from it. Draw a dark mouth in the wall
  with a crop glyph from `paintCrop`. The store becomes a room of the keep.
- [ ] 31. **The seed bank.** Each mound that completes all four marks leaves one
  seed in `sim.seeds[kind]`. Planting a crop from the Flora panel spends a seed; with
  none, the button reads "No seed kept." The snow body can raid an old squirrel cache
  (`cell.nutAt`) in WIN for an oak seed. The library gets stakes.
- [ ] 32. **The shelf.** When husks go past twelve, move the oldest into a court
  niche (item 5) instead of dropping it. The idol's foot stays clean and the history
  goes into the wall. Fold the two husk paths together while here: `gardens.js`
  pushes husks inline, and `offerHusk` in `signs.js` is exported but never called.

## V. Visitors

- [x] 33. **A visitor system.** In `visitors.js`, keep
  `sim.visitors = [{ kind, x, z, tx, tz, intent, until }]`. Spawn from a table keyed by
  season and era, with a cooldown per kind and at most two visitors at once. Persist
  only counters (`sim.visited[kind]`), not the bodies. Move the beaver from
  `sticks.js` and the squirrels from `growth.js` into it over time. Generalize
  `shooSquirrel` into `shoo(sim, cell)` so a click scares any visitor.
- [x] 34. **What stops what.** Add `stops(cell, kind)` encoding the table at the top
  of this file, and a visitor path (breadth-first search like `nextStep` in
  `guide.js`) that uses it. Every destructive visitor reads the keep through this
  one rule, so building is always an answer.
- [x] 35. **Deer.** Comes in WIN and SPR from the glade era on. It browses saplings
  (`growth` −0.15, with a small chance to set `tree.sick`) and crop beds, and knocks
  one layer off any stack under three as it steps over. Hurdles and thorn stop it.
  Draw a three-streak body, two leg ticks, and antlers in AUT and WIN. Line: "A deer
  takes the sapling."
- [x] 36. **Boar.** Comes in AUT from the ring era on. It roots a mound: pops the last
  `story` cause, clears that mark, and lowers `coat` by one. On a ring berm it can
  knock a mound down to two layers, which is a breach. Rock and cubes stop it. Dust
  motions where it digs. Line: "A boar turns the mound." It is the loudest enemy.
- [ ] 37. **Moles.** From the keep era on, a mole settles under a wall cell that has
  standing water beside it, adding to `cell.burrow`. Past a threshold, the cell's
  `sill` drops 0.25 and water seeps under. Line: "The wall weeps." The knit measure
  undoes a burrow, and paving prevents one. This is the late-game leak, and
  `leakPlug` in `guide.js` should find it.
- [ ] 38. **Crows.** In AUT and WIN, crows land on loose sticks, husks, and an
  unroofed woodpile and carry one to a treetop, sometimes beyond the cube. Sometimes
  one drops a stick from beyond the cube instead. She shoos them by walking near.
  Line: "A crow takes a stick." / "A crow brings a stick."
- [ ] 39. **Fox.** At dusk, a fox hunts squirrels; a caught squirrel is one fewer
  planter this year, and squirrels avoid cells near it. It dens in a hollow on 32 and
  64 grids (`sim.hollows`). Line: "A fox keeps the hollow."
- [ ] 40. **Heron.** In SUM, a heron stands on a weir pond or pool with depth between
  0.04 and 0.12, and leaves if the water dries. It does no work. It is the sign that
  the river is right, and it can title the year: "The year the heron stayed."
- [x] 41. **The wanderer.** Rare, at dusk, from the keep era on. A hooded figure (a
  tall charcoal streak with a brass point) enters from an edge and paths toward the
  idol under the people rule. If it reaches a kept court (ferns ≥ 3, husks ≥ 4,
  dry), it leaves an offering on the shelf: "A stranger leaves something." If the
  court is neglected, it takes the newest sprout leaf (one fewer year leaf from
  `drawIdolLife`): "A stranger takes a leaf." Doors and walls are what keep the relic
  from people. This is the threat to the relic that is not water.
- [ ] 42. **Bees in the wall.** In SUM during the keep era, a wall niche on a sunny
  face can host a swarm. Fruit within three cells grows ×1.5. If she pulls from that
  wall by day: "The bees warn her." A wall can be alive.

## VI. Growth that builds and breaks

- [ ] 43. **Ivy.** Cubes older than three years grow ivy up their north face, one
  streak per year up to the column's height, extending `drawMossedStone` in
  `signs.js`. Ivied cells resist burrows and boars. Old walls bind themselves.
- [ ] 44. **Trees on walls, roots that split them.** Let `nutGround` accept cube tops
  of two or more. A tree on a wall binds it for years, but once its growth passes two
  it splits the column: the top brick is lost and the cell gets `cell.crack`, which
  seeps like a burrow. A `prune` goal takes two sticks and holds growth back. Prune
  it or let it go.
- [ ] 45. **Thorn.** Add a hawthorn shrub to `species.js`. Planted in a line, it stops
  beasts and slows people, passes water, and gives crows fewer places to land. It is
  the first barrier that is not about water.
- [ ] 46. **The canopy becomes a roof.** A court cell under two or more crowns with
  growth over two is `roofed`: no snow drift, no leaf fall, a darker veil, and
  mushrooms seed themselves. The undercroft's ceiling is alive, which completes the
  last era in item 1.
- [ ] 47. **Light in the dark rooms.** In roofed, damp rooms, glowing fungus clusters
  grow (the `FUNGI` stroke from `growth.js`, emissive), the dungeon's own lamps. The
  fire body sets embers on wall tops at dusk that burn through the night (an emissive
  point pulsing like the idol's heart) and are gone by dawn. The keep glows from
  inside at night.

## VII. Reading the keep

- [ ] 48. **The ledger.** Add a third dock beside Flora and Spirits, called Keep: a
  top-down 2D canvas map of the cube with cells shaded by height band, rooms outlined
  and named, outlets and races in water blue, the store's contents, this year's
  visitors, and the niches as a list. The plan view of the dungeon.
- [x] 49. **The chronicle knows the keep.** Extend `freshChronicle` with `river`,
  `visitor`, `room`, and `breach`. Order `yearTitle` as breach, drank, circle, room,
  river, visitor, then the current fallbacks. Examples: "The year the wall broke."
  "The year the wall made a room." "The year the river turned west." "The year the
  boar came." Test the order in `clearing-rules.test.js`.
- [ ] 50. **The end card reads a keep.** Beside Years, Cubes, and Gates, add Rooms,
  Rivers (outlets ever opened), and Visitors. Change the eyebrow by the end's cause:
  "The idol went under" for a flood over the top, and "The wall gave way" when the
  last water came through a burrow, crack, or boar breach.

---

## A first slice

To get the shape working before the detail, build these in order: **7** outlets,
**8** races, **10** scour, **19** rooms, **24** cutaway, **28** woodpile, **33–34**
visitors and barriers, **36** boar, **41** wanderer, **1** eras. That alone turns
"water rises, build higher" into "water runs, build around it, keep what you have,
and guard the door."

## Seams found while reading

Not part of the fifty; worth fixing before or alongside them.

- `water.js` `sidleGate` measures distance from `(8, 8)` (`Math.hypot(i - 8, k - 8)`),
  not `HEARTH_I`/`HEARTH_K`. On the 32 and 64 grids a sidled gate can land inside
  the court.
- `FIFTY.md` says `CAPACITY = 7200`; `sticks.js` has 8400. Fix the doc so the budget
  rule points at the real number.
- `drawRises` stops at 72 bricks (item 23). Long saves already reach it on a ring.
- Husks are pushed in `gardens.js` inline, and the exported `offerHusk` in `signs.js`
  is never called (item 32).
- `catchUp` caps at four seasons, so a week away looks like one year (item 6).

## Done when

The same bar as `FIFTY.md`: each checked item is verified live across at least one
season turn, tone-checked, within the splat budget, tested if it touches
`clearing.js` or anything the tests import, and its persisted fields survive a reload,
including on a save from before the field existed.
