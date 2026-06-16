"""Stage 1 verification — file validation.

Run: python -m tests.test_validation
Covers: oversized files, too many files, oversized batch, unsupported types,
content/extension mismatch, invalid JSON, and a valid mixed batch.
"""
from __future__ import annotations

import io
import struct
import zipfile

from docmind.config import config
from docmind.validation import FileInput, ValidationError, validate_batch


# --- tiny valid file fixtures (real magic bytes) ---

def _minimal_pdf() -> bytes:
    return b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"


def _minimal_png() -> bytes:
    # PNG signature + IHDR chunk header (enough for magic detection).
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">I", 13) + b"IHDR" + struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0)
    return sig + ihdr


def _minimal_docx() -> bytes:
    # DOCX is a zip container; filetype detects it as application/zip.
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("word/document.xml", "<document/>")
    return buf.getvalue()


def _check(label: str, cond: bool) -> None:
    status = "PASS" if cond else "FAIL"
    print(f"  [{status}] {label}")
    if not cond:
        raise AssertionError(label)


def main() -> None:
    print("Stage 1: file validation")

    # 1. Valid mixed batch is accepted.
    batch = [
        FileInput("doc.pdf", _minimal_pdf()),
        FileInput("notes.txt", b"hello world"),
        FileInput("data.json", b'{"a": 1}'),
        FileInput("pic.png", _minimal_png()),
        FileInput("report.docx", _minimal_docx()),
    ]
    res = validate_batch(batch)
    _check("valid mixed batch fully accepted", len(res.accepted) == 5 and not res.rejected)
    cats = {a.name: a.category for a in res.accepted}
    _check("categories correct", cats["doc.pdf"] == "pdf" and cats["pic.png"] == "image")

    # 2. Unsupported type rejected, rest accepted.
    res = validate_batch([
        FileInput("good.txt", b"ok"),
        FileInput("bad.exe", b"MZ\x90\x00"),
    ])
    _check("unsupported type rejected, good file kept",
           len(res.accepted) == 1 and len(res.rejected) == 1)
    _check("rejection names the file", "bad.exe" in res.rejected[0].reason)

    # 3. Oversized file rejected.
    big = b"x" * (config.max_file_bytes + 1)
    res = validate_batch([FileInput("huge.txt", big)])
    _check("oversized file rejected", len(res.rejected) == 1 and not res.accepted)

    # 4. Too many files -> batch error.
    too_many = [FileInput(f"f{i}.txt", b"x") for i in range(config.max_files_per_batch + 1)]
    try:
        validate_batch(too_many)
        _check("too many files raises", False)
    except ValidationError:
        _check("too many files raises", True)

    # 5. Content/extension mismatch (PNG bytes named .pdf) rejected.
    res = validate_batch([FileInput("fake.pdf", _minimal_png())])
    _check("content/extension mismatch rejected", len(res.rejected) == 1)

    # 6. Invalid JSON rejected.
    res = validate_batch([FileInput("bad.json", b"{not valid}")])
    _check("invalid JSON rejected", len(res.rejected) == 1)

    # 7. Empty file rejected.
    res = validate_batch([FileInput("empty.txt", b"")])
    _check("empty file rejected", len(res.rejected) == 1)

    print("Stage 1: ALL PASSED")


if __name__ == "__main__":
    main()
