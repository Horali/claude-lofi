# claude-lofi plan

A Claude Code mod. `/music` plays lofi radio and opens a pane beside the chat. The pane shows an animated ASCII scene with a small Claude-like character wearing headphones. All art is original.

**Name:** the repo is `claude-lofi`, but the mod itself is called `lofi-desk` (placeholder). Claude Code reserves mod names that start with `claude-` for Anthropic, so `claude plugin validate` refuses `claude-lofi`.

## Commands

| Command | What it does |
| --- | --- |
| `/music` | Starts the radio and opens the pane. If the radio is already playing, it stops it. |
| `/music next` | Switches to the next scene. |
| `/music fm` | Stops our radio and opens the real Claude FM livestream in your browser. |

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
  src/engine/canvas.ts             a grid of characters; layers are painted back to front
  src/engine/sky.ts                time of day (dawn, day, dusk, night), sun, moon, stars
  src/engine/particles.ts          rain, snow, fireflies, sparks, shooting stars
  src/character.ts                 the headphone character: typing, nodding, dozing frames
  src/scenes/*.ts                  city, ocean, campfire, space, desk
  src/audio.ts                     start and stop the radio, with the fallback players
  types/index.d.ts                 the shapes of the values the mod keeps in $.state
  tests/*.test.ts(x)               run by `claude plugin test`
```

## How the animation works

- A timer (`$.clock.every(125)`) bumps a frame counter 8 times a second while the pane is open. The pane redraws when the counter changes. No timer runs while the pane is closed.
- Each frame is a pure function: `scene.draw(canvas, time, frame, world)`. The same inputs always give the same picture, so tests can check frames without the app.
- A scene is a stack of layers, back to front: sky, far layer, middle layer, near layer, particles, character. Far layers scroll slowly and near layers scroll fast. That difference is the parallax.
- Mountains, skylines, waves and clouds come from noise with a new random seed each time a scene starts. You never see exactly the same view twice.
- The sky follows your real clock: stars and a moon at night, a low sun and warmer marks at dawn and dusk, clouds by day.
- Scenes rotate every 4 minutes. `/music next` skips ahead.
- Colors only use the app's theme names (`text`, `subtle`, `inactive`, `claude`, `warning`), never fixed hex. That way it works in light and dark themes. Every `Text` is drawn `mono` so the desktop app uses a monospaced font.
- The art is sized to the pane's real width (`bodyColumns`). Below about 36 columns it drops the far layers and draws a simpler scene. When the pane is minimised to a widget, it shows a one-line glance: the character and the station name.

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
