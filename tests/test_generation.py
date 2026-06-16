"""Stages 7 & 9 — generation + memory (requires GROQ_API_KEY).

Skips cleanly if no key is set. Run: python -m tests.test_generation
Verifies: grounded answer, refusal when context lacks the answer, and that
follow-up questions in a session use prior memory.
"""
from __future__ import annotations

import os

from docmind.session import session_manager


def _check(label: str, cond: bool) -> None:
    print(f"  [{'PASS' if cond else 'FAIL'}] {label}")
    if not cond:
        raise AssertionError(label)


def main() -> None:
    if not os.getenv("GROQ_API_KEY", "").strip():
        print("Stages 7 & 9: SKIPPED (no GROQ_API_KEY set)")
        return

    print("Stages 7 & 9: generation + memory")
    from docmind.validation import FileInput

    sess = session_manager.get_or_create("gentest")
    sess.cleanup()
    sess = session_manager.get_or_create("gentest")

    content = (
        b"DocMind was founded in 2021 by Maya Lin. Its headquarters are in Oslo. "
        b"The flagship product is a document question-answering engine."
    )
    report = sess.ingest([FileInput("about.txt", content)])
    _check("ingestion succeeded", report.ok)

    # 1. Grounded answer.
    ans = "".join(sess.ask("Who founded DocMind and when?", "llama-3.1-8b-instant"))
    print("    >", ans[:120].replace("\n", " "))
    _check("grounded answer mentions founder", "Maya Lin" in ans or "maya" in ans.lower())
    _check("grounded answer mentions year", "2021" in ans)

    # 2. Refusal when context lacks the answer.
    refusal = "".join(sess.ask("What is the company's annual revenue?", "llama-3.1-8b-instant"))
    print("    >", refusal[:120].replace("\n", " "))
    _check("declines when info absent",
           any(p in refusal.lower() for p in ["don't have", "do not have", "not enough", "no information", "cannot find"]))

    # 3. Memory: follow-up relies on prior turn.
    sess.ask("Who founded DocMind?", "llama-3.1-8b-instant")  # establishes subject
    followup = "".join(sess.ask("Where is it headquartered?", "llama-3.1-8b-instant"))
    print("    >", followup[:120].replace("\n", " "))
    _check("follow-up uses memory (Oslo)", "oslo" in followup.lower())

    # 4. New session has fresh memory.
    fresh = session_manager.get_or_create("gentest-fresh")
    fresh.cleanup()
    fresh = session_manager.get_or_create("gentest-fresh")
    _check("new session memory empty", fresh.history == [])

    sess.cleanup()
    fresh.cleanup()
    print("Stages 7 & 9: PASSED")


if __name__ == "__main__":
    main()
