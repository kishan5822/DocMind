"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Plus,
  ChevronDown,
  ArrowUp,
  X,
  FileText,
  Loader2,
  Check,
  Archive,
} from "lucide-react";

/* --- ICONS --- */
export const Icons = {
  Plus,
  SelectArrow: ChevronDown,
  ArrowUp,
  X,
  FileText,
  Loader2,
  Check,
  Archive,
  Thinking: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M10.3857 2.50977C14.3486 2.71054 17.5 5.98724 17.5 10C17.5 14.1421 14.1421 17.5 10 17.5C5.85786 17.5 2.5 14.1421 2.5 10C2.5 9.72386 2.72386 9.5 3 9.5C3.27614 9.5 3.5 9.72386 3.5 10C3.5 13.5899 6.41015 16.5 10 16.5C13.5899 16.5 16.5 13.5899 16.5 10C16.5 6.5225 13.7691 3.68312 10.335 3.50879L10 3.5L9.89941 3.49023C9.67145 3.44371 9.5 3.24171 9.5 3C9.5 2.72386 9.72386 2.5 10 2.5L10.3857 2.50977ZM10 5.5C10.2761 5.5 10.5 5.72386 10.5 6V9.69043L13.2236 11.0527C13.4706 11.1762 13.5708 11.4766 13.4473 11.7236C13.3392 11.9397 13.0957 12.0435 12.8711 11.9834L12.7764 11.9473L9.77637 10.4473C9.60698 10.3626 9.5 10.1894 9.5 10V6C9.5 5.72386 9.72386 5.5 10 5.5ZM3.66211 6.94141C4.0273 6.94159 4.32303 7.23735 4.32324 7.60254C4.32324 7.96791 4.02743 8.26446 3.66211 8.26465C3.29663 8.26465 3 7.96802 3 7.60254C3.00021 7.23723 3.29676 6.94141 3.66211 6.94141ZM4.95605 4.29395C5.32146 4.29404 5.61719 4.59063 5.61719 4.95605C5.6171 5.3214 5.3214 5.61709 4.95605 5.61719C4.59063 5.61719 4.29403 5.32146 4.29395 4.95605C4.29395 4.59057 4.59057 4.29395 4.95605 4.29395ZM7.60254 3C7.96802 3 8.26465 3.29663 8.26465 3.66211C8.26446 4.02743 7.96791 4.32324 7.60254 4.32324C7.23736 4.32302 6.94159 4.0273 6.94141 3.66211C6.94141 3.29676 7.23724 3.00022 7.60254 3Z" />
    </svg>
  ),
};

/* --- TYPES --- */
export interface AttachedFile {
  id: string;
  file: File;
  type: string;
  preview: string | null;
  uploadStatus: "pending" | "uploading" | "complete" | "error";
  content?: string;
}

export interface PastedSnippet {
  id: string;
  content: string;
  timestamp: Date;
}

export interface Model {
  id: string;
  name: string;
  description: string;
  badge?: string;
}

export interface ChatSubmission {
  message: string;
  files: AttachedFile[];
  pastedContent: PastedSnippet[];
  model: string;
  isThinkingEnabled: boolean;
}

/* --- UTILS --- */
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const randomId = () => Math.random().toString(36).slice(2, 11);

/* --- FILE PREVIEW CARD --- */
const FilePreviewCard: React.FC<{
  file: AttachedFile;
  onRemove: (id: string) => void;
}> = ({ file, onRemove }) => {
  const isImage = file.type.startsWith("image/") && file.preview;

  return (
    <div className="relative group flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-bg-300 bg-bg-200 animate-fade-in transition-all hover:border-text-400">
      {isImage ? (
        <div className="w-full h-full relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={file.preview!}
            alt={file.file.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
        </div>
      ) : (
        <div className="w-full h-full p-3 flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-bg-300 rounded">
              <Icons.FileText className="w-4 h-4 text-text-300" />
            </div>
            <span className="text-[10px] font-medium text-text-400 uppercase tracking-wider truncate">
              {file.file.name.split(".").pop()}
            </span>
          </div>
          <div className="space-y-0.5">
            <p
              className="text-xs font-medium text-text-200 truncate"
              title={file.file.name}
            >
              {file.file.name}
            </p>
            <p className="text-[10px] text-text-500">
              {formatFileSize(file.file.size)}
            </p>
          </div>
        </div>
      )}

      <button
        onClick={() => onRemove(file.id)}
        className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
        type="button"
        aria-label="Remove file"
      >
        <Icons.X className="w-3 h-3" />
      </button>

      {file.uploadStatus === "uploading" && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <Icons.Loader2 className="w-5 h-5 text-white animate-spin" />
        </div>
      )}
      {file.uploadStatus === "error" && (
        <div className="absolute inset-0 bg-red-900/70 flex items-center justify-center rounded-xl">
          <Icons.X className="w-5 h-5 text-white" />
        </div>
      )}
    </div>
  );
};

/* --- PASTED CONTENT CARD --- */
const PastedContentCard: React.FC<{
  content: PastedSnippet;
  onRemove: (id: string) => void;
}> = ({ content, onRemove }) => {
  return (
    <div className="relative group flex-shrink-0 w-28 h-28 rounded-2xl overflow-hidden border border-bg-300 bg-bg-100 animate-fade-in p-3 flex flex-col justify-between shadow-input">
      <div className="overflow-hidden w-full">
        <p className="text-[10px] text-text-400 leading-[1.4] font-mono break-words whitespace-pre-wrap line-clamp-4 select-none">
          {content.content}
        </p>
      </div>

      <div className="flex items-center justify-between w-full mt-2">
        <div className="inline-flex items-center justify-center px-1.5 py-[2px] rounded border border-bg-300">
          <span className="text-[9px] font-bold text-text-300 uppercase tracking-wider">
            PASTED
          </span>
        </div>
      </div>

      <button
        onClick={() => onRemove(content.id)}
        className="absolute top-2 right-2 p-[3px] bg-bg-100 border border-bg-300 rounded-full text-text-400 hover:text-text-200 transition-colors shadow-sm opacity-0 group-hover:opacity-100"
        type="button"
        aria-label="Remove pasted content"
      >
        <Icons.X className="w-2 h-2" />
      </button>
    </div>
  );
};

/* --- MODEL SELECTOR --- */
const ModelSelector: React.FC<{
  models: Model[];
  selectedModel: string;
  onSelect: (modelId: string) => void;
}> = ({ models, selectedModel, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentModel = models.find((m) => m.id === selectedModel) || models[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!currentModel) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        className={`inline-flex items-center justify-center relative shrink-0 transition font-medium duration-300 h-8 rounded-xl px-3 min-w-[4rem] active:scale-[0.98] whitespace-nowrap text-xs pl-2.5 pr-2 gap-1 ${
          isOpen
            ? "bg-bg-200 text-text-100"
            : "text-text-300 hover:text-text-200 hover:bg-bg-200"
        }`}
      >
        <span className="whitespace-nowrap select-none">
          {currentModel.name}
        </span>
        <Icons.SelectArrow
          className={`w-4 h-4 shrink-0 opacity-75 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-[260px] bg-bg-100 border border-bg-300 rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col p-1.5 animate-fade-in origin-bottom-right">
          {models.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => {
                onSelect(model.id);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl flex items-start justify-between group transition-colors hover:bg-bg-200"
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-text-100">
                    {model.name}
                  </span>
                  {model.badge && (
                    <span className="px-1.5 py-[1px] rounded-full text-[10px] font-medium border border-bg-300 text-text-300">
                      {model.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-text-300">
                  {model.description}
                </span>
              </div>
              {selectedModel === model.id && (
                <Icons.Check className="w-4 h-4 text-accent mt-1" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* --- MAIN CHAT INPUT --- */
export interface ClaudeChatInputProps {
  onSendMessage: (data: ChatSubmission) => void;
  onIngestFile?: (file: File) => Promise<boolean>;
  onRemoveFile?: (file: File) => Promise<void> | void;
  models?: Model[];
  defaultModel?: string;
  placeholder?: string;
  disabled?: boolean;
}

const DEFAULT_MODELS: Model[] = [
  { id: "opus-4.5", name: "Opus 4.5", description: "Most capable for complex work" },
  { id: "sonnet-4.5", name: "Sonnet 4.5", description: "Best for everyday tasks" },
  { id: "haiku-4.5", name: "Haiku 4.5", description: "Fastest for quick answers" },
];

export const ClaudeChatInput: React.FC<ClaudeChatInputProps> = ({
  onSendMessage,
  onIngestFile,
  onRemoveFile,
  models = DEFAULT_MODELS,
  defaultModel,
  placeholder = "How can I help you today?",
  disabled = false,
}) => {
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [pastedContent, setPastedContent] = useState<PastedSnippet[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedModel, setSelectedModel] = useState(
    () =>
      (typeof window !== "undefined" ? localStorage.getItem("docmind-model") : null) ||
      defaultModel ||
      models[0]?.id ||
      ""
  );
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleModelSelect = (id: string) => {
    setSelectedModel(id);
    localStorage.setItem("docmind-model", id);
  };

  useEffect(() => {
    if (models.length === 0) return;
    const saved = localStorage.getItem("docmind-model");
    if (saved && models.some((m) => m.id === saved)) {
      setSelectedModel(saved);
    } else if (models[0] && !models.some((m) => m.id === selectedModel)) {
      setSelectedModel(models[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 384) + "px";
    }
  }, [message]);

  const handleFiles = useCallback(
    (newFilesList: FileList | File[]) => {
      const newFiles: AttachedFile[] = Array.from(newFilesList).map((file) => {
        const isImage =
          file.type.startsWith("image/") ||
          /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
        return {
          id: randomId(),
          file,
          type: isImage ? "image/unknown" : file.type || "application/octet-stream",
          preview: isImage ? URL.createObjectURL(file) : null,
          uploadStatus: "uploading" as const,
        };
      });

      setFiles((prev) => [...prev, ...newFiles]);

      if (onIngestFile) {
        newFiles.forEach((af) => {
          onIngestFile(af.file).then((ok) => {
            setFiles((prev) =>
              prev.map((p) =>
                p.id === af.id
                  ? { ...p, uploadStatus: ok ? "complete" : "error" }
                  : p
              )
            );
          });
        });
      } else {
        // No ingest callback — mark complete immediately (dev/demo mode).
        setFiles((prev) =>
          prev.map((p) =>
            newFiles.some((nf) => nf.id === p.id)
              ? { ...p, uploadStatus: "complete" }
              : p
          )
        );
      }
    },
    [onIngestFile]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === "file") {
        const file = items[i].getAsFile();
        if (file) pastedFiles.push(file);
      }
    }

    if (pastedFiles.length > 0) {
      e.preventDefault();
      handleFiles(pastedFiles);
      return;
    }

    const text = e.clipboardData.getData("text");
    if (text.length > 300) {
      e.preventDefault();
      setPastedContent((prev) => [
        ...prev,
        { id: randomId(), content: text, timestamp: new Date() },
      ]);
    }
  };

  const anyUploading = files.some(
    (f) => f.uploadStatus === "uploading" || f.uploadStatus === "pending"
  );
  const hasContent =
    message.trim().length > 0 || files.length > 0 || pastedContent.length > 0;

  const handleSend = () => {
    if (!hasContent || disabled || anyUploading) return;
    onSendMessage({
      message,
      files,
      pastedContent,
      model: selectedModel,
      isThinkingEnabled,
    });
    setMessage("");
    setFiles([]);
    setPastedContent([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !anyUploading) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="relative w-full max-w-2xl mx-auto transition-all duration-300 font-sans"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="box-content flex flex-col mx-2 md:mx-0 items-stretch transition-all duration-200 relative z-10 rounded-2xl cursor-text border border-bg-300 shadow-input hover:shadow-input-hover focus-within:shadow-input-hover bg-bg-100 antialiased">
        <div className="flex flex-col px-3 pt-3 pb-2 gap-2">
          {(files.length > 0 || pastedContent.length > 0) && (
            <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2 px-1">
              {pastedContent.map((content) => (
                <PastedContentCard
                  key={content.id}
                  content={content}
                  onRemove={(id) =>
                    setPastedContent((prev) => prev.filter((c) => c.id !== id))
                  }
                />
              ))}
              {files.map((file) => (
                <FilePreviewCard
                  key={file.id}
                  file={file}
                  onRemove={(id) => {
                    const target = files.find((f) => f.id === id);
                    setFiles((prev) => prev.filter((f) => f.id !== id));
                    if (target && onRemoveFile) onRemoveFile(target.file);
                  }}
                />
              ))}
            </div>
          )}

          <div className="relative mb-1">
            <div className="max-h-96 w-full overflow-y-auto custom-scrollbar font-sans break-words min-h-[2.5rem] pl-1">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                className="w-full bg-transparent border-0 outline-none text-text-100 text-[16px] placeholder:text-text-400 resize-none overflow-hidden py-0 leading-relaxed block font-normal antialiased"
                rows={1}
                style={{ minHeight: "1.5em" }}
              />
            </div>
          </div>

          <div className="flex gap-2 w-full items-center">
            <div className="relative flex-1 flex items-center shrink min-w-0 gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center relative shrink-0 transition-colors duration-200 h-8 w-8 rounded-lg active:scale-95 text-text-400 hover:text-text-200 hover:bg-bg-200"
                type="button"
                aria-label="Attach files"
              >
                <Icons.Plus className="w-5 h-5" />
              </button>

              <div className="relative group/thinking">
                <button
                  onClick={() => setIsThinkingEnabled(!isThinkingEnabled)}
                  className={`transition-all duration-200 h-8 w-8 flex items-center justify-center rounded-lg active:scale-95 ${
                    isThinkingEnabled
                      ? "text-accent bg-accent/10"
                      : "text-text-400 hover:text-text-200 hover:bg-bg-200"
                  }`}
                  aria-pressed={isThinkingEnabled}
                  aria-label={isThinkingEnabled ? "Disable thinking" : "Enable thinking"}
                  type="button"
                >
                  <Icons.Thinking className="w-5 h-5" />
                </button>
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md bg-bg-300 text-text-100 text-xs whitespace-nowrap opacity-0 group-hover/thinking:opacity-100 transition-opacity duration-150">
                  {isThinkingEnabled ? "Disable thinking" : "Enable thinking"}
                </div>
              </div>
            </div>

            <div className="flex flex-row items-center min-w-0 gap-1">
              <div className="shrink-0 p-1 -m-1">
                <ModelSelector
                  models={models}
                  selectedModel={selectedModel}
                  onSelect={handleModelSelect}
                />
              </div>

              <button
                onClick={handleSend}
                disabled={!hasContent || disabled || anyUploading}
                className={`inline-flex items-center justify-center relative shrink-0 transition-colors h-8 w-8 rounded-xl active:scale-95 ${
                  hasContent && !disabled && !anyUploading
                    ? "bg-accent text-on-primary hover:bg-accent-hover shadow-md"
                    : "bg-accent/30 text-on-primary/60 cursor-default"
                }`}
                type="button"
                aria-label={anyUploading ? "Ingesting files…" : "Send message"}
              >
                {anyUploading ? (
                  <Icons.Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Icons.ArrowUp className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isDragging && (
        <div className="absolute inset-0 bg-bg-200/90 border-2 border-dashed border-accent rounded-2xl z-50 flex flex-col items-center justify-center backdrop-blur-sm pointer-events-none">
          <Icons.Archive className="w-10 h-10 text-accent mb-2 animate-pulse" />
          <p className="text-accent font-medium">Drop files to upload</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.pptx,.xlsx,.csv,.json,.txt,.md,.html,.htm,.png,.jpg,.jpeg"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
};

export default ClaudeChatInput;
