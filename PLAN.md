# claude-lofi plan

A Claude Code mod. `/music` plays lofi radio and opens a pane beside the chat. The pane shows an animated now-playing card and an ASCII scene with a small pixel character wearing headphones. All art is original.

**Name:** the repo is `claude-lofi`, but the mod itself is called `lofi-desk` (placeholder). Claude Code reserves mod names that start with `claude-` for Anthropic, so `claude plugin validate` refuses `claude-lofi`.

## Commands

| Command | What it does |
| --- | --- |
| `/music` | Starts the radio and opens the pane. If the radio is already playing, it stops it. |
| `/music next` | Switches to the next scene. |
| `/music fm` | Stops our radio and opens the real Claude FM livestream in your browser. |

## Look and layout (v3, agreed 2026-11-21)

This replaces the v2 text-art card. You approved it after testing the mock (`/music` spike action `mock`): "looks good for now, lets just build it first".

**Shape.** The pane fills the side column from top to bottom. On the desktop app it holds two SVG pictures, one under the other:

1. **The song card (top).** Built by `src/card-svg.ts`. It has:
   - a dashed rounded frame with twinkling ✦ ✧ corners and an orange dot travelling round it;
   - a pixel cassette with turning reels (left out on the compact card);
   - NOW PLAYING, the title, the artist and the station;
   - a `mm:ss` **minutes-played** counter that ticks with CSS alone. The radio sends no song length, so it counts up from when the title changed and never shows a fake progress bar;
   - orange audio level bars, a pulsing LIVE dot and a sweeping line;
   - RECENTLY PLAYED, the last three songs with times.
   A strip at the top of the card, exactly one text row tall, is left empty. The pane lays two plain text buttons over it: `▶ play` / `❚❚ pause` (orange) and `» next scene` (dim).
2. **The scene (bottom).** Built by `src/mock-svg.ts` for the rainy city. It fills the height left under the card. The world is monochrome ASCII and only the character is in colour. Every motion runs on its own loop of 2 s to almost 5 min, so you never see the whole picture reset.

**Rules we learned in the spike (keep them):**
- **Draw every `Svg` with `isInteractive`.** As a plain image, the desktop app reloads it about once a second, which restarts every animation. In the sandboxed frame it runs smoothly. The mod itself renders only once (checked with a redraw counter).
- **In the frame an `Svg` keeps its own size,** so always pass `width` and `height` in CSS pixels. The root `<svg>` uses `width="100%" height="100%"` and `overflow="hidden"`.
- **Sizes come from `src/pane-layout.ts`** (`paneLayout(cols, rows)`). One column is about **7.8 px** and one row about **21 px** on the desktop app, measured from a screenshot of a 62×39 pane. Under about 43 columns the card goes compact (no cassette, no LOFI RADIO label). The card stops growing at 560 px and is centred. The scene height is clamped to 0.8–1.35 × its width, and it crops with `xMidYMax slice` so the ground and the character stay in view.
- **Only rebuild an SVG when it really changes** (play state, layout, song, scene, mood), because a new source restarts its animations. Pass the elapsed seconds in as negative `animation-delay`s, so a rebuilt SVG carries on from where it was.
- **The app can't detect clicks inside an SVG.** Buttons are native `Button`s laid over the card with an absolute `Box` (`top={0}`, `left={buttonsLeft}`, in text cells).
- **Terminal and other surfaces** have no `Svg`, so they get a short text fallback: the now-playing line and the play/next buttons.

**Checking a layout without the app.** `.preview/` (gitignored) is served on port 8790 by the `preview` entry in `.claude/launch.json`. It holds a stand-in pane that uses the same layout maths and the same sandboxed iframes, at several sizes side by side. Use it to check sizes before asking for a screenshot. Zoom the browser view to 100%: a view scaled to fit makes the frames look cropped when they aren't. The script that builds it should live in the repo (`scripts/preview.mjs`) so a new session can run it.

**What we take from Claude FM (and what we don't).** The idea is general: a black-and-white ASCII world where only a little character has colour. We don't copy its scenes, layout, character or look. Our character is our own 16×11 pixel sprite (headphone band, ear cups, round face, blink, bob, a mug with steam). All five scenes are drawn from scratch.

## Build checklist (the full build)

Work in small commits, pushing to `main` after each one. Check every visual change in the local preview before you report it.

1. **Preview script.** Add `scripts/preview.mjs`. It imports the TS sources (Node 22+ strips types; copying to `.mts` with fixed import paths also works), writes `.preview/preview.html` with the card and scene in sandboxed iframes at sizes given on the command line (for example `31x39,62x39`), using `paneLayout`.
2. **Clean up the spike.** Remove the text-frame panes (`lofi`, `lofi-mini`), `src/spike-scene.ts`, the widget test and the `spike` tool once `/music` replaces them. Keep the audio code (`playProcess` with ffplay, then mpv, vlc and the WMP PowerShell fallback).
3. **Audio and song titles.** One module, `src/audio.ts`.
   - Start and stop the stream.
   - Read the **ICY metadata**: connect with the header `Icy-MetaData: 1`, read `icy-metaint` (8192 on FluxFM), and parse `StreamTitle='Artist - Title'` after every metaint bytes.
   - Keep the last 3 titles with their start times. A new title resets the counter.
   - This needs a second, small connection that reads metadata only (`$.http` / fetch if the engine allows streaming bodies, or a small helper process). Check which works on Windows first.
4. **Scenes.** Five original scenes as SVG builders sharing `theme-css.ts` and the character: city rain (exists), ocean boat, forest campfire, space, desk by a window.
   - Each uses long, staggered loops.
   - The sky follows the real clock (night, dawn, day, dusk), picked when the scene is built.
   - Scenes rotate every 4 minutes. `» next scene` and `/music next` skip ahead.
5. **Character moods.** These change the sprite inside the scene SVG:
   - **working:** typing or nodding while a tool call runs;
   - **vibing:** bobbing to the music;
   - **dozing:** `z z z` after 2 minutes with no tool calls.
   The SVG is rebuilt only when the mood changes.
6. **Commands.**
   - `/music` toggles the radio and opens or closes the pane.
   - `/music next` switches the scene.
   - `/music fm` stops our radio and opens https://www.youtube.com/live/tRsQsTMvPNg in the browser. It never downloads or rips audio.
   - Restart the ticker after a reload in `session.start`.
7. **Tests** (`claude plugin test .`):
   - the layout maths at 31, 45, 62 and 96 columns;
   - every scene builds, stays under 131072 characters and has no `<script>`;
   - the card shows the title and the counter;
   - moods follow tool calls;
   - `/music` opens the pane and toggles the radio;
   - the terminal fallback.
8. **README** (install, commands, stream terms: FluxFM publishes the URL on its "Für externe Player" page; ask Queen Hora before making the repo public), `.claude-plugin/marketplace.json`, and an icon (`claude plugin validate` asks for one).
9. **Finish.**
   - `claude plugin validate .` and `claude plugin test .` must pass.
   - Show each scene in the local preview and ask Queen Hora for app screenshots.

## File layout

The repo folder is the mod folder. Everything lives in git.

```
claude-lofi/
  .claude-plugin/plugin.json       mod name, version, types, options (stream URL, volume)
  .claude-plugin/marketplace.json  lets people install the mod from GitHub with one line
  hooks/hooks.json                 points the engine at register.tsx
  hooks/register.tsx               wiring only: commands, pane, tool-call hooks, timers
  src/engine/rng.ts                seeded random numbers
  src/engine/noise.ts              1-D value noise for mountains, waves, skylines, clouds
  src/engine/sky.ts                time of day (dawn, day, dusk, night), sun, moon, stars
  src/engine/particles.ts          rain, snow, fireflies, sparks, shooting stars
  src/theme-css.ts                 palette and font shared by every SVG (light and dark)
  src/card-svg.ts                  the now-playing card
  src/pane-layout.ts               card and scene sizes from the pane's columns and rows
  src/character.ts                 the pixel character: working, vibing, dozing
  src/scenes/*.ts                  city, ocean, campfire, space, desk (each returns an SVG)
  scripts/preview.mjs              builds the local stand-in pane in .preview/
  src/audio.ts                     start and stop the radio, with the fallback players
  types/index.d.ts                 the shapes of the values the mod keeps in $.state
  tests/*.test.ts(x)               run by `claude plugin test`
```

## How the animation works

- Motion runs inside the SVGs (CSS keyframes and SMIL), not by redrawing the pane. The pane only redraws when something changes: the song, the play state, the scene, the mood or the pane size.
- Each loop has its own length (2 s to almost 5 min), so the picture as a whole never visibly resets.
- Colours come from CSS classes in `theme-css.ts`, with a `prefers-color-scheme` block for dark mode. Only the character and the accents are in colour.
- See **Look and layout (v3)** for sizing.

## How the character reacts

- A `tool.call` hook counts tool calls while they run. While a call runs, the character types and nods.
- Shortly after a call ends, it bobs its head to the music.
- After 2 minutes with no tool calls, it dozes and `z z z` floats up.

## Audio

- **Station:** FluxFM ChillHop (lofi and chillhop instrumentals, 320k MP3). FluxFM publishes this stream URL on a page titled "Für externe Player" ("for external players"). SomaFM was ruled out because its terms ban third-party apps. The URL is a mod option, so you can swap the station.
- **First try:** `$.audio.play({ url }, { shouldLoop: true, signal })`. In the spike, on Windows desktop it gave up after 3 ms (no built-in player), so this is a quick check, not the main path. If the call is skipped, fails, or ends within 3 seconds, we use the fallback.
- **Fallback:** start a small player in the background with `$.process.spawn`. We check for players in this order: `ffplay`, `mpv`, `vlc`, then (Windows only) the Windows Media Player that comes with Windows, driven by a short PowerShell script. That script must pump window messages (`DoEvents`) or the stream never starts.
- **Stopping cleanly:** one AbortController per play. Stopping aborts it. For a background player, we also end the loop that reads its output, which kills the process. The engine also kills it when the mod reloads or the session ends.

## How the mod loads while we build it

The source lives in this repo, not in a temporary folder.

- **The skill's default** (this session's dev-mods folder) reloads the mod live after each turn. But that folder is temporary and outside the repo.
- **`--plugin-dir`** is a flag for `claude` in a terminal. Desktop sessions can't take flags.
- **`CLAUDE_CODE_PLUGIN_DIRS`** in `~/.claude/settings.json` works for desktop sessions. But it loads the mod in every session, needs a new session, and needs `CLAUDE_CODE_PLUGIN_DIR_WATCH=1` for live reloads.

**Choice:** the mod folder in this session's dev-mods slot is a **link (a Windows junction) to this repo**. The app follows links, so it reloads the repo's files live after each turn. We don't restart anything and don't change global settings. If the app turns out not to follow the link, we fall back to `CLAUDE_CODE_PLUGIN_DIRS`.

**After it's built,** for everyday use: `claude plugin marketplace add C:\Users\child\PROJECTS\claude-lofi`, then install `claude-lofi`. A local marketplace reads straight from the folder, so `/reload-plugins` picks up edits. Your `benai-mods` mods already work this way.

## Spike (before building the rest)

1. Does `$.audio.play` with the stream URL make sound in the desktop app on Windows? If not, does the fallback player start and stop cleanly?
2. Does a pane open, and does an 8 fps redraw look smooth? We measure real frames per second.

## Testing

- `claude plugin validate .` checks the manifest and hooks.
- `claude plugin test .` runs the tests: frames are the same width as the pane, every scene draws at narrow and wide widths, the character changes mood with tool calls, and the commands open the pane and toggle the radio.
- Screenshots of each scene in the real app (kept out of git).

## Spike results (2026-11-21, desktop app on Windows 11)

| Test | Result |
| --- | --- |
| Mod loads from the repo through the junction | Yes. It loaded at the end of the turn, and edits reload before the mod's own tool runs. |
| `$.audio.play({ url }, { shouldLoop: true })` | No sound. The call returned after 3 ms, which means it skipped playback (no built-in player on Windows). |
| ffplay in the background | Plays. Its clock advanced and the audio buffer was full. Stopping it ends the process; no leftover `ffplay.exe`. |
| Windows Media Player via PowerShell | Stuck in state 9 ("transitioning") at first. With a `DoEvents` message loop it reached state 3 ("playing"). Stops cleanly; no leftover process. |
| Player when the mod reloads | The engine kills it, so music is never left orphaned. |
| Pane opens | Yes, docked beside the chat, 31 columns by 39 rows. |
| Redraw speed | A steady 8.0 fps. The longest gap between frames was 136 to 273 ms, with a short dip to 6 fps while ffplay started. |
| After a reload | The pane stays open, but the timer is gone, so the animation freezes. The build must restart the timer in `session.start` if the pane is open. |
| `claude plugin test` | Works. Frames rendered at 31 and 56 columns are exactly the pane's width. |
| Screenshots | Claude can't take screenshots of its own app window (a safety rule). Frames are shown from the test kit instead, plus a screenshot from you. |
