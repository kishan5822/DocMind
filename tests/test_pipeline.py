"""Stages 2-6, 10, 12 verification (no Groq key needed).

Run: python -m tests.test_pipeline
"""
from __future__ import annotations

import pandas as pd

from docmind.chunking import chunk_documents, count_tokens
from docmind.config import config
from docmind.embeddings import embed_documents, embed_query, embedding_dim
from docmind.formatting import format_answer
from docmind.keyword_index import KeywordIndex
from docmind.parsing import parse_file
from docmind.retrieval import retrieve
from docmind.validation import AcceptedFile
from docmind.vector_store import VectorStore
from tests import fixtures as fx


def _check(label: str, cond: bool) -> None:
    print(f"  [{'PASS' if cond else 'FAIL'}] {label}")
    if not cond:
        raise AssertionError(label)


def _accepted(name: str, data: bytes, category: str) -> AcceptedFile:
    return AcceptedFile(name=name, data=data, category=category)


def test_parsing() -> None:
    print("Stage 2: parsing")

    pdf = fx.make_pdf(["Quarterly revenue grew significantly.", "Region\tSales", "North\t100"])
    doc = parse_file(_accepted("report.pdf", pdf, "pdf"))
    _check("PDF text extracted", "revenue" in doc.full_text.lower())
    _check("PDF table cell extracted", "North" in doc.full_text)

    docx = fx.make_docx("Introduction", ["The system is fast and secure."],
                        table_rows=[["Metric", "Value"], ["Latency", "12ms"]])
    doc = parse_file(_accepted("d.docx", docx, "docx"))
    _check("DOCX heading captured", any(s.heading == "Introduction" for s in doc.sections))
    _check("DOCX table captured", "Latency" in doc.full_text)

    pptx = fx.make_pptx([("Agenda", "Discuss roadmap and goals.")])
    doc = parse_file(_accepted("p.pptx", pptx, "pptx"))
    _check("PPTX content extracted", "roadmap" in doc.full_text.lower())

    df = pd.DataFrame({"name": ["Alice", "Bob"], "score": [90, 85]})
    doc = parse_file(_accepted("s.xlsx", fx.make_xlsx(df), "xlsx"))
    _check("XLSX extracted", "Alice" in doc.full_text)
    doc = parse_file(_accepted("c.csv", fx.make_csv(df), "csv"))
    _check("CSV extracted", "Bob" in doc.full_text)

    doc = parse_file(_accepted("j.json", fx.make_json({"city": "Paris"}), "json"))
    _check("JSON extracted", "Paris" in doc.full_text)

    doc = parse_file(_accepted("h.html", fx.make_html("T", "Hello world body"), "html"))
    _check("HTML extracted", "Hello world body" in doc.full_text)

    doc = parse_file(_accepted("t.txt", fx.make_txt("plain text content"), "text"))
    _check("TXT extracted", "plain text content" in doc.full_text)


def test_chunking() -> None:
    print("Stage 3: chunking")
    long_text = " ".join(f"sentence number {i} about topic alpha." for i in range(400))
    doc = parse_file(_accepted("big.txt", long_text.encode(), "text"))
    chunks = chunk_documents([doc])
    _check("multiple chunks produced", len(chunks) > 1)
    _check("metadata prefix present", all(c.text.startswith("Source:") for c in chunks))
    _check("filename in metadata", all(c.metadata["filename"] == "big.txt" for c in chunks))
    _check("chunks within token budget", all(count_tokens(c.text) <= config.chunk_size_tokens + 8 for c in chunks))
    # Overlap: end of chunk i shares tokens with start of chunk i+1.
    overlap_found = any(
        chunks[i].raw_text.split()[-3:] and
        any(w in chunks[i + 1].raw_text.split()[:20] for w in chunks[i].raw_text.split()[-3:])
        for i in range(len(chunks) - 1)
    )
    _check("overlap present between chunks", overlap_found)


def test_embedding() -> None:
    print("Stage 4: embedding (local)")
    vecs = embed_documents(["hello world", "second document"])
    _check("two vectors returned", len(vecs) == 2)
    _check("expected dimension 768", len(vecs[0]) == 768 and embedding_dim() == 768)
    norm = sum(x * x for x in vecs[0]) ** 0.5
    _check("vectors normalised", abs(norm - 1.0) < 1e-3)
    q = embed_query("a question")
    _check("query embedding dim matches", len(q) == 768)


def test_vector_isolation() -> None:
    print("Stage 5: vector store + isolation")
    a = VectorStore("isolationtestA")
    b = VectorStore("isolationtestB")
    a.delete(); b.delete()
    a = VectorStore("isolationtestA")
    b = VectorStore("isolationtestB")

    doc_a = parse_file(_accepted("a.txt", b"The secret animal of user A is the aardvark.", "text"))
    doc_b = parse_file(_accepted("b.txt", b"The secret animal of user B is the zebra.", "text"))
    ca = chunk_documents([doc_a]); cb = chunk_documents([doc_b])
    a.add_chunks(ca, embed_documents([c.text for c in ca]))
    b.add_chunks(cb, embed_documents([c.text for c in cb]))

    qvec = embed_query("what is the secret animal?")
    hits_a = a.query(qvec, top_k=5)
    hits_b = b.query(qvec, top_k=5)
    text_a = " ".join(h["text"] for h in hits_a)
    text_b = " ".join(h["text"] for h in hits_b)
    _check("A sees only A's data", "aardvark" in text_a and "zebra" not in text_a)
    _check("B sees only B's data", "zebra" in text_b and "aardvark" not in text_b)
    a.delete(); b.delete()


def test_retrieval() -> None:
    print("Stage 6: hybrid retrieval")
    store = VectorStore("retrievaltest")
    store.delete()
    store = VectorStore("retrievaltest")

    facts = [
        "The Eiffel Tower is located in Paris and is 330 metres tall.",
        "Photosynthesis converts sunlight into chemical energy in plants.",
        "The mitochondria is the powerhouse of the cell.",
        "Mount Everest is the tallest mountain on Earth at 8849 metres.",
    ]
    docs = [parse_file(_accepted(f"f{i}.txt", t.encode(), "text")) for i, t in enumerate(facts)]
    chunks = chunk_documents(docs)
    store.add_chunks(chunks, embed_documents([c.text for c in chunks]))
    kw = KeywordIndex(store.all_documents())

    results = retrieve("How tall is the Eiffel Tower?", store, kw)
    _check("retrieval returns results", len(results) > 0)
    _check("top result is relevant", "Eiffel" in results[0].text)
    _check("respects rerank_top_k", len(results) <= config.rerank_top_k)
    store.delete()


def test_cleanup() -> None:
    print("Stage 10: cleanup")
    from docmind.session import Session

    s = Session("cleanuptest")
    doc = parse_file(_accepted("x.txt", b"some content to store and clean up later", "text"))
    chunks = chunk_documents([doc])
    s.store.add_chunks(chunks, embed_documents([c.text for c in chunks]))
    s._persist("x.txt", b"raw bytes")
    _check("data present before cleanup", s.store.count() > 0 and s._upload_dir.exists())
    s.cleanup()
    fresh = VectorStore("cleanuptest")  # recreate to inspect
    _check("collection emptied after cleanup", fresh.count() == 0)
    _check("upload dir removed", not s._upload_dir.exists())
    fresh.delete()


def test_formatting() -> None:
    print("Stage 12: output formatting")
    wrapped = "```markdown\n**Hello** world\n```"
    _check("code-fence wrapper removed", format_answer(wrapped) == "**Hello** world")
    _check("unbalanced bold fixed", format_answer("**bold without close").count("**") == 0)
    _check("balanced bold kept", format_answer("**bold**").count("**") == 2)
    _check("blank lines collapsed", "\n\n\n" not in format_answer("a\n\n\n\n\nb"))


def main() -> None:
    test_parsing()
    test_chunking()
    test_embedding()
    test_vector_isolation()
    test_retrieval()
    test_cleanup()
    test_formatting()
    print("\nStages 2-6, 10, 12: ALL PASSED")


if __name__ == "__main__":
    main()
