/**
 * UserPicker — modal to start a new LMS conversation.
 * Shows a role-filtered contact list with instant search.
 */
import { useState, useMemo } from "react";
import { Search, X, Loader2, UserCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { initials } from "@/components/online/shared";

export type LmsContact = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  systemRole: string;
  roleLabel: string;
};

function useLmsContacts(q: string, enabled = true) {
  return useQuery<LmsContact[]>({
    queryKey: ["chat", "lms-contacts", q],
    queryFn: () => api(`/chat/lms-contacts?q=${encodeURIComponent(q)}`),
    enabled,
    staleTime: 30_000,
  });
}

const ROLE_ORDER: Record<string, number> = {
  SUPER_ADMIN: 0,
  TEACHER_ONLINE: 1,
  STUDENT_ONLINE: 2,
};

const ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN:    "bg-purple-500/10 text-purple-700",
  TEACHER_ONLINE: "bg-blue-500/10 text-blue-700",
  STUDENT_ONLINE: "bg-green-500/10 text-green-700",
};

export function UserPicker({
  onSelect,
  onClose,
  onlineSet,
}: {
  onSelect: (contact: LmsContact) => void;
  onClose: () => void;
  onlineSet: Set<string>;
}) {
  const [q, setQ] = useState("");
  const { data = [], isLoading } = useLmsContacts(q);

  const grouped = useMemo(() => {
    const sorted = [...data].sort(
      (a, b) => (ROLE_ORDER[a.systemRole] ?? 9) - (ROLE_ORDER[b.systemRole] ?? 9) ||
                a.lastName.localeCompare(b.lastName),
    );
    const map = new Map<string, LmsContact[]>();
    for (const c of sorted) {
      const key = c.roleLabel;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [data]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Nouvelle conversation</h2>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-accent text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="border-b p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Rechercher un utilisateur…"
              className="h-9 w-full rounded-lg border bg-muted/40 pl-9 pr-3 text-sm outline-none focus:bg-background focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="grid h-32 place-items-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : data.length === 0 ? (
            <div className="grid h-32 place-items-center">
              <p className="text-sm text-muted-foreground">
                {q ? "Aucun résultat" : "Aucun contact disponible"}
              </p>
            </div>
          ) : (
            [...grouped.entries()].map(([group, contacts]) => (
              <div key={group}>
                <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-4 py-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group}
                  </span>
                </div>
                {contacts.map(c => {
                  const online = onlineSet.has(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => onSelect(c)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors"
                    >
                      <div className="relative shrink-0">
                        {c.avatarUrl ? (
                          <img src={c.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <div className="grid h-10 w-10 place-items-center rounded-full grad-online text-sm font-semibold text-white">
                            {initials(c.firstName, c.lastName)}
                          </div>
                        )}
                        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${online ? "bg-success" : "bg-muted-foreground/30"}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{c.firstName} {c.lastName}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ROLE_COLOR[c.systemRole] ?? "bg-muted text-muted-foreground"}`}>
                            {c.roleLabel}
                          </span>
                          <span className={`text-[10px] ${online ? "text-success" : "text-muted-foreground"}`}>
                            {online ? "● En ligne" : "Hors ligne"}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
