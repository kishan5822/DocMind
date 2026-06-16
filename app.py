"""DocMind — Streamlit app (UI shell only; logic lives in the docmind package).

Per-browser session isolation: each session gets a UUID stored in
st.session_state, mapped to an isolated Session (own documents + memory).
"""
from __future__ import annotations

import streamlit as st

from docmind.config import config
from docmind.formatting import format_answer
from docmind.llm import fetch_models_from_api
from docmind.logging_config import get_logger
from docmind.session import session_manager
from docmind.validation import FileInput, ValidationError

logger = get_logger(__name__)

st.set_page_config(page_title="DocMind", page_icon="📄", layout="wide")


@st.cache_resource(show_spinner="Loading embedding model (first run only)…")
def _warmup_models() -> None:
    """Load the embedding model and reranker into RAM at startup.

    Without this, the first upload pays the full model-load penalty mid-ingest.
    st.cache_resource ensures it runs exactly once per server process.
    """
    from docmind.embeddings import embed_query
    from docmind.retrieval import _get_ranker
    embed_query("warmup")  # triggers model download + load
    _get_ranker()           # triggers reranker download + load


_warmup_models()


@st.cache_data(ttl=300, show_spinner=False)
def _get_models():
    """Fetch live Groq model list; cached for 5 minutes, falls back on error."""
    return fetch_models_from_api()


# --- session bootstrap ---

def _ensure_session() -> None:
    if "session_id" not in st.session_state:
        st.session_state.session_id = session_manager.new_session_id()
        st.session_state.messages = []
        st.session_state.model = config.default_model
        st.session_state.uploader_key = 0  # rotated after each ingest to reset the widget
    # Opportunistic cleanup of other idle sessions.
    session_manager.cleanup_expired()


def _current_session():
    return session_manager.get_or_create(st.session_state.session_id)


def _new_chat() -> None:
    """End the current session (full cleanup) and start a fresh one."""
    session_manager.end_session(st.session_state.session_id)
    st.session_state.session_id = session_manager.new_session_id()
    st.session_state.messages = []
    st.session_state.uploader_key = st.session_state.get("uploader_key", 0) + 1


_ensure_session()
session = _current_session()


# --- sidebar: model, upload, new chat ---

with st.sidebar:
    st.title("📄 DocMind")
    st.caption("Ask questions grounded in your own documents.")

    models = _get_models()
    current = st.session_state.model
    st.session_state.model = st.selectbox(
        "Model", models,
        index=models.index(current) if current in models else 0,
    )

    st.divider()
    st.subheader("Upload documents")
    uploaded = st.file_uploader(
        f"Up to {config.max_files_per_batch} files, "
        f"{config.max_file_mb} MB each, {config.max_batch_mb} MB total.",
        accept_multiple_files=True,
        type=["pdf", "docx", "pptx", "xlsx", "csv", "json", "txt", "md", "html", "htm", "png", "jpg", "jpeg"],
        key=f"uploader_{st.session_state.uploader_key}",
    )

    # Only pass files not already ingested in this session.
    already_ingested = set(session.ingested_files)
    new_files = [f for f in (uploaded or []) if f.name not in already_ingested]
    already_in_widget = [f for f in (uploaded or []) if f.name in already_ingested]

    if already_in_widget:
        st.caption(f"Already ingested (will skip): {', '.join(f.name for f in already_in_widget)}")

    if st.button("Ingest", type="primary", disabled=not new_files):
        files = [FileInput(name=f.name, data=f.getvalue()) for f in new_files]
        try:
            progress_bar = st.progress(0, text="Starting…")
            status_text = st.empty()

            def _on_progress(done: int, total: int, msg: str) -> None:
                frac = done / total if total else 1.0
                progress_bar.progress(frac, text=f"File {done}/{total}")
                status_text.caption(msg)

            report = session.ingest(files, progress_callback=_on_progress)
            progress_bar.empty()
            status_text.empty()
        except ValidationError as e:
            st.error(str(e))
        else:
            if report.ingested:
                st.success(
                    f"Ingested {len(report.ingested)} file(s), "
                    f"{report.chunks_added} chunks."
                )
                # Rotate the uploader key to clear the widget for the next batch.
                st.session_state.uploader_key += 1
                st.rerun()
            for name, reason in report.skipped:
                st.warning(f"Skipped **{name}**: {reason}")
            if not report.ingested and not report.skipped:
                st.info("Nothing to ingest.")

    if session.ingested_files:
        st.divider()
        st.subheader("In this session")
        for name in session.ingested_files:
            st.write(f"• {name}")

    st.divider()
    if st.button("🆕 New chat (clears documents + memory)"):
        _new_chat()
        st.rerun()


# --- main: chat ---

st.header("Chat")

if not session.ingested_files:
    st.info("Upload and ingest documents in the sidebar to begin.")

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

prompt = st.chat_input("Ask a question about your documents...")
if prompt:
    with st.chat_message("user"):
        st.markdown(prompt)
    st.session_state.messages.append({"role": "user", "content": prompt})

    with st.chat_message("assistant"):
        placeholder = st.empty()
        accumulated = ""
        for delta in session.ask(prompt, st.session_state.model):
            accumulated += delta
            placeholder.markdown(accumulated + "▌")
        final = format_answer(accumulated)
        placeholder.markdown(final)

    st.session_state.messages.append({"role": "assistant", "content": format_answer(accumulated)})
