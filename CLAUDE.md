# LeaseLine: notes for Claude Code

AI voice leasing assistant ("Steve") on ElevenLabs Agents. The design and roadmap are in
`docs/DESIGN.md`; read it before making structural changes.

## Workflow
- Never commit to `main` (it's protected). Branch → PR → CI green → squash-merge.
- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `ci:`, `test:`).
- One PR per coherent step of the build order in DESIGN.md §11.

## Commands
- `uv sync`: install
- `uv run ruff format . && uv run ruff check .`: format and lint
- `uv run pytest`: tests (offline; never hit the ElevenLabs API)
- `uv run leaseline --help`: CLI
- `uv run leaseline validate -t demo`: check listings
- `uv run leaseline render -t demo`: write the prompt, KB docs and tools to `build/demo/` for review
- `uv run leaseline deploy -t demo --dry-run`: show what would change on ElevenLabs (drop `--dry-run` to apply)

## ElevenLabs API notes (learned the hard way)
- System tools (e.g. `end_call`) go in `prompt.tools` with `type: system`; `built_in_tools` is
  silently ignored.
- Inline client tools are converted into workspace tools (`tool_ids`) and reused by name on
  update. They don't duplicate.
- Validate payloads offline with the SDK models (`ConversationalConfig`,
  `AgentPlatformSettingsRequestModel`); see `tests/test_payload.py`.

## Rules
- Listing facts come only from the source listing or the user. Unknown → `TBD`, never guessed.
- Anything that writes to ElevenLabs supports `--dry-run`.
- `ELEVENLABS_API_KEY` lives in `.env` (gitignored) locally and as a GitHub secret in CI. Never
  print it.
- ElevenLabs API reference: the `agents` skill (`npx skills experimental_install` restores the
  skills from `skills-lock.json`).
