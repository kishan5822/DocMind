"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, X } from "lucide-react";

import { ApiError, deleteGroqKey, saveGroqKey } from "@/lib/api";

interface SettingsDialogProps {
  open: boolean;
  hasKey: boolean;
  onClose: () => void;
  /** Called after the stored key changes so the parent can refetch models. */
  onKeyChange: (hasKey: boolean) => void;
}

export function SettingsDialog({
  open,
  hasKey,
  onClose,
  onKeyChange,
}: SettingsDialogProps) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Reset transient state whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setValue("");
      setShow(false);
      setError(null);
      setSaved(false);
    }
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const save = async () => {
    if (!value.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await saveGroqKey(value.trim());
      onKeyChange(res.has_groq_key);
      setSaved(true);
      setValue("");
      setTimeout(onClose, 600);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't save the key."
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await deleteGroqKey();
      onKeyChange(res.has_groq_key);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't remove the key."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <button
        type="button"
        aria-label="Close settings"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-bg-100 p-6 shadow-input-hover">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-text-400 transition-colors hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-1 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-accent" />
          <h2 id="settings-title" className="text-lg font-semibold text-foreground">
            Groq API key
          </h2>
        </div>
        <p className="mb-4 text-sm text-text-300">
          DocMind uses your own Groq key to generate answers. Get a free key at{" "}
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2 hover:text-accent-hover"
          >
            console.groq.com/keys
          </a>
          .
        </p>

        {hasKey && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-border bg-bg-0 px-3 py-2.5 text-sm">
            <span className="text-text-200">A key is saved for your account.</span>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="font-medium text-destructive transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        )}

        <label className="mb-1.5 block text-sm font-medium text-text-200">
          {hasKey ? "Replace key" : "Paste your key"}
        </label>
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="gsk_..."
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-xl border border-border bg-bg-0 px-3 py-2.5 pr-10 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-ring/30"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide key" : "Show key"}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-400 transition-colors hover:text-foreground"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        {saved && <p className="mt-2 text-sm text-accent">Saved ✓</p>}

        <p className="mt-3 text-xs text-text-400">
          Your key is encrypted and stored on the DocMind server against your
          account. It is used only to call Groq and never shared.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-text-300 transition-colors hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || !value.trim()}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-on-primary transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Save key
          </button>
        </div>
      </div>
    </div>
  );
}
