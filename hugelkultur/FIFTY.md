# Fifty deepenings

A worklist for Composer. The game in `hugelkultur/` is a small metaphorical system:
an idol on a pedestal, a circle that wants to hold, four seasons that arrive as water,
seven bodies the druid wears, five woods with characters, mounds that remember what
made them, and years that become ground. Every item below should make the metaphor
*more itself* — in rule or in picture — without adding noise.

## How to work

- **Read first.** The rules live in `clearing.js` (shared constants, measures, circle,
  chronicle), `world.js` (grid, idol, sculpt), `water.js` (seasons, fingers, gates,
  flood stages), `sticks.js` (woods, mounds, trees, beaver), `growth.js` (mounds,
  marks, squirrels, relic), `weather.js` (fall, snow drift, rafts, memory), `day.js`
  (night, rest forms, beds), `guide.js` (the autonomous druid), `gardens.js`,
  `motions.js`, `avatars.js`, `memory.js`, and `main.js` (HUD, camera, look panel).
- **Tone is law.** Lines are short, declarative, no exclamation marks, lowercase
  nouns, King-James-plain: "It is good." "The willow knits." "A nut takes." Numbers
  under ten are words. New strings go through `sim.events.push({ type, text })` or
  `speak()`. When in doubt, say less.
- **Draw with what exists.** Overlays go through the frame-splat draw callbacks
  (`draw.streak`, `draw.point`, `draw.model`) inside `createStickSystem`'s paint list.
  The frame budget is `CAPACITY = 8400` splats in `sticks.js` — raise it only if an
  item needs it, and never past 9000. Baked geometry (the idol, terrain) is sculpted
  once in `world.js`; prefer overlays to re-baking.
- **Respect the solver caps.** `PRESSURE_CAP`, rain ≤ 8 per cell, terrain under the
  shallow-water limits (see comments in `clearing.js` and `world.js`). Never let a
  feature push depth or rain past what the comments warn about.
- **State that persists goes through `memory.js`** (`writeForest`/`applyForest`).
  If an item adds a field the player would miss after reload (notches, stains,
  husks), persist it there and handle its absence in old saves.
- **Verify each item in the browser** at `http://127.0.0.1:8091/hugelkultur/`
  (`python3 -m http.server 8091` from the repo root). Watch at least one full
  season with the change live. Run `node --test tests/*.test.js` if you touch
  anything imported by tests (`clearing.js` especially).
- **Imports carry cache-bust suffixes** (`./world.js?v=square24`). Keep the current
  suffix; bump it only if you change a module's exports.
- Work the items in order within a section; sections are independent. Check each
  box as it lands.

---

## I. The idol and the court

- [x] 1. **The eye follows the water.** Draw a small charcoal pupil (`draw.point`)
  on the idol's eye that drifts a few hundredths toward the live season's gate
  (`sim.live`, `seasonOf(sim).bit`). In `drawRelic` or a new `drawGaze` in
  `growth.js`. The figure watches what threatens it.
- [x] 2. **The ember heart beats.** Pulse an emissive point at the heart
  (`feet + 0.24` area, see `sculptIdol` in `world.js`) with period tied to
  `sim.flood`: slow at dry, quick at `drinks`, steady-calm while `sim.holding`.
  The center's fear is visible before the HUD says it.
- [x] 3. **High-water rings.** Track `sim.highWater = max(idolDepth)` ever reached
  (persist it). Draw one thin charcoal ring on the pedestal drum per distinct
  stage the water has ever reached (`hem`, `drinks`). Scars stay.
- [x] 4. **One leaf per year on the sprout.** The idol's sprout is baked; overlay
  one extra small leaf (`draw.streak`, leaf tones) per survived year, up to eight,
  spiraling up from where the baked sprout ends. The idol grows because you kept it.
- [x] 5. **Year notches on the drum.** On each year roll (`closeSeason` where
  `rolled`), add a notch streak on the pedestal; every eighth notch becomes one
  band. Persist the count. The pedestal is the tally.
- [x] 6. **Offering husks.** When a crop is eaten inside `COURT` distance of the
  hearth, push a husk (tiny bark-colored point) at the pedestal foot, capped at
  twelve, oldest fading. Eating near the figure leaves evidence of care.
- [x] 7. **The circle made visible when it holds.** While `sim.holding`, draw a
  faint brass thread connecting the eight wedges' nearest holding cells
  (`circleState`, `holdsWater`), pulsing on a long period. Not a UI ring — a
  thread lying on the ground.
- [x] 8. **Ripples when the idol drinks.** When `idolStage` enters `drinks`, push
  a motion (`sim.motions`) of two expanding ripple rings from the pedestal.
  `motions.js` gets a `ripple` kind. The worst stage announces itself in water.
- [x] 9. **The idol's reflection.** When stage is `hem` or worse, draw three or
  four short inverted dim streaks on the water surface south-east of the pedestal
  (the camera side) — a broken silhouette. The figure sees itself in what rises.
- [x] 10. **Court stones answer their seasons.** The four stones between the gates
  (placed in `sculptIdol`) are baked; overlay a dark damp streak on the stone
  nearest the live gate, fading when its season ends. The court keeps a wet lintel.

## II. Water, seasons, gates

- [x] 11. **Foam at the live mouth.** Along mouth cells (`cell.mouth`, gate side
  excluded), draw short white dashes aligned with `MOUTH_YAW[edge]`, jittered per
  frame hash. Entry has texture; the season physically arrives.
- [x] 12. **The leaving edge exhales.** On the drain edge (`OPPOSITE[current.edge]`)
  mouth cells, draw sparse sand-colored ticks pointing outward. Water leaves the
  cube somewhere; show the door out.
- [x] 13. **Summer reveals the stains.** `cell.stain` is remembered water. In SUM,
  when a stained cell is dry (`depth < 0.02`), draw a thin dark rim streak scaled
  by stain. The dry season is when the land confesses where water has been.
- [x] 14. **Cracked channel beds.** In SUM, channel cells (`cell.channel`) with no
  depth get two short crossing charcoal cracks. Empty rivers look empty.
- [x] 15. **First-frost skin.** In the first tenth of WIN (`sim.seasonTime` small),
  standing water (depth > 0.04) gets sparse pale horizontal ticks on its surface
  that do not move with the current. Ice begins as stillness.
- [x] 16. **Season handoff breath.** In `closeSeason`, push two motions: a puff of
  the finished season's `pip` color at its gate, and a slow inhale-puff at the new
  mouth. Two seconds of ceremony at the turn.
- [x] 17. **Pressure shows at the mouth.** Scale the mouth-cell stain and the foam
  dash count by `pressureOf(sim.year, climb)`. Year five should *look* heavier at
  the mouth than year one, before the water proves it.
- [x] 18. **Sidled gates leave a dry ghost.** `sidleGate` moves a finger's gate and
  stains the old cell. Also set a persistent `cell.oldGate = true` and draw a faint
  dashed arc there. Abandoned doors stay legible.
- [x] 19. **Leaf rafts cluster before the gate.** Rafting leaves already seek the
  gate (`weather.js`). Give rafts a slight mutual pull when within a cell of each
  other so they arrive as a small fleet, not single file. The autumn jam is a
  visible event.
- [x] 20. **Thaw veins.** Cells with `cell.thaw > 0` (melting snow shedding water)
  draw a hair-thin pale blue streak running downhill (toward the lowest neighbor by
  `bedHeight`). Spring melt has anatomy.

## III. Wood and mounds

- [x] 21. **Birch sticks are birch.** In `drawStick` (`sticks.js`), when kind is
  `birch`, add two tiny charcoal ticks across the shaft. One wood is papered; the
  eye should know it on the ground.
- [x] 22. **The mound shows its wants.** `stillWants` says it; also draw it: four
  small sockets on a mound's crown in `drawCrown` — filled marks solid (existing
  band colors in `BAND`), missing marks as hollow single points. Read a mound's
  hunger at a glance.
- [x] 23. **Willow weave persists.** When `knitWillow` fires, record the pair and
  draw a woven double-arc between the two cells for the rest of the season, not
  just while `soak` is high. The willow's work is a bridge, so show a bridge.
- [x] 24. **Alder breath.** Rooted cells (`cell.rooted`) in SPR emit one tiny
  rising dot every few seconds (hash-timed, emissive false). Alder feeds the bank;
  give it respiration.
- [x] 25. **The birch slide is seen.** When `slideBirch` moves a stick, push a
  motion drawing the stick skating cell-to-cell with a two-tick wake. Currently it
  teleports; the funniest wood deserves its moment.
- [x] 26. **Mounds settle one at a time.** `settleMounds` flattens all mounds in one
  frame at year roll. Stagger them: queue the cells and settle one every ~0.4s with
  a small dust-puff motion each. The year audibly tamps the ground down.
- [x] 27. **Stone gathers moss by age.** Track `cell.rockAge` on compacted mounds
  (`compactMound`); each year add one short moss streak, up to four. Old stones are
  green on the north side of time.
- [x] 28. **Oak has weight in the hands.** While carrying oak (`sim.carryKind ===
  'oak'`), multiply movement input by 0.92 in `main.js` (where pace is applied) and
  lower the carried-stick draw height slightly. Heavy wood should cost a little.
- [x] 29. **Logs shed as they rot.** A fallen trunk (`tree.fallen`, rotting toward
  compost) drops one loose stick of its wood per season while it lasts. Death keeps
  providing; the forest's economy closes its loop.
- [x] 30. **The compost stain spreads.** `compostStick` raises land invisibly. Draw
  settled compost (`cell.compost > 0.4`) as a slightly darker humus patch that
  blends across cell borders toward similarly-composted neighbors. Rot becomes
  soil, visibly, in blotches rather than squares.

## IV. The bodies and the day

- [x] 31. **Each body marks its element.** Small persistent-for-seconds traces,
  all in the stick-frame overlay: the water body leaves ripple rings when wading;
  the snow body leaves white footprints in WIN; the moss body leaves a faint green
  blush on cells it stands on for more than a breath; the fire body dries a
  one-tick rim at puddle edges it passes. Key off `sim.spiritId` and `wornMeasures`.
- [x] 32. **Wrong-season weariness is visible.** When `seasonFit(home, season)` is
  low, slow the body's walk-cycle bob and draw an occasional drooping tick behind
  it. `fitLine` already says "asks more"; the body should look asked-of.
- [x] 33. **Dusk path home.** During rest state `home`, draw three or four fading
  dots along the straight line from the body to `sim.bed`. The forest draws the
  druid home; show the pull.
- [x] 34. **Dream seed.** While asleep at deep night, once per night emit one slow
  mote from the sleeping form that drifts to a random mound missing a mark and
  fades there. A hint, in-world, of tomorrow's work.
- [x] 35. **Waking reassembly.** At dawn (`wakeAt`), push a motion at the bed: three
  puffs in the body's rest-form palette (`REST_AS`, `drawForm` colors in `day.js`)
  converging into the standing position. The element becomes the body again,
  on-screen.
- [x] 36. **The nap shows its trap.** When `watchCorner` puts a cornered body to
  sleep, briefly stroke the outline of the pocket cells (`pocket()` walk) in
  charcoal. The surrender is explained without a word.
- [x] 37. **The pause measure becomes a bow.** After a body finishes a mound
  (`beginMound` with cause `tend` from guide work), if its `pause` measure is high,
  have the guide stand one breath facing the idol before choosing the next goal
  (`guide.js`, a short `rest`-like goal). Reverence as a stat.

## V. The creatures

- [x] 38. **The beaver pays for what it takes.** After `fellTree`, the beaver drags
  toward the water for a few seconds and leaves two loose sticks of that wood on
  the bank cell nearest its channel. Theft becomes trade.
- [x] 39. **The beaver dam.** Count beaver fellings; on the third, convert its
  nearest channel cell to a held cell (`holdsWater` true via a new `cell.dam` flag,
  drawn as crossed sticks) that the wedge logic in `circleState` can count. An
  accidental ally completes what you could not.
- [x] 40. **Squirrels eat some futures.** In WIN, a squirrel revisits one buried
  nut (`cell.nutAt`) and clears it with a small dig motion. Some planted years
  never come; the squirrel line says "A squirrel remembers a nut."
- [x] 41. **A bird crosses for the year title.** When `noteYear` coins a title,
  fly one small two-streak bird across the sky above the hearth over ~four
  seconds. The chronicle is announced by a witness.
- [x] 42. **Fireflies over summer water.** In SUM dusk/night (`nightAmount > 0.3`),
  spawn up to eight slow emissive motes strictly over cells with standing depth.
  The water breathes light exactly where it stands.
- [x] 43. **Respect for the sick tree.** Sick trees (`tree.sick`) drop one pale
  leaf motion every few seconds. Once per sickness, the guide walks to stand one
  breath beneath it (a `look`-type goal weighted by the `love` measure) before the
  tree gives in. The druid attends the dying.

## VI. Language and chronicle

- [x] 44. **The end card reads the chronicle.** The end screen (`index.html`,
  `paintHud`) shows Years/Stacks/Berms; add the last three `sim.years` titles as
  quiet lines under the stats. A death becomes a read-back of the life.
- [x] 45. **The ground remembers on click.** Clicking a settled cell (cubes > 0)
  should say a compressed line: one cube — "A year is in this ground."; more —
  "Three years are in this ground." (words, not numerals). Route through the
  existing click/inspect path in `main.js` beside `moundLine`.
- [x] 46. **The idol speaks once a season.** If the idol stayed dry a whole season,
  at `closeSeason` emit one line built from what the chronicle saw: "The water came
  to the hem. It passed." / "Nothing came. It is good." Keep a tiny table in
  `clearing.js` beside `yearTitle`. The center has a voice, used sparingly.

## VII. Sound

- [x] 47. **Each wood a note.** `tone()` in `main.js` receives `wood.label` event
  types on placement. Give the five woods five distinct two-note pairs in `notes{}`
  (oak lowest, birch highest, pentatonic so overlaps stay kind), and give mound
  completion a soft three-note rise. The stack becomes a phrase.
- [x] 48. **The flood is a drone.** While `idolStage` is `hem` or worse, hold a
  very quiet low sine (gain ≤ 0.02) whose pitch steps up per stage and stops on
  `dry`. Threat you can hear with your eyes elsewhere.
- [x] 49. **The circle rings.** When "The circle holds." fires, play a slow
  three-note bell rise; when "The circle opens.", the same three notes reversed,
  quieter. The system's biggest state change gets its own bell.

## VIII. The cube itself

- [x] 50. **Strata on the cube's side.** The world sits on a charcoal box. For each
  settled year (total cubes from `settleMounds`, persisted), draw one thin
  horizontal stratum line on the south and east faces of the box, humus-colored,
  slightly uneven. The save file becomes geology: a cross-section of every year
  the clearing has kept.

---

## Done when

Each checked item: verified live in the browser across at least one season turn,
tone-checked against the examples above, splat budget respected (no capacity
warnings in console), `node --test tests/*.test.js` green, and persisted fields
survive a reload through `memory.js`.
