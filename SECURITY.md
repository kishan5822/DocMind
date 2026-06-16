# Security Policy

## Security Model

DocMind is designed with security-first principles:

### 1. API Key Confinement

- **Read-only location**: `docmind/config.py:59` — from environment variable `GROQ_API_KEY`
- **Single egress point**: `docmind/llm.py` — the ONLY module that imports the Groq SDK
- **Never hardcoded**: Key is read from env at runtime, never embedded in code
- **Never logged**: `docmind/logging_config.py` redacts the key from all log messages
- **Never sent to frontend**: The key never appears in HTTP responses or client-side code
- **Verified by**: `tests/test_api_key_audit.py` — static audit that scans the codebase

### 2. Per-Session Data Isolation

- **Isolated vector store**: Each session gets its own ChromaDB collection, named `session-{uuid}`
- **Query scoping**: Vector searches are scoped to a single session collection — one user cannot retrieve another's chunks
- **Isolated BM25 index**: In-memory keyword index is per-session
- **Isolated uploads**: Uploaded files are stored in `.docmind_data/uploads/{session_id}/` — one user cannot access another's files
- **Isolation enforced at data layer**: Not in the UI — cannot be bypassed by tampering with cookies
- **Verified by**: `tests/test_vector_isolation()` in test_pipeline.py — User A and User B upload different docs; User A queries cannot retrieve User B's chunks

### 3. File Upload Validation

- **Magic-byte verification**: Files are validated by content (magic bytes), not extension alone
- **JSON schema validation**: JSON files are parsed and validated
- **Batch limits enforced**:
  - Max 10 files per batch
  - Max 100 MB per batch
  - Max 10 MB per file
  - Oversized files are rejected with clear error
- **Content type mismatch detection**: If extension claims PDF but content is ZIP, file is rejected
- **Verified by**: `tests/test_validation.py` — 7 test cases covering edge cases

### 4. Ephemeral Design

- **No permanent storage**: Documents, embeddings, and chat history are deleted on session expiry
- **Auto-cleanup**: Sessions older than TTL (default 120 minutes) are automatically destroyed
- **Full cleanup**: When a session expires, the code:
  1. Drops the ChromaDB collection
  2. Clears the BM25 index
  3. Deletes uploaded files from disk
  4. Clears chat history from memory
- **Verified by**: `tests/test_cleanup()` in test_pipeline.py

### 5. Local-Only ML Pipeline

- **No model API keys**: Embedding, chunking, retrieval, and reranking all use local, open-source models
- **No external API calls during RAG**: Only the final LLM inference call goes to Groq
- **No user data sent to third parties**: Document text never leaves your machine except as part of the LLM request (and only the relevant context chunks, not the entire corpus)

## Threat Model

### In Scope

| Threat | Mitigation |
|--------|-----------|
| API key exposure (hardcoding, logging, network) | Confined to config.py, used in llm.py only, redacted from logs |
| One user accessing another's data | Per-session isolation enforced at ChromaDB collection layer |
| Malicious file uploads | Content validation by magic bytes, not extension; batch limits |
| Session hijacking | Sessions auto-expire; no persistent auth tokens |
| Data persistence after session end | Full cleanup: collections, indexes, uploads, history deleted |

### Out of Scope

| Threat | Reason |
|--------|--------|
| Browser vulnerabilities | DocMind relies on Streamlit's browser sandbox |
| OS-level file access | If an attacker has filesystem access, all bets are off |
| Memory dumps | A running process's memory can always be inspected by root/admin |
| Network eavesdropping (HTTP) | Deploy with HTTPS in production; see `README.md` deployment section |
| Groq API rate limits / DoS | Your API key controls rate limiting; set limits in Groq console |

## Reporting Security Issues

**Do not open a public issue for security vulnerabilities.**

Email: [Contact the maintainer]

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

The maintainer will respond within 48 hours.

## Dependencies

All dependencies are pinned in `requirements.txt`. Regularly update and audit:

```bash
pip list --outdated
pip install --upgrade-all
```

Key security-critical dependencies:
- `groq` — API client; always use the latest version
- `chromadb` — Vector database; isolated per session
- `streamlit` — Web framework; relies on upstream security

## Testing Security

Run security audits:

```bash
# API key containment audit
python -m tests.test_api_key_audit

# Data isolation audit
python -m tests.test_pipeline  # includes test_vector_isolation()

# File validation audit
python -m tests.test_validation

# Full end-to-end with multiple sessions
python -m tests.test_e2e
```

## Production Checklist

Before deploying to production:

- [ ] Use HTTPS (TLS 1.2+)
- [ ] Set strong `GROQ_API_KEY` (never commit)
- [ ] Configure `SESSION_TTL_MINUTES` (default 120 min)
- [ ] Use a process supervisor (systemd, supervisor, gunicorn)
- [ ] Enable audit logging (see `docmind/logging_config.py`)
- [ ] Run all security tests
- [ ] Review `.env.example` for required variables
- [ ] Disable telemetry in `.streamlit/config.toml`

---

**Last updated**: 2026-06-16
