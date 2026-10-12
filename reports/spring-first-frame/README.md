# Spring first frame, Senso (2026-10-12)

The PM's Q1 of the seasonal batch's review: fix the cause of `artwork-senso-spring` failing now and then, keep the check strict, and if the race persists, list it as a known miss with a baseline and report why the fix didn't hold.

**The result: the fix doesn't hold, and the race is listed** as the known miss "Spring first frame, Senso (animation clocks)" (`first-frame-senso-spring`). The cause is in how the browser reports the animations' start, not in what the page draws.

## What the check reads

The season drill loads Senso's spring page on a warm server. On the first `requestAnimationFrame` callback in which the welcome card is in the page, it requires every animation of the scene to have its clock running (`currentTime > 0`). Since this batch that condition is its own check, `first-frame-senso-<season>`, so that listing spring's doesn't hide the rest of `artwork-senso-spring` (20 particles, the picked designs, transform and opacity only, no page error). The condition is unchanged, and so is the sample.

## The cause, frame by frame

`timeline.mjs` logs every animation frame from the start of the document in the drill's own sequence: a fresh server at the spring instant, a cold load, the warm-up, then the measured load (`timeline-spring.json`, 15 loads):

- **Frame #0, 19–22 ms:** the scene is there with its 20 particles, and all 73–78 of their animations are *pending*. This is the first frame that draws the scene.
- **Frame #1, 28–43 ms:** the card is there, about 8 ms after frame #0.
  - In 13 of 15 loads, every clock is already running at that frame.
  - In 2 of 15 loads (0 and 2), every animation is still pending, and every one is running at frame #2 (about 60 ms).

The browser draws these animations on the compositor. It starts their clocks when it draws the first frame that holds them, and sends that start time back to the page asynchronously. When the card's frame comes only 8 ms after the scene's first frame, that report has sometimes not arrived yet.

What is drawn doesn't wait for the clocks. Every particle has a negative delay, so a pending animation is already drawn at its mid-flight point:

- **The first painted frame:** a Chromium trace of a load that read "pending" shows the 20 particles spread over the screen at first contentful paint (`first-painted-frame-load0.jpg`). The next frame shows the same positions (`second-painted-frame-load0.jpg`); the card is still entering at opacity 0.
- **Positions at the sample:** at the samples that read "pending", 18–20 of the 20 particles are drawn inside the screen (`first-frame.json` load 0: 18 inside, none above the top; `inline-ab.json`, the four loads that read "pending": 18–20 inside).
  - Two fields in that file say nothing: Chromium reports `activeTime` as null for these endless animations, so `effectMid` and `minActive` always read false and 0.

## The PM's fix, tried

`inline-ab.mjs` serves the same spring page two ways, 20 loads each, delivered identically:

- **A:** the page as it is.
- **B:** the same page, with every particle's frame-0 transform written inline at its mid-flight position (the fall's translate, from its own delay and duration) right after the engine builds the scene.

| | Loads with a clock not started at the first sample | Frames until every clock ran |
|---|---|---|
| A, through the server | 2 of 20 | 1 |
| A, the same body delivered at once | 0 of 20 | — |
| B (inline transforms), delivered at once | 2 of 20 | 1 |

The inline transform changes neither what is drawn nor the clock:

- **What is drawn:** a running or pending animation overrides an inline transform, and the frame is already drawn mid-flight anyway.
- **The clock:** no page change can start a compositor animation's clock before the browser has drawn it and reported its start.

So the fix was not shipped.

## How often, in the drill's sequence (`drill-sequence.mjs`)

| Season | Measured (warm) loads with a clock not started | Frames until every clock ran | Cold loads |
|---|---|---|---|
| spring | 10 of 30 | 1 (all 10) | 29 of 30 |
| fall | 2 of 15 | 2, 1 | 15 of 15 |
| winter | 0 of 15 | — | 15 of 15 |
| summer | 0 of 15 | — | 15 of 15 |

Fall shows the same race, less often. Only spring is listed (the PM's ruling). Fall's `first-frame-senso-fall` stays an ordinary check, so a run can fail on it; that is reported, never listed without the PM's word.

## The known miss

- **Check:** `first-frame-senso-spring`, step `season`.
- **What it measures, every run:**
  - the animations whose clock had not started at the first sample, out of all of them (`over` of `of`);
  - the frames until every clock ran (`worst`, in frames).
- **Baseline:** load 2 of `drill-sequence-spring.json`: 74 of 74 animations, 1 frame. Every race measured here stopped every clock at once, and the race's rate can't grow beyond "all of them".
- **Tolerance:** 100 % on the frames, so up to 2 frames is accepted. This is my decision for the PM to confirm. Spring's 16 measured races all took 1 frame, but fall's took 2 once in the same sequence, and the cold loads 1–3.
- **What would worsen it:** clocks that stay stopped for 3 frames or more.
- **Clears:** when the drill's first sample finds every clock running (no page change is known to do that), or when the PM rules that the check reads what the frame draws instead of the clock.

## How to run

The scripts import Playwright by absolute path from the main checkout. They need a scratch database, `SESSION_SECRET` and `UPLOAD_DIR` in the environment, and the suite's build in `.next-check`. For example:

```
CWD=$PWD DIST=.next-check N=15 NOW=2027-03-01T00:30:00-05:00 WANT=spring OUT=<dir> node reports/spring-first-frame/drill-sequence.mjs
```

`server.mjs` starts one server at an instant and regenerates `/senso` for it, for `first-frame.mjs` and `inline-ab.mjs` (`PORT=<port> OUT=<dir>`).
