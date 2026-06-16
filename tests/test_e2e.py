"""Stage 11 end-to-end: mirror the app's exact ingest->ask->follow-up->new-chat flow."""
from __future__ import annotations
import os
from docmind.session import session_manager
from docmind.validation import FileInput
from docmind.formatting import format_answer
from tests import fixtures as fx
import pandas as pd

def ck(label, cond):
    print(f"  [{'PASS' if cond else 'FAIL'}] {label}")
    if not cond: raise AssertionError(label)

def main():
    if not os.getenv("GROQ_API_KEY","").strip():
        print("E2E: SKIPPED (no key)"); return
    print("Stage 11: end-to-end (mixed batch)")
    sid = session_manager.new_session_id()
    s = session_manager.get_or_create(sid)

    pdf = fx.make_pdf(["Acme Corp reported revenue of 4.2 million USD in 2024.",
                       "The CEO is Dana Pierce. HQ is in Berlin."])
    df = pd.DataFrame({"product":["Widget","Gadget"],"units":[1200,800]})
    files = [
        FileInput("acme.pdf", pdf),
        FileInput("sales.csv", fx.make_csv(df)),
        FileInput("notes.txt", b"Acme was founded in 2019 and employs 50 people."),
        FileInput("broken.pdf", b"not really a pdf"),   # should be skipped
    ]
    rep = s.ingest(files)
    ck("good files ingested", len(rep.ingested) == 3)
    ck("bad file skipped + reported", any("broken.pdf" in n for n,_ in rep.skipped))

    a1 = "".join(s.ask("What was Acme's 2024 revenue and who is the CEO?", "llama-3.1-8b-instant"))
    print("    >", a1[:140].replace("\n"," "))
    ck("answer grounded (revenue)", "4.2" in a1)
    ck("answer grounded (CEO)", "Dana" in a1 or "Pierce" in a1)

    a2 = "".join(s.ask("How many people does it employ?", "llama-3.1-8b-instant"))
    print("    >", a2[:140].replace("\n"," "))
    ck("follow-up uses memory (employees=50)", "50" in a2)

    a3 = "".join(s.ask("How many Widget units were sold?", "llama-3.1-8b-instant"))
    print("    >", a3[:140].replace("\n"," "))
    ck("csv data retrieved (1200)", "1200" in a3 or "1,200" in a3)

    ck("formatting clean (no stray **)", "**" not in format_answer(a1) or format_answer(a1).count("**")%2==0)

    # New chat: cleanup + fresh
    session_manager.end_session(sid)
    sid2 = session_manager.new_session_id()
    s2 = session_manager.get_or_create(sid2)
    ck("new chat: empty memory", s2.history == [])
    ck("new chat: no documents", s2.store.count() == 0)
    session_manager.end_session(sid2)
    print("Stage 11 E2E: PASSED")

if __name__ == "__main__":
    main()
