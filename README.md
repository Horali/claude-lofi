# lofi-desk

A Claude Code mod that plays lofi radio while you work. Type `/music` and a pane opens beside the chat. At the top is a now-playing card with live song titles, a minutes-played counter and audio level bars. Below it is an animated ASCII scene with a small pixel character in headphones. The character reacts to what Claude is doing:

- **working**: nods along and types while a tool call runs;
- **vibing**: bobs to the music, with notes floating up;
- **dozing**: `z z z` after two minutes with nothing going on.

There are five original scenes: a rainy city rooftop, a boat on the open sea, a forest campfire, a tiny moon in deep space and a desk by a window. The sky follows your real clock (night, dawn, day, dusk), and the scene changes every four minutes. All art is drawn from scratch for this mod. The world is black-and-white ASCII; only the character and a few accents are in colour.

## Commands

| Command | What it does |
| --- | --- |
| `/music` | Starts the radio and opens the pane. If the radio is playing, it stops it and closes the pane. |
| `/music next` | Switches to the next scene. |
| `/music fm` | Stops the radio and opens the Claude FM livestream in your browser. |

The pane also has **▶ play / ❚❚ pause** and **» next scene** buttons.

## Install

The repo is the mod folder and also a one-mod marketplace:

```
claude plugin marketplace add C:\path\to\claude-lofi
claude plugin install lofi-desk@lofi-desk-market
```

Or from GitHub, if you have access to the repo:

```
claude plugin marketplace add Horali/claude-lofi
claude plugin install lofi-desk@lofi-desk-market
```

## What it needs

- **A way to play the stream.** It tries these in order: the app's own player (not on Windows), `ffplay` (from ffmpeg), `mpv`, VLC, and on Windows the Windows Media Player that comes with Windows. Installing ffmpeg gives the most reliable playback (`winget install Gyan.FFmpeg` on Windows).
- **`curl`** for song titles. It ships with Windows 10 and later, macOS and most Linux systems. Every 30 seconds the mod reads 3 seconds of the stream to find the current title.
- The pane's pictures draw in the **desktop app**. In a terminal the pane shows a short text version with the same buttons.

## The station and its terms

The radio is **FluxFM ChillHop** (instrumental lofi and chillhop, 320 kbit/s MP3). FluxFM publishes this stream address on its page "Für externe Player" ("for external players"), which invites use in outside players. The mod streams it live and never saves the audio. SomaFM was ruled out because its terms ban third-party apps.

`/music fm` only opens the Claude FM YouTube livestream in your browser. The mod never downloads, records or rips audio from YouTube or anywhere else.

## Development

- `claude plugin validate .` checks the manifest and the hooks module.
- `claude plugin test .` runs the tests in `tests/`.
- `node scripts/preview.mjs pane 31x39,62x39 city night vibing` writes `.preview/preview.html`, a stand-in for the desktop pane at the given sizes. `node scripts/sheet.mjs` writes a contact sheet of every scene. Serve `.preview/` with the `preview` entry in `.claude/launch.json` (port 8790). Needs Node 22.18 or later.
- `PLAN.md` has the design, the decisions and what the spike found.

## License

MIT
