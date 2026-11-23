# The delve

The third worklist. `KEEP.md` made the clearing into a keep by accident of rising
ground. This one makes the druid mean it. She stakes rooms, raises them a course
a year, and answers five kinds of weather with the land's own materials.

One rule still runs under it — **what stops what**:

| Barrier | Water | Beasts | People | The new weather |
|---|---|---|---|---|
| Clay on a wall | stops the seep and the crack | — | — | frost heave |
| Grate | passes | stops | stops | lets a room close around a race |
| Moat | passes, and is a drain | stops when deep | — | fire |
| Beam | — | — | — | roofs a room so the undercroft can be built |
| Sconce | dries the damp | — | — | rot |
| Well and cistern | holds a store of water | — | — | drought, fire, the seep from below |
| Stone flags | stops a crack | — | — | frost, rot, fire |

Water still ends the game. A stressor only opens the hole the water comes through.

## How to work

The rules in `FIFTY.md` and `KEEP.md` still hold. Short lines. Draw through the
paint list. Solver rain stays under 8. New cell fields go in both places in
`memory.js`, and new sim fields (`sim.plan`, `sim.cistern`) go through
`snapshotForest` / `applyForest` with an empty default for old saves. Every new
guide method has a `goalHolds` branch.

`plan.js` lays the rooms. `stress.js` is the weather. `updateStress` runs in the
step loop just before `updateWater`. `passStressYear` runs at the end of
`passYear`, quietly, so a long absence still ages the keep.

---

## I. She builds on purpose

- [x] 1. **A blueprint.** `planKeep` stakes one room at a time against the ring:
  store on the dry side, cistern toward the low side, then hall, garden, and a
  corridor where the grid has room. About two rooms on 16, five on 32, nine on
  64. A door is a sill in the shared wall, so the ring still holds water.
- [x] 2. **The build method.** It runs only when nothing is leaking. She raises
  the staked wall toward two cubes, starting from the cells that already touch
  a wall. A room closes when `roomsOf` can see it. Then she stakes the next.
- [x] 3. **Stakes and the ledger.** Unbuilt planned walls draw as charcoal dashes.
  The Keep map draws an open room as a dashed box. A click still sets `sim.errand`,
  and `build` honors that cell.
- [x] 4. **Stone and clay.** Berms that have stood long enough compact at the year
  roll. A scoured river cell gives a stone. Clay is dug from dry silt in summer
  or autumn and laid on a wet wall. It stops a burrow, a crack, and frost heave.

## II. Fixtures

- [x] 5. **Grate.** Where a race crosses a planned wall, the gap gets bars and a
  lintel. Water passes. Beasts and people do not. The room can still close.
- [x] 6. **Moat.** In the keep era she cuts a ring of race two cells outside the
  outermost planned wall. A deep moat stops a beast and breaks a fire.
- [x] 7. **Beam, sconce, well.** An oak beam across a short gap between tall walls
  roofs the cell, so the undercroft can be reached by building. In the keep,
  pyres move onto the walls and dry the damp within two cells. A stone-lined
  well keeps `sim.cistern`, filled in spring and autumn, and waters a bed in a drought.
- [x] 8. **The rooms read.** Closed rooms take a floor tint. A door is two posts
  and a lintel. Stone that came from rock is dressed. A roofed room is darker,
  and the cutaway follows the camera's look point.

## III. Five stressors

- [x] 9. **Groundwater.** From the keep era, when the land outside stands more
  than half a cube above the court, water seeps up through floors that are not
  paved and not a sump or a well. "Water rises through the floor."
- [x] 10. **Drought.** One summer in four, from the ring era on. Inflow falls,
  the drain doubles, ponds dry, crops wilt unless watered, and a berm that stays
  dry all summer cracks. Clay does not. "The ground is thirsty."
- [x] 11. **Lightning and wildfire.** Late summer or autumn, more often after a
  drought. The bolt finds the tallest tree. Fire moves through litter, loose
  sticks, a parched berm, an unroofed chest, lintels, and beams. Water, cubes,
  a deep moat, and a live well stop it.
- [x] 12. **Frost heave.** In winter, ice beside a bare wall lifts the top brick,
  cracks it, and lets the thaw seep. Clay and paving hold. Draining the court
  before winter is the other answer.
- [x] 13. **Rot.** Wood in a roofed or wet room gains rot. A rotten lintel falls
  and the door is a breach. A rotten beam drops the roof. A sconce dries it.
  Stone replaces it. The `mend` method puts the wood back.

The idol is still lost to water. The end card says which weather opened the way:
"The keep burned. The water came after." "The door fell. The water came after."

## Done when

`node --test tests/*.test.js` passes, `npm run site` publishes the keep, and a
live season at the clearing shows stakes, a rising room, and at least one of
the five weathers without the solver rain climbing past 8.
