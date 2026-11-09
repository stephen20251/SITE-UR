/**
 * MediaLibrary — Browse and reuse uploaded media files
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Film, FileText, Volume2, Image, Archive, Code, File, Check } from "lucide-react";
import { api } from "@/lib/api";
import { API_ORIGIN } from "@/lib/env";

type MediaFile = {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  mimeType: string;
  createdAt: string;
};

type Filter = "ALL" | "IMAGE" | "VIDEO" | "PDF" | "AUDIO" | "OTHER";

const TYPE_TABS: { id: Filter; label: string; icon: React.ElementType }[] = [
  { id: "ALL",   label: "Tout",    icon: File },
  { id: "IMAGE", label: "Images",  icon: Image },
  { id: "VIDEO", label: "Vidéos",  icon: Film },
  { id: "PDF",   label: "PDF",     icon: FileText },
  { id: "AUDIO", label: "Audio",   icon: Volume2 },
  { id: "OTHER", label: "Autres",  icon: Archive },
];

function mimeToFilter(mime: string): Filter {
  if (mime?.startsWith("image/")) return "IMAGE";
  if (mime?.startsWith("video/")) return "VIDEO";
  if (mime === "application/pdf") return "PDF";
  if (mime?.startsWith("audio/")) return "AUDIO";
  return "OTHER";
}

function formatSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

const API_BASE = API_ORIGIN;

export function MediaLibraryModal({
  onSelect,
  onClose,
  filter: initialFilter = "ALL",
}: {
  onSelect: (file: MediaFile) => void;
  onClose: () => void;
  filter?: Filter;
}) {
  const [activeFilter, setActiveFilter] = useState<Filter>(initialFilter);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MediaFile | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["lms-media", activeFilter, search],
    queryFn: () => api<MediaFile[]>(`/lms-admin/media?type=${activeFilter !== "ALL" ? activeFilter : ""}&q=${encodeURIComponent(search)}`),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[80vh] w-full max-w-3xl flex-col rounded-2xl bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-sm font-semibold">Bibliothèque de médias</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>

        {/* Tabs + Search */}
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <div className="flex gap-1 overflow-x-auto">
            {TYPE_TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveFilter(id)}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap transition
                  ${activeFilter === id ? "bg-online/10 text-online font-medium" : "text-muted-foreground hover:bg-accent"}`}>
                <Icon className="h-3 w-3" /> {label}
              </button>
            ))}
          </div>
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="h-8 rounded-lg border bg-background pl-8 pr-3 text-xs outline-none focus:ring-1 focus:ring-ring w-48"
              placeholder="Rechercher…" />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="grid place-items-center py-16 text-sm text-muted-foreground">Chargement…</div>
          ) : data.length === 0 ? (
            <div className="grid place-items-center py-16 text-sm text-muted-foreground">Aucun fichier trouvé.</div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {data.map(file => {
                const f = mimeToFilter(file.mimeType);
                const isSelected = selected?.id === file.id;
                return (
                  <button key={file.id} onClick={() => setSelected(isSelected ? null : file)}
                    className={`group relative flex flex-col overflow-hidden rounded-xl border transition
                      ${isSelected ? "border-online ring-2 ring-online" : "hover:border-online/50"}`}>
                    {/* Preview */}
                    <div className="aspect-video w-full bg-muted grid place-items-center overflow-hidden">
                      {f === "IMAGE" ? (
                        <img src={`${API_BASE}${file.url}`} alt={file.name} className="h-full w-full object-cover" />
                      ) : f === "VIDEO" ? (
                        <Film className="h-8 w-8 text-muted-foreground/40" />
                      ) : f === "PDF" ? (
                        <FileText className="h-8 w-8 text-red-400/60" />
                      ) : f === "AUDIO" ? (
                        <Volume2 className="h-8 w-8 text-purple-400/60" />
                      ) : (
                        <Archive className="h-8 w-8 text-muted-foreground/40" />
                      )}
                    </div>
                    {/* Info */}
                    <div className="p-1.5 text-left">
                      <div className="truncate text-[10px] font-medium">{file.name}</div>
                      <div className="text-[9px] text-muted-foreground">{formatSize(file.size)}</div>
                    </div>
                    {isSelected && (
                      <div className="absolute right-1 top-1 rounded-full bg-online p-0.5">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t p-4">
          <span className="text-xs text-muted-foreground">
            {selected ? `Sélectionné : ${selected.name}` : `${data.length} fichier(s)`}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">Annuler</button>
            <button onClick={() => { if (selected) { onSelect(selected); onClose(); } }}
              disabled={!selected}
              className="rounded-lg grad-online px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              Insérer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
