# Contributing to DocMind

Thank you for your interest in contributing! This document outlines how to get started.

## Development Setup

```bash
git clone https://github.com/kishan5822/DocMind.git
cd DocMind
py -3.12 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Before you start

- Ensure Python 3.12 is installed
- Set `GROQ_API_KEY` in your `.env` (required for tests)
- Run the test suite: `python -m tests.test_pipeline`

## Code guidelines

- **Single responsibility**: Each module does one thing well
- **No circular imports**: Keep the dependency graph clean
- **Thread-safety**: Use locks for shared state (see `embeddings.py`, `session.py`)
- **Type hints**: Use them where they aid clarity (not everywhere)
- **Comments**: Only for WHY, not WHAT; well-named code is self-documenting

## Testing

All changes should pass the test suite:

```bash
python -m tests.test_validation      # Stage 1
python -m tests.test_pipeline        # Stages 2–6, 10, 12
python -m tests.test_api_key_audit   # Security audit
python -m tests.test_generation      # Stages 7 & 9 (needs key)
python -m tests.test_e2e             # Full end-to-end
```

## Security

- **Never commit `.env`** — it contains `GROQ_API_KEY`
- API key usage is audited: read in `config.py`, used only in `llm.py`
- Per-session isolation is enforced at the data layer (`vector_store.py`)
- Review `SECURITY.md` for the full security model

## Commit messages

Keep commits focused and clear:

```
Short title (50 chars max)

Detailed explanation of what changed and why. Reference any related issues.
```

## Getting help

- Check existing issues and discussions
- Review the full documentation in `README.md`

---

We appreciate all contributions!
