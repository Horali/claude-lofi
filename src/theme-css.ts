// Shared colours for the SVG parts: paper in light mode, ink in dark mode.
// The world is black-and-white; the warm accent is kept for the character,
// the song title and the level bars.
export const FONT_STACK = "ui-monospace,Consolas,'Cascadia Mono',monospace"

export const PALETTE_CSS = `
.bg{fill:#efede6}.frame{fill:none;stroke:#b9b6ac}
.ink{fill:#2b2a26}.ink2{fill:#5d5b54}.ink3{fill:#8f8c82}.ink4{fill:#bdbab0}
.accent{fill:#c96a3f}.paper{fill:#f7f5ef}
@media (prefers-color-scheme: dark){
.bg{fill:#141413}.frame{stroke:#3a3934}
.ink{fill:#ecebe4}.ink2{fill:#b3b0a6}.ink3{fill:#77746b}.ink4{fill:#46443e}
.accent{fill:#e07a4c}.paper{fill:#1c1c1a}}
`
