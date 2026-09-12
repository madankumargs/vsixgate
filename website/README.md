# vsixgate — Website

Standalone marketing + live-scanner site for **vsixgate** (pre-publish VS Code extension security scanner).

> This is a **separate part** of the repo — not mixed with the CLI source in `/src`. It has its own `package.json`, build, and routing.

## Stack
- Vite + React 18 + TypeScript + React Router
- Tailwind CSS (white + light red / amber theme)
- JSZip for in-browser .vsix unpack & heuristics (same logic as `src/static`, `src/signatures`, `src/dependency`)

## Structure
```
website/
  public/         # favicon, demo.vsix
  src/
    components/   # Header, Footer, ScoreRing
    pages/        # Home, Examples, ExampleDetail, Scanner
    data/         # 10 curated example scans
    lib/          # scanner.ts (browser-side vsix analysis)
  index.html
  vite.config.ts
```

## Run
```bash
cd website
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/
npm run preview
```

## Features
- **Header / Hero / Footer** with white + light-red/amber professional tech theme (Inter + Space Grotesk + JetBrains Mono)
- **Uniqueness** section: comparison table vs ExtensionTotal/Koi, vsix-audit, VSCan
- **10 example extensions** with realistic findings, score rings, SARIF preview (`/examples/:id`)
- **Dedicated Scanner page** (`/scan`) — drag & drop any `.vsix`, client-side analysis, JSON/SARIF export, no server
- Stats, pipeline (8 stages), architecture

## Design tokens
- Brand: #FF6B35 / #FF8C42 / amber #F59E0B
- Background: white + subtle grid + warm glow
- Cards: rounded-2xl, soft shadows, glass header
