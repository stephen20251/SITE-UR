/**
 * UploadManager — XHR-based file upload with progress, speed, preview, cancel
 */
import { useRef, useState, useCallback } from "react";
import { Upload, X, Loader2, Check, AlertCircle, File, Film, FileText, Volume2, Code, Archive, Image } from "lucide-react";

export type UploadedFile = {
  url: string;
  name: string;
  mimeType: string;
  size: number;
};

type UploadState = {
  id: string;
  file: File;
  progress: number;         // 0–100
  speed: string;            // "1.2 MB/s"
  status: "pending" | "uploading" | "done" | "error" | "cancelled";
  url?: string;
  error?: string;
  xhr?: XMLHttpRequest;
  previewUrl?: string;
};

const MIME_ICON: Record<string, React.ElementType> = {};
function fileIcon(mime: string): React.ElementType {
  if (mime.startsWith("image/")) return Image;
  if (mime.startsWith("video/")) return Film;
  if (mime.startsWith("audio/")) return Volume2;
  if (mime === "application/pdf") return FileText;
  if (mime.includes("zip") || mime.includes("rar")) return Archive;
  if (mime.includes("text/") || mime.includes("javascript") || mime.includes("typescript")) return Code;
  return File;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function useUploadManager(endpoint: string) {
  const [uploads, setUploads] = useState<UploadState[]>([]);

  const update = useCallback((id: string, patch: Partial<UploadState>) => {
    setUploads(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
  }, []);

  const uploadFile = useCallback((file: File, onDone?: (f: UploadedFile) => void) => {
    const id = crypto.randomUUID();
    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;

    setUploads(prev => [...prev, {
      id, file, progress: 0, speed: "", status: "pending", previewUrl,
    }]);

    const xhr = new XMLHttpRequest();
    let startTime = Date.now();
    let loaded0 = 0;

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const now = Date.now();
      const dt = (now - startTime) / 1000;
      const dl = e.loaded - loaded0;
      const speed = dt > 0 ? formatSize(dl / dt) + "/s" : "";
      startTime = now; loaded0 = e.loaded;
      update(id, { progress: Math.round((e.loaded / e.total) * 100), speed, status: "uploading" });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          update(id, { status: "done", progress: 100, url: data.url });
          onDone?.({ url: data.url, name: file.name, mimeType: file.type, size: file.size });
        } catch {
          update(id, { status: "error", error: "Réponse invalide" });
        }
      } else {
        update(id, { status: "error", error: `Erreur ${xhr.status}` });
      }
    };

    xhr.onerror = () => update(id, { status: "error", error: "Erreur réseau" });

    const fd = new FormData();
    fd.append("file", file);
    const tok = localStorage.getItem("us.accessToken");
    xhr.open("POST", `http://localhost:4000/api${endpoint}`);
    if (tok) xhr.setRequestHeader("Authorization", `Bearer ${tok}`);
    update(id, { xhr, status: "uploading" });
    xhr.send(fd);

    return id;
  }, [endpoint, update]);

  const cancel = useCallback((id: string) => {
    setUploads(prev => prev.map(u => {
      if (u.id === id) { u.xhr?.abort(); return { ...u, status: "cancelled" }; }
      return u;
    }));
  }, []);

  const remove = useCallback((id: string) => {
    setUploads(prev => {
      const u = prev.find(x => x.id === id);
      if (u?.previewUrl) URL.revokeObjectURL(u.previewUrl);
      return prev.filter(x => x.id !== id);
    });
  }, []);

  const clear = useCallback(() => setUploads([]), []);

  return { uploads, uploadFile, cancel, remove, clear };
}

export function UploadManagerUI({
  uploads,
  onCancel,
  onRemove,
}: {
  uploads: ReturnType<typeof useUploadManager>["uploads"];
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (uploads.length === 0) return null;
  return (
    <div className="space-y-2">
      {uploads.map(u => {
        const Icon = fileIcon(u.file.type);
        const isActive = u.status === "uploading" || u.status === "pending";
        return (
          <div key={u.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
            {/* Preview or icon */}
            {u.previewUrl ? (
              <img src={u.previewUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="truncate text-xs font-medium">{u.file.name}</span>
                <span className="ml-2 shrink-0 text-xs text-muted-foreground">{formatSize(u.file.size)}</span>
              </div>

              {isActive && (
                <div className="mt-1 space-y-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-online transition-all" style={{ width: `${u.progress}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{u.progress}%</span>
                    {u.speed && <span>{u.speed}</span>}
                  </div>
                </div>
              )}

              {u.status === "done" && (
                <span className="text-xs text-green-600">✓ Terminé</span>
              )}
              {u.status === "error" && (
                <span className="text-xs text-destructive">{u.error}</span>
              )}
              {u.status === "cancelled" && (
                <span className="text-xs text-muted-foreground">Annulé</span>
              )}
            </div>

            <div className="shrink-0">
              {isActive ? (
                <button onClick={() => onCancel(u.id)} className="rounded p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <button onClick={() => onRemove(u.id)} className="rounded p-1 hover:bg-accent text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DropZone({
  onFiles,
  accept,
  label = "Glissez des fichiers ici ou cliquez pour parcourir",
  multiple = true,
  uploading = false,
}: {
  onFiles: (files: File[]) => void;
  accept?: string;
  label?: string;
  multiple?: boolean;
  uploading?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault();
        setDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(multiple ? files : [files[0]]);
      }}
      onClick={() => ref.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition
        ${dragging ? "border-online bg-online/5" : "border-border hover:border-online/50 hover:bg-muted/20"}`}
    >
      {uploading
        ? <Loader2 className="h-8 w-8 animate-spin text-online" />
        : <Upload className="h-8 w-8 text-muted-foreground/50" />}
      <span className="text-sm text-muted-foreground text-center">{label}</span>
      <input ref={ref} type="file" accept={accept} multiple={multiple} className="hidden"
        onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) onFiles(files); e.target.value = ""; }} />
    </div>
  );
}
