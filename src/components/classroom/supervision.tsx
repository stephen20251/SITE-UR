// Liste des cours du cursus et de leur progression (Responsable, secrétariat).
import { useState } from "react";
import { CourseStatusBadge, Bar, Empty, Loading, inputCls } from "@/components/classroom/cursus-ui";
import { LEVELS, useSupervision } from "@/lib/cursus";
import { cursusPlace } from "@/lib/cursus";

export function SupervisionTable() {
  const [mentionId, setMention] = useState("");
  const [level, setLevel] = useState("");
  const [status, setStatus] = useState("");
  const q = useSupervision({ mentionId: mentionId || undefined, level: level || undefined });
  const courses = (q.data?.courses ?? []).filter((c) => !status || c.progress.status === status);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select className={inputCls} value={mentionId} onChange={(e) => setMention(e.target.value)}>
          <option value="">Toutes les mentions</option>
          {(q.data?.mentions ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select className={inputCls} value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">Tous les niveaux</option>
          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="PRESENT">En cours</option>
          <option value="UPCOMING">À venir</option>
          <option value="COMPLETED">Complétés</option>
        </select>
      </div>
      {q.isLoading ? <Loading /> : courses.length === 0 ? <Empty>Aucun cours.</Empty> : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-elegant">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Cours</th>
                <th className="px-4 py-3">Enseignant</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Volume horaire</th>
                <th className="px-4 py-3">Syllabus</th>
                <th className="px-4 py-3">Étudiants</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => {
                const pct = c.progress.plannedHours ? Math.round((c.progress.hoursDone / c.progress.plannedHours) * 100) : 0;
                return (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{c.title}</div>
                      <div className="text-xs text-muted-foreground">{cursusPlace(c.cursusLevel, c.cursusMonth)}{c.status !== "PUBLISHED" && " · non publié"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{c.teacher ? `${c.teacher.firstName} ${c.teacher.lastName}` : "—"}</td>
                    <td className="px-4 py-3"><CourseStatusBadge status={c.progress.status} /></td>
                    <td className="w-44 px-4 py-3">
                      <div className="text-xs">{c.progress.hoursDone} / {c.progress.plannedHours} h <span className="text-muted-foreground">· reste {c.progress.hoursRemaining} h</span></div>
                      <Bar value={pct} className="mt-1" />
                    </td>
                    <td className="w-40 px-4 py-3">
                      <div className="text-xs">{c.progress.syllabusDone}/{c.progress.syllabusTotal} points</div>
                      <Bar value={c.progress.syllabusPct} className="mt-1" />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {c.students} inscrit{c.students > 1 ? "s" : ""}<br />
                      <span className="text-muted-foreground">{c.studentsCompleted} à 100 % · moy. {c.avgStudentProgress} %</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
