/**
 * ModuleTree — Professional Studio module/lesson editor.
 * Drag-and-drop reorder + modal dialogs for creation + in-dialog file upload.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical, ChevronDown, ChevronRight, Film, FileText, Volume2, Image, Archive,
  BookOpen, File as FileIcon, Folder, Pencil, Trash2, Plus, Copy, Eye, EyeOff,
  Check, X, Loader2, Upload, AlertCircle, CheckCircle2, Lock, Clock, AlertTriangle, Link2,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateModule, useUpdateModule, useDeleteModule,
  useCreateLesson, useUpdateLesson, useDeleteLesson,
  type CourseModule, type CourseLesson,
} from "@/lib/online";
import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type TreeProps = {
  courseId: string;
  modules: CourseModule[];
  onSelectLesson?: (lesson: CourseLesson, moduleId: string) => void;
  selectedLessonId?: string;
};

type LessonType = "VIDEO" | "PDF" | "TEXT" | "AUDIO" | "IMAGE" | "ZIP" | "DOCUMENT" | "FILE" | "CODE" | "LINK";

// ─── Lesson type config ───────────────────────────────────────────────────────

type TypeDef = {
  icon: React.ElementType;
  label: string;
  accept: string | null;
  color: string;
  bg: string;
  hint: string;
};

const TYPES: Record<LessonType, TypeDef> = {
  VIDEO:    { icon: Film,      label: "Vidéo",    accept: "video/*",              color: "text-blue-500",   bg: "bg-blue-500/10",   hint: "MP4, WebM, MOV" },
  PDF:      { icon: FileText,  label: "PDF",      accept: "application/pdf,.pdf", color: "text-red-500",    bg: "bg-red-500/10",    hint: "Fichier PDF" },
  TEXT:     { icon: BookOpen,  label: "Texte",    accept: null,                   color: "text-green-600",  bg: "bg-green-500/10",  hint: "Contenu rédigé" },
  AUDIO:    { icon: Volume2,   label: "Audio",    accept: "audio/*",              color: "text-purple-500", bg: "bg-purple-500/10", hint: "MP3, WAV, OGG" },
  IMAGE:    { icon: Image,     label: "Image",    accept: "image/*",              color: "text-amber-500",  bg: "bg-amber-500/10",  hint: "JPG, PNG, WebP" },
  ZIP:      { icon: Archive,   label: "Archive",  accept: ".zip,.rar,.7z",        color: "text-orange-500", bg: "bg-orange-500/10", hint: "ZIP, RAR, 7z" },
  DOCUMENT: { icon: FileText,  label: "Document", accept: ".doc,.docx,.ppt,.pptx,.xls,.xlsx", color: "text-indigo-500", bg: "bg-indigo-500/10", hint: "Word, PPT, Excel" },
  FILE:     { icon: FileIcon,  label: "Fichier",  accept: "*/*",                  color: "text-slate-500",  bg: "bg-slate-500/10",  hint: "Tout type de fichier" },
  CODE:     { icon: BookOpen,  label: "Code",     accept: null,                   color: "text-emerald-500", bg: "bg-emerald-500/10", hint: "Bac à sable HTML/CSS/JS" },
  LINK:     { icon: Link2,     label: "Lien URL", accept: null,                   color: "text-sky-600",    bg: "bg-sky-500/10",    hint: "YouTube, Vimeo, Google Drive, site web…" },
};

const TYPE_ORDER: LessonType[] = ["VIDEO", "LINK", "PDF", "TEXT", "CODE", "AUDIO", "IMAGE", "ZIP", "DOCUMENT", "FILE"];

// ─── Shared styles ────────────────────────────────────────────────────────────

const inp = "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

// ─── Inline file uploader (XHR with progress) ────────────────────────────────

type UploadStatus = "idle" | "uploading" | "done" | "error";

function useInlineUpload(lessonId: string | null, courseId: string) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const upload = useCallback((file: File) => {
    if (!lessonId) return;
    setStatus("uploading");
    setProgress(0);
    setErrorMsg("");

    const fd = new FormData();
    fd.append("file", file);
    const tok = localStorage.getItem("us.accessToken");
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setStatus("done");
        setProgress(100);
        qc.invalidateQueries({ queryKey: ["online", "course", courseId] });
      } else {
        setStatus("error");
        setErrorMsg(`Erreur ${xhr.status}`);
      }
    };
    xhr.onerror = () => { setStatus("error"); setErrorMsg("Erreur réseau"); };
    xhr.open("POST", `http://localhost:4000/api/online/lessons/${lessonId}/upload`);
    if (tok) xhr.setRequestHeader("Authorization", `Bearer ${tok}`);
    xhr.send(fd);
  }, [lessonId, courseId, qc]);

  const reset = useCallback(() => {
    xhrRef.current?.abort();
    setStatus("idle");
    setProgress(0);
    setErrorMsg("");
  }, []);

  return { status, progress, errorMsg, upload, reset };
}

// ─── New Module Dialog ────────────────────────────────────────────────────────

function NewModuleDialog({
  courseId,
  onClose,
}: {
  courseId: string;
  onClose: () => void;
}) {
  const createModule = useCreateModule(courseId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  // Focus sur le nom du module à l'ouverture uniquement (pas à chaque frappe)
  useEffect(() => { titleRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await createModule.mutateAsync({
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      toast.success("Module créé");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création du module");
    }
  }

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-online/30 bg-card shadow-lg">
      {/* Header */}
      <div className="flex items-center gap-2 border-b bg-online/5 px-4 py-3">
        <Folder className="h-4 w-4 text-online" />
        <span className="text-sm font-semibold">Nouveau module</span>
        <button onClick={onClose} className="ml-auto rounded-lg p-1 hover:bg-accent">
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-4">
        {/* Title */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Nom du module <span className="text-destructive">*</span>
          </label>
          <input
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            className={inp}
            placeholder="ex: Introduction au cours"
            autoFocus
            maxLength={160}
            required
          />
          <div className="mt-1 text-right text-[10px] text-muted-foreground">{title.length}/160</div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Description <span className="text-muted-foreground/60 font-normal">(optionnelle)</span>
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            className={`${inp} h-auto resize-none py-2.5`}
            placeholder="Décrivez brièvement le contenu de ce module…"
            rows={3}
            maxLength={500}
          />
          <div className="mt-1 text-right text-[10px] text-muted-foreground">{description.length}/500</div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={!title.trim() || createModule.isPending}
            className="flex items-center gap-2 rounded-lg grad-online px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {createModule.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Check className="h-4 w-4" />}
            Créer le module
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-accent"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── New Lesson Dialog ────────────────────────────────────────────────────────

function NewLessonDialog({
  moduleId,
  courseId,
  onClose,
  onCreated,
}: {
  moduleId: string;
  courseId: string;
  onClose: () => void;
  onCreated: (lesson: CourseLesson) => void;
}) {
  const createLesson = useCreateLesson(moduleId, courseId);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<LessonType>("VIDEO");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [createdLessonId, setCreatedLessonId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { status: uploadStatus, progress, errorMsg, upload, reset: resetUpload } =
    useInlineUpload(createdLessonId, courseId);

  const typeDef = TYPES[type];
  const needsFile = type !== "TEXT" && typeDef.accept !== null;

  function handleFileSelect(files: FileList | null) {
    if (!files?.length) return;
    setFile(files[0]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      // 1 — create the lesson record
      const lesson = await createLesson.mutateAsync({
        title: title.trim(),
        type,
        ...((type === "TEXT" || type === "CODE") && body.trim() ? { body: body.trim() } : {}),
        ...(type === "LINK" ? { contentUrl: url.trim() } : {}),
      });

      const created = lesson as CourseLesson;
      onCreated(created);

      // 2 — upload file if provided
      if (file && needsFile) {
        setCreatedLessonId(created.id);
        upload(file);
        // Dialog stays open during upload; closes when done
      } else {
        toast.success("Leçon créée");
        onClose();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création de la leçon");
    }
  }

  // Close after successful upload
  if (uploadStatus === "done") {
    toast.success("Leçon créée avec le fichier");
    onClose();
    return null;
  }

  const isUploading = uploadStatus === "uploading";
  const isCreating = createLesson.isPending;
  const isBusy = isCreating || isUploading;

  return (
    <div className="mt-0 overflow-hidden rounded-b-xl border border-t-0 bg-card shadow-md">
      {/* Header */}
      <div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-3">
        <Plus className="h-4 w-4 text-online" />
        <span className="text-sm font-semibold">Ajouter une leçon</span>
        {!isBusy && (
          <button onClick={onClose} className="ml-auto rounded-lg p-1 hover:bg-accent">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-4">
        {/* Title */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Titre <span className="text-destructive">*</span>
          </label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className={inp}
            placeholder="ex: Introduction aux concepts de base"
            autoFocus
            maxLength={200}
            required
            disabled={isBusy}
          />
        </div>

        {/* Type selector */}
        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground">Type de contenu</label>
          <div className="grid grid-cols-4 gap-1.5">
            {TYPE_ORDER.map((t) => {
              const cfg = TYPES[t];
              const Icon = cfg.icon;
              const active = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={isBusy}
                  onClick={() => { setType(t); setFile(null); resetUpload(); }}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition disabled:opacity-50 ${
                    active
                      ? `${cfg.bg} border-current ${cfg.color} ring-2 ring-current ring-offset-1`
                      : "hover:bg-muted/40 border-border"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? cfg.color : "text-muted-foreground"}`} />
                  <span className={`text-[10px] font-medium leading-none ${active ? cfg.color : "text-muted-foreground"}`}>
                    {cfg.label}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">{typeDef.hint}</p>
        </div>

        {/* File drop zone — only for non-TEXT types */}
        {needsFile && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Fichier
              {file && <span className="ml-1 font-normal text-muted-foreground/60">(optionnel — peut être ajouté plus tard)</span>}
            </label>

            {/* Upload progress overlay */}
            {isUploading ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-online/30 bg-online/5 p-6">
                <Loader2 className="h-7 w-7 animate-spin text-online" />
                <div className="w-full">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-online transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="mt-1 text-center text-xs text-muted-foreground">{progress}% — envoi en cours…</div>
                </div>
              </div>
            ) : uploadStatus === "error" ? (
              <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
                <span className="flex-1 text-sm text-destructive">{errorMsg}</span>
                <button type="button" onClick={resetUpload} className="text-xs text-online hover:underline">
                  Réessayer
                </button>
              </div>
            ) : file ? (
              /* Selected file preview */
              <div className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${typeDef.bg}`}>
                  {typeDef.icon && <typeDef.icon className={`h-5 w-5 ${typeDef.color}`} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{file.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} Mo
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setFile(null); resetUpload(); fileInputRef.current && (fileInputRef.current.value = ""); }}
                  className="shrink-0 rounded-lg p-1.5 hover:bg-accent"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ) : (
              /* Drop zone */
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragging(false);
                  handleFileSelect(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border-2 border-dashed p-6 transition ${
                  dragging
                    ? "border-online bg-online/5"
                    : "border-border hover:border-online/40 hover:bg-muted/20"
                }`}
              >
                <Upload className="h-7 w-7 text-muted-foreground/50" />
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">
                    Glissez un fichier ici, ou <span className="font-medium text-online">cliquez pour parcourir</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground/60">{typeDef.hint} — peut aussi être ajouté plus tard</div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={typeDef.accept ?? undefined}
                  className="hidden"
                  onChange={e => handleFileSelect(e.target.files)}
                />
              </div>
            )}
          </div>
        )}

        {/* Lien URL (YouTube, Vimeo, site web…) */}
        {type === "LINK" && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Lien <span className="text-destructive">*</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              className={inp}
              placeholder="https://www.youtube.com/watch?v=…"
              disabled={isBusy}
              required
            />
            <p className="mt-1 text-[11px] text-muted-foreground">Les vidéos YouTube et Vimeo sont lues directement dans la leçon ; les autres liens s'ouvrent dans un nouvel onglet.</p>
          </div>
        )}

        {/* Body editor for TEXT */}
        {(type === "TEXT" || type === "CODE") && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Contenu textuel <span className="text-destructive">*</span>
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              className={`${inp} h-auto resize-y py-2.5`}
              placeholder="Rédigez le contenu de cette leçon…"
              rows={5}
              disabled={isBusy}
              required
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 border-t pt-4">
          <button
            type="submit"
            disabled={!title.trim() || ((type === "TEXT" || type === "CODE") && !body.trim()) || (type === "LINK" && !/^https?:\/\/\S+/.test(url.trim())) || isBusy}
            className="flex items-center gap-2 rounded-lg grad-online px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isCreating
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Création…</>
              : isUploading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Upload…</>
              : <><Check className="h-4 w-4" /> Créer la leçon</>}
          </button>
          {!isBusy && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-accent"
            >
              Annuler
            </button>
          )}
          {file && !isUploading && (
            <span className="ml-auto text-[11px] text-muted-foreground">
              Le fichier sera envoyé après la création
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

// ─── Root ModuleTree ──────────────────────────────────────────────────────────

export function ModuleTree({ courseId, modules, onSelectLesson, selectedLessonId }: TreeProps) {
  const [showNewModule, setShowNewModule] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const toggleCollapse = (id: string) =>
    setCollapsed(p => ({ ...p, [id]: !p[id] }));

  async function handleTopDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIdx = modules.findIndex(m => m.id === active.id);
    const newIdx = modules.findIndex(m => m.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(modules, oldIdx, newIdx);
    await api(`/online/courses/${courseId}/modules/reorder`, {
      method: "PATCH",
      body: reordered.map((m, i) => ({ id: m.id, order: i })),
    }).catch(() => toast.error("Réorganisation échouée"));
  }

  return (
    <div className="space-y-2">

      {/* ── New Module button ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowNewModule(p => !p)}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
            showNewModule
              ? "bg-online/10 text-online border border-online/30"
              : "grad-online text-white shadow-sm hover:opacity-90"
          }`}
        >
          <Plus className="h-4 w-4" />
          Nouveau module
        </button>
        {modules.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {modules.length} module{modules.length > 1 ? "s" : ""} ·{" "}
            {modules.reduce((s, m) => s + m.lessons.length, 0)} leçon{modules.reduce((s, m) => s + m.lessons.length, 0) > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── New module dialog ── */}
      {showNewModule && (
        <NewModuleDialog
          courseId={courseId}
          onClose={() => setShowNewModule(false)}
        />
      )}

      {/* ── Empty state ── */}
      {modules.length === 0 && !showNewModule && (
        <div className="rounded-2xl border-2 border-dashed p-10 text-center">
          <Folder className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">Ce cours n'a pas encore de modules</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Cliquez sur «&nbsp;Nouveau module&nbsp;» pour commencer.
          </p>
        </div>
      )}

      {/* ── Sorted module list ── */}
      {modules.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
          onDragEnd={handleTopDragEnd}
        >
          <SortableContext items={modules.map(m => m.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {modules.map((m, idx) => (
                <SortableModule
                  key={m.id}
                  module={m}
                  allModules={modules}
                  index={idx + 1}
                  courseId={courseId}
                  collapsed={!!collapsed[m.id]}
                  onToggle={() => toggleCollapse(m.id)}
                  onSelectLesson={onSelectLesson}
                  selectedLessonId={selectedLessonId}
                  onLessonDragEnd={async (e) => {
                    const { active, over } = e;
                    if (!over || active.id === over.id) return;
                    const oldIdx = m.lessons.findIndex(l => l.id === active.id);
                    const newIdx = m.lessons.findIndex(l => l.id === over.id);
                    if (oldIdx < 0 || newIdx < 0) return;
                    const reordered = arrayMove(m.lessons, oldIdx, newIdx);
                    await api(`/online/modules/${m.id}/lessons/reorder`, {
                      method: "PATCH",
                      body: reordered.map((l, i) => ({ id: l.id, order: i })),
                    }).catch(() => toast.error("Réorganisation échouée"));
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

// ─── Sortable module row ──────────────────────────────────────────────────────

function SortableModule({
  module: m, allModules, index, courseId, collapsed, onToggle,
  onSelectLesson, selectedLessonId, onLessonDragEnd,
}: {
  module: CourseModule;
  allModules: CourseModule[];
  index: number;
  courseId: string;
  collapsed: boolean;
  onToggle: () => void;
  onSelectLesson?: (l: CourseLesson, mid: string) => void;
  selectedLessonId?: string;
  onLessonDragEnd: (e: DragEndEvent) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: m.id });

  const updateModule = useUpdateModule(courseId);
  const deleteModule = useDeleteModule(courseId);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(m.title);
  const [showAddLesson, setShowAddLesson] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  async function saveTitle() {
    if (!editTitle.trim()) return;
    try {
      await updateModule.mutateAsync({ moduleId: m.id, data: { title: editTitle.trim() } });
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de mise à jour");
    }
  }

  async function duplicate() {
    toast.info("Duplication…");
    try {
      const newMod = await api<any>(`/online/courses/${courseId}/modules`, {
        method: "POST",
        body: { title: `${m.title} (copie)` },
      });
      for (const l of m.lessons) {
        await api(`/online/modules/${newMod.id}/lessons`, {
          method: "POST",
          body: { title: l.title, type: l.type, ...(l.contentUrl ? { contentUrl: l.contentUrl } : {}), ...(l.body ? { body: l.body } : {}) },
        });
      }
      toast.success("Module dupliqué");
    } catch {
      toast.error("Erreur lors de la duplication");
    }
  }

  const doneLessons = m.lessons.filter(l => (l as any).completed).length;
  const totalLessons = m.lessons.length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`overflow-hidden rounded-xl border bg-card transition ${isDragging ? "shadow-lg" : ""}`}
    >
      {/* ── Module header ── */}
      <div className="flex items-center gap-1.5 bg-muted/30 px-3 py-2.5">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
          title="Réordonner"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Collapse */}
        <button onClick={onToggle} className="shrink-0 text-muted-foreground hover:text-foreground">
          {collapsed
            ? <ChevronRight className="h-4 w-4" />
            : <ChevronDown className="h-4 w-4" />}
        </button>

        {/* Index badge */}
        <span className="shrink-0 rounded-md bg-online/10 px-1.5 py-0.5 text-[10px] font-bold text-online">
          Module {index}
        </span>

        {/* Title (inline edit) */}
        {editing ? (
          <div className="flex flex-1 items-center gap-1">
            <input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              autoFocus
              className="flex-1 rounded-md border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
              onKeyDown={e => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") { setEditTitle(m.title); setEditing(false); }
              }}
            />
            <button onClick={saveTitle} disabled={updateModule.isPending}
              className="rounded p-0.5 hover:bg-accent disabled:opacity-50">
              <Check className="h-3.5 w-3.5 text-online" />
            </button>
            <button onClick={() => { setEditTitle(m.title); setEditing(false); }}
              className="rounded p-0.5 hover:bg-accent">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate text-sm font-medium">{m.title}</span>
            {totalLessons > 0 && (
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {totalLessons} leçon{totalLessons > 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        {!editing && (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              onClick={() => setEditing(true)}
              title="Renommer"
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={() => setShowSettings(v => !v)}
              title="Déblocage (drip / prérequis)"
              className={`rounded p-1 hover:bg-accent ${(m.dripDays || m.prerequisiteModuleId) ? "text-online" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Lock className="h-3 w-3" />
            </button>
            <button
              onClick={duplicate}
              title="Dupliquer"
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Copy className="h-3 w-3" />
            </button>
            <button
              onClick={() => {
                if (confirm(`Supprimer le module "${m.title}" et toutes ses leçons ?`)) {
                  deleteModule.mutateAsync(m.id).catch(() => toast.error("Erreur"));
                }
              }}
              title="Supprimer"
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* ── Description if present ── */}
      {!collapsed && (m as any).description && (
        <div className="border-b bg-muted/10 px-4 py-2 text-xs text-muted-foreground italic">
          {(m as any).description}
        </div>
      )}

      {/* ── Drip / prerequisite settings ── */}
      {showSettings && (
        <ModuleGatingSettings
          m={m}
          allModules={allModules}
          onSave={(data) => updateModule.mutateAsync({ moduleId: m.id, data })
            .then(() => toast.success("Déblocage mis à jour"))
            .catch((e) => toast.error(e instanceof Error ? e.message : "Erreur"))}
          saving={updateModule.isPending}
        />
      )}

      {/* ── Lesson list ── */}
      {!collapsed && (
        <div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onLessonDragEnd}
          >
            <SortableContext items={m.lessons.map(l => l.id)} strategy={verticalListSortingStrategy}>
              {m.lessons.length === 0 ? (
                <div className="px-10 py-3 text-xs text-muted-foreground/60 italic">
                  Aucune leçon — ajoutez-en une ci-dessous.
                </div>
              ) : (
                m.lessons.map(l => (
                  <SortableLesson
                    key={l.id}
                    lesson={l}
                    courseId={courseId}
                    selected={l.id === selectedLessonId}
                    onClick={() => onSelectLesson?.(l, m.id)}
                  />
                ))
              )}
            </SortableContext>
          </DndContext>

          {/* ── Add lesson button / dialog ── */}
          {showAddLesson ? (
            <NewLessonDialog
              moduleId={m.id}
              courseId={courseId}
              onClose={() => setShowAddLesson(false)}
              onCreated={() => setShowAddLesson(false)}
            />
          ) : (
            <button
              onClick={() => setShowAddLesson(true)}
              className="flex w-full items-center gap-2 border-t px-4 py-2.5 text-xs font-medium text-online hover:bg-online/5 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter une leçon
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sortable lesson row ──────────────────────────────────────────────────────

function SortableLesson({
  lesson: l, courseId, selected, onClick,
}: {
  lesson: CourseLesson;
  courseId: string;
  selected: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: l.id });
  const deleteLesson = useDeleteLesson(l.id, courseId);

  const cfg = TYPES[l.type as LessonType] ?? TYPES.FILE;
  const Icon = cfg.icon;
  // TEXT lessons carry their content in `body`; others need a URL or a file.
  const hasContent = l.type === "TEXT" || l.type === "CODE"
    ? !!(l.body && l.body.trim())
    : !!(l.contentUrl || (l.files && l.files.length > 0));

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex cursor-pointer items-center gap-2 border-t px-3 py-2.5 text-xs transition
        ${selected ? "bg-online/10" : "hover:bg-muted/20"}
        ${isDragging ? "shadow-md" : ""}`}
      onClick={onClick}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab touch-none text-muted-foreground/30 hover:text-muted-foreground active:cursor-grabbing"
        onClick={e => e.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* Type icon */}
      <Icon className={`h-3.5 w-3.5 shrink-0 ${selected ? "text-online" : cfg.color}`} />

      {/* Title */}
      <span className={`min-w-0 flex-1 truncate font-medium ${selected ? "text-online" : ""}`}>
        {l.title}
      </span>

      {/* Content indicator */}
      {hasContent ? (
        <CheckCircle2 className="h-3 w-3 shrink-0 text-success" aria-label="Contenu présent" />
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600" title="Cette leçon n'a aucun contenu — ajoutez une vidéo, un fichier ou du texte, sinon les étudiants verront une leçon vide.">
          <AlertTriangle className="h-3 w-3" /> Vide
        </span>
      )}

      {/* Type badge */}
      <span className={`hidden shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold group-hover:inline-block ${cfg.bg} ${cfg.color}`}>
        {cfg.label}
      </span>

      {/* Delete */}
      <button
        onClick={e => {
          e.stopPropagation();
          if (confirm(`Supprimer la leçon "${l.title}" ?`)) {
            deleteLesson.mutateAsync(undefined).catch(() => toast.error("Erreur"));
          }
        }}
        className="hidden shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive group-hover:block"
        title="Supprimer"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── Module drip / prerequisite settings ──────────────────────────────────────

function ModuleGatingSettings({
  m, allModules, onSave, saving,
}: {
  m: CourseModule;
  allModules: CourseModule[];
  onSave: (data: { dripDays: number | null; prerequisiteModuleId: string | null }) => Promise<unknown>;
  saving: boolean;
}) {
  const [dripDays, setDripDays] = useState<string>(m.dripDays != null ? String(m.dripDays) : "");
  const [prereq, setPrereq] = useState<string>(m.prerequisiteModuleId ?? "");
  const others = allModules.filter((x) => x.id !== m.id);

  return (
    <div className="space-y-3 border-b bg-online/5 px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-online">
        <Lock className="h-3.5 w-3.5" /> Déblocage du module
      </div>

      {/* Drip */}
      <label className="block">
        <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Clock className="h-3 w-3" /> Disponible après l'inscription
        </span>
        <div className="flex items-center gap-2">
          <input
            type="number" min={0} max={365}
            value={dripDays}
            onChange={(e) => setDripDays(e.target.value)}
            placeholder="0"
            className="w-24 rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">jour(s) — vide = immédiat</span>
        </div>
      </label>

      {/* Prerequisite */}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Prérequis (module à terminer d'abord)</span>
        <select
          value={prereq}
          onChange={(e) => setPrereq(e.target.value)}
          className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">— Aucun —</option>
          {others.map((o) => (
            <option key={o.id} value={o.id}>{o.title}</option>
          ))}
        </select>
      </label>

      <button
        onClick={() => onSave({
          dripDays: dripDays.trim() === "" ? null : Math.max(0, Math.floor(Number(dripDays))),
          prerequisiteModuleId: prereq || null,
        })}
        disabled={saving}
        className="inline-flex items-center gap-1.5 rounded-lg grad-online px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        Enregistrer
      </button>
    </div>
  );
}
