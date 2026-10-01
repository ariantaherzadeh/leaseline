# LeaseLine

**An AI voice leasing assistant, built on [ElevenLabs Agents](https://elevenlabs.io/agents).**

**Live demo: [tryleaseline.com](https://tryleaseline.com)**

Renters talk to **Nora** in the browser. She learns what they need (budget, bedrooms, move-in
date, parking, pets, lifestyle), recommends the best-fit home and explains why, answers questions
from verified listing data, and books a showing with the leasing team.

> 🚧 Work in progress. See [docs/DESIGN.md](docs/DESIGN.md) for the architecture and roadmap.

## How it works

- **Agent as code.** The agent's prompt, config and listings live in this repo. A Python CLI syncs
  them to ElevenLabs.
- **Git is the admin panel.** Add a listing by opening a PR with one Markdown file. CI validates it,
  and on merge Nora and the website both update.
- **A real front desk.** A Next.js site on Netlify embeds the ElevenLabs widget; as Nora talks,
  the home she recommends lights up. The agent is locked to the site's domain.
- **The leasing team's side.** After a call, open the back-office view to see the lead, summary
  and call-quality checks ElevenLabs generated from that conversation.

## Development

Requires [uv](https://docs.astral.sh/uv/).

```bash
uv sync                      # install
cp .env.example .env         # add your ElevenLabs API key
uv run leaseline --help      # CLI
uv run pytest                # tests

npm ci          # site dependencies
npm run dev:site     # http://localhost:3000
```

Contributions go through pull requests. See [CLAUDE.md](CLAUDE.md) for conventions.

## License

[MIT](LICENSE)
