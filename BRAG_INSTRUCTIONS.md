# Launch Video Instructions

The launch video was not produced in this environment. FFmpeg is not on `PATH`, and no backend `MONGO_URI` is configured, so the video prerequisites and demo seed are unavailable. Do not claim a video exists until `brag-output/brag.mp4` has actually been generated and inspected.

## Prerequisites

1. Use Node.js 22 or newer. Confirm with `node -v`.
2. Install FFmpeg using the approved package manager for your machine, reopen PowerShell, and confirm `ffmpeg -version` works.
3. Configure `backend/.env` with a non-production MongoDB URI for a database where Routely demo records may be created. Never use `--force` against production for this workflow. The seed script only creates the marked demo route/trip and leaves existing demo records unchanged.
4. Install the brag skill and check Hyperframes:

```powershell
npx skills add https://github.com/latent-spaces/brag --skill brag
npx hyperframes doctor
```

If `/brag` is not available in Copilot, open the installed `skills/brag/SKILL.md` and follow it directly as instructions. The repo's `docs/other-agents.md` may describe agent-specific guidance if present in your checkout.

## Seed Demo Data

From the repository root in PowerShell:

```powershell
if ($env:NODE_ENV -eq 'production') { throw 'Refusing to seed a production database.' }
Push-Location .\backend
npm run seed:demo
Pop-Location
```

The command requires `MONGO_URI` in `backend/.env` or the process environment. Do not print or paste the URI into prompts or video tooling.

## Generate

Start the app using the project's normal local development procedure, then ask Copilot exactly:

> let's /brag --tone "confident, clean product launch for Nigerian commuters"

Voiceover stays off by default. Use the live frontend URL from the root README if the skill asks for a link: https://public-transport-ticketing-system-1.onrender.com

The video should show trip search, Paystack test-mode checkout or clearly marked demo screens, receiving a QR ticket, conductor validation, and admin analytics. Never enter real card details, use real personal data, display credentials, or show `.env` contents. Use only the marked demo trip/account data for any on-screen identities; do not expose production users or production records. If a requested workflow cannot use isolated demo data, stop and use clearly labeled demo screens instead.

After generation, inspect the plan, brief, share copy, and video in `brag-output/`. Report their actual paths and quote the produced share copy. `brag-output/` is gitignored and must not be committed.
