# LeaseLine

**An AI voice leasing assistant, built on [ElevenLabs Agents](https://elevenlabs.io/agents).**

Renters talk to **Steve** in the browser. He learns what they need (budget, bedrooms, move-in
date, parking, pets, lifestyle), recommends the best-fit home and explains why, answers questions
from verified listing data, and books a showing with the leasing team.

> 🚧 Work in progress. See [docs/DESIGN.md](docs/DESIGN.md) for the architecture and roadmap.

## How it works

- **Agent as code.** The agent's prompt, config and listings live in this repo. A Python CLI syncs
  them to ElevenLabs.
- **Git is the admin panel.** Add a listing by opening a PR with one Markdown file. CI validates it,
  and on merge Steve and the website both update.
- **No backend.** A static site on Netlify embeds the ElevenLabs widget; the agent is locked to the
  site's domain.

## License

[MIT](LICENSE)
