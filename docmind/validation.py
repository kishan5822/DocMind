"""Stage 1 — file validation.

Validates a batch of uploaded files against count, size, and type limits.
Type detection uses real content (magic bytes) for binary formats and a decode
check for text formats — never the extension alone. A single bad file never
fails the batch: it is rejected with a specific reason and the rest proceed.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence, Tuple

import filetype

from .config import config
from .logging_config import get_logger

logger = get_logger(__name__)

# Logical category -> accepted file extensions.
_EXT_TO_CATEGORY: Dict[str, str] = {
    "pdf": "pdf",
    "docx": "docx",
    "pptx": "pptx",
    "xlsx": "xlsx",
    "csv": "csv",
    "json": "json",
    "txt": "text",
    "md": "text",
    "markdown": "text",
    "html": "html",
    "htm": "html",
    "png": "image",
    "jpg": "image",
    "jpeg": "image",
}

# Extensions whose content is plain text (no reliable magic bytes).
_TEXT_EXTS = {"csv", "json", "txt", "md", "markdown", "html", "htm"}

# filetype-detected MIME -> expected extension family, for binary spoof checks.
_MIME_FAMILY: Dict[str, set] = {
    "application/pdf": {"pdf"},
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {"docx"},
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": {"pptx"},
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {"xlsx"},
    "application/zip": {"docx", "pptx", "xlsx"},  # OOXML are zip containers
    "image/png": {"png"},
    "image/jpeg": {"jpg", "jpeg"},
}


class ValidationError(Exception):
    """Raised when a file or batch fails validation."""


@dataclass
class FileInput:
    """A single uploaded file: original name and raw bytes."""

    name: str
    data: bytes

    @property
    def size(self) -> int:
        return len(self.data)


@dataclass
class AcceptedFile:
    name: str
    data: bytes
    category: str  # pdf | docx | pptx | xlsx | csv | json | text | html | image


@dataclass
class RejectedFile:
    name: str
    reason: str


@dataclass
class BatchResult:
    accepted: List[AcceptedFile]
    rejected: List[RejectedFile]

    @property
    def has_accepted(self) -> bool:
        return len(self.accepted) > 0


def _extension(name: str) -> str:
    if "." not in name:
        return ""
    return name.rsplit(".", 1)[-1].lower()


def _validate_single(f: FileInput) -> AcceptedFile:
    """Validate one file. Raises ValidationError with a specific reason."""
    if f.size == 0:
        raise ValidationError(f"'{f.name}' is empty.")

    if f.size > config.max_file_bytes:
        raise ValidationError(
            f"'{f.name}' is {f.size / 1024 / 1024:.1f} MB, "
            f"over the {config.max_file_mb} MB per-file limit."
        )

    ext = _extension(f.name)
    if ext not in _EXT_TO_CATEGORY:
        raise ValidationError(
            f"'{f.name}' has unsupported type '.{ext or '(none)'}'. "
            f"Allowed: PDF, DOCX, PPTX, XLSX, CSV, JSON, TXT, MD, HTML, PNG, JPG."
        )
    category = _EXT_TO_CATEGORY[ext]

    if ext in _TEXT_EXTS:
        _verify_text_content(f, ext)
    else:
        _verify_binary_content(f, ext)

    return AcceptedFile(name=f.name, data=f.data, category=category)


def _verify_text_content(f: FileInput, ext: str) -> None:
    """Confirm a text file actually decodes; validate JSON structure."""
    try:
        text = f.data.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text = f.data.decode("latin-1")
        except UnicodeDecodeError:
            raise ValidationError(f"'{f.name}' is not readable as text.")
    if ext == "json":
        try:
            json.loads(text)
        except json.JSONDecodeError as e:
            raise ValidationError(f"'{f.name}' is not valid JSON: {e.msg} (line {e.lineno}).")


def _verify_binary_content(f: FileInput, ext: str) -> None:
    """Confirm binary content matches its claimed extension via magic bytes."""
    kind = filetype.guess(f.data)
    if kind is None:
        raise ValidationError(
            f"'{f.name}' content does not match a known '{ext}' file "
            f"(could not detect a valid file signature)."
        )
    expected = _MIME_FAMILY.get(kind.mime)
    if expected is None or ext not in expected:
        raise ValidationError(
            f"'{f.name}' claims '.{ext}' but its content looks like "
            f"'{kind.mime}'. File type mismatch — rejected for safety."
        )


def validate_batch(files: Sequence[FileInput]) -> BatchResult:
    """Validate a whole upload batch.

    Batch-level limits (count, total size) raise ValidationError outright.
    Per-file failures are collected as rejections; valid files still pass.
    """
    if not files:
        raise ValidationError("No files were provided.")

    if len(files) > config.max_files_per_batch:
        raise ValidationError(
            f"{len(files)} files exceeds the limit of "
            f"{config.max_files_per_batch} files per batch."
        )

    total = sum(f.size for f in files)
    if total > config.max_batch_bytes:
        raise ValidationError(
            f"Batch total {total / 1024 / 1024:.1f} MB exceeds the "
            f"{config.max_batch_mb} MB limit."
        )

    accepted: List[AcceptedFile] = []
    rejected: List[RejectedFile] = []
    for f in files:
        try:
            accepted.append(_validate_single(f))
        except ValidationError as e:
            logger.warning("Rejected file '%s': %s", f.name, e)
            rejected.append(RejectedFile(name=f.name, reason=str(e)))

    return BatchResult(accepted=accepted, rejected=rejected)
