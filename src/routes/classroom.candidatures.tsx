import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Eye, FileText, Loader2, RotateCcw, Search, UserPlus, X } from "lucide-react";
import { useRequireClassroom } from "@/components/classroom/shared";
import { StudyModePicker, type StudyMode } from "@/components/classroom/study-mode";
import { Card, Empty, Loading, PageHeader, Tabs, btnGhost, btnPrimary, inputCls } from "@/components/classroom/cursus-ui";
import { REVIEW_BADGE } from "@/components/classroom/candidate-docs";
import {
  CANDIDATE_STATUS, candidateDocUrl, useCandidateAction, useCandidates, useDossierMeta, useEnrollCandidate, useGroupOptions,
  usePromotionOptions, useReturnInscription, useReviewDoc, type Candidate, type CandidateDocument,
} from "@/lib/candidatures";
import { ApiError } from "@/lib/api";

export const Route = createFileRoute("/classroom/candidatures")({ component: Candidatures });

type Tab = "TODO" | "INSCRIPTION" | "TO_VALIDATE" | "ENROLLED" | "REJECTED" | "DRAFT";
const TAB_FILTER: Record<Tab, (c: Candidate) => boolean> = {
  TODO: (c) => c.status === "SUBMITTED" || c.status === "UNDER_REVIEW",
  INSCRIPTION: (c) => c.status === "ACCEPTED" && !c.inscriptionSubmittedAt,
  TO_VALIDATE: (c) => c.status === "ACCEPTED" && !!c.inscriptionSubmittedAt,
  ENROLLED: (c) => c.status === "ENROLLED",
  REJECTED: (c) => c.status === "REJECTED",
  DRAFT: (c) => c.status === "DRAFT",
};

function Candidatures() {
  const { user, ready } = useRequireClassroom(["STAFF", "SUPER_ADMIN"]);
  const [tab, setTab] = useState<Tab>("TODO");
  const [search, setSearch] = useState("");
  const all = useCandidates({ search: search || undefined });
  const [openId, setOpenId] = useState<string | null>(null);

  if (!ready || !user) return <Loading />;
  if (all.isError) return <Empty>Accès réservé au secrétariat (admissions).</Empty>;

  const list = all.data?.candidates ?? [];
  const opened = list.find((c) => c.id === openId);
  if (opened) return <CandidateDossier c={opened} onBack={() => setOpenId(null)} />;

  const count = (t: Tab) => list.filter(TAB_FILTER[t]).length;
  const shown = list.filter(TAB_FILTER[tab]);

  return (
    <div className="space-y-6">
      <PageHeader title="Candidatures" subtitle="Analysez les dossiers pièce par pièce, acceptez ou refusez, puis validez les inscriptions." />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs<Tab> value={tab} onChange={setTab} items={[
          { v: "TODO", label: "À examiner", count: count("TODO") },
          { v: "INSCRIPTION", label: "Inscription en cours", count: count("INSCRIPTION") },
          { v: "TO_VALIDATE", label: "Inscription à valider", count: count("TO_VALIDATE") },
          { v: "ENROLLED", label: "Inscrits", count: count("ENROLLED") },
          { v: "REJECTED", label: "Refusés", count: count("REJECTED") },
          { v: "DRAFT", label: "Brouillons", count: count("DRAFT") },
        ]} />
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input className={`${inputCls} pl-8`} placeholder="Nom ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      {all.isLoading ? <Loading /> : shown.length === 0 ? <Empty>Aucune candidature dans cette catégorie.</Empty> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map((c) => {
            const st = CANDIDATE_STATUS[c.status];
            const toFix = c.documents.filter((d) => d.reviewStatus === "REJECTED").length;
            const pending = c.documents.filter((d) => d.reviewStatus === "PENDING").length;
            return (
              <Card key={c.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold">{c.user.lastName} {c.user.firstName}</div>
                    <div className="text-xs text-muted-foreground">{c.user.email}{c.user.phone ? ` · ${c.user.phone}` : ""}</div>
                    <div className="mt-1 text-xs">{c.mention?.name ?? "Mention non choisie"} · niveau {c.level ?? "—"}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.label}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-full bg-muted px-2 py-0.5">{c.documents.length} pièce(s)</span>
                  {pending > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">{pending} à vérifier</span>}
                  {toFix > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">{toFix} à corriger</span>}
                  {c.inscriptionSubmittedAt && c.status === "ACCEPTED" && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">Dossier d'inscription reçu</span>}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{c.submittedAt ? `Soumis le ${new Date(c.submittedAt).toLocaleDateString("fr-FR")}` : `Créé le ${new Date(c.createdAt).toLocaleDateString("fr-FR")}`}</span>
                  <button onClick={() => setOpenId(c.id)} className={btnPrimary}><Eye className="h-4 w-4" /> Ouvrir le dossier</button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Dossier détaillé ─────────────────────────────────────────────────────────
const FORM_LABELS: [string, string][] = [
  ["lastName", "Nom"], ["firstNames", "Prénoms"], ["nationality", "Nationalité"], ["sex", "Sexe"],
  ["address", "Adresse"], ["birthDate", "Date de naissance"], ["birthPlace", "Lieu de naissance"],
  ["maritalStatus", "Statut matrimonial"], ["baccYear", "Année du BACC"], ["baccSerie", "Série"], ["baccMention", "Mention BACC"],
  ["parcours", "Parcours"], ["motherTongue", "Langue maternelle"], ["otherLanguages", "Autres langues"],
  ["currentJob", "Emploi actuel"], ["jobSince", "Depuis"], ["employer", "Employeur"], ["employerAddress", "Adresse employeur"],
  ["supervisor", "Supérieur"], ["howKnown", "Connaissance de l'UR"],
];

function CandidateDossier({ c, onBack }: { c: Candidate; onBack: () => void }) {
  const meta = useDossierMeta();
  const action = useCandidateAction();
  const returnIns = useReturnInscription();
  const [selected, setSelected] = useState<CandidateDocument | null>(c.documents[0] ?? null);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    if (selected) setSelected(c.documents.find((d) => d.id === selected.id) ?? null);
  }, [c.documents]);

  async function act(a: "review" | "accept" | "reject") {
    let reason: string | undefined;
    if (a === "reject") {
      const r = prompt("Motif du refus (communiqué au candidat) :");
      if (r === null) return;
      reason = r || undefined;
    }
    try {
      await action.mutateAsync({ id: c.id, action: a, reason });
      toast.success(a === "review" ? "Dossier en examen" : a === "accept" ? "Candidature acceptée : le candidat peut compléter son inscription" : "Candidature refusée");
    } catch (err) { toast.error(err instanceof ApiError ? err.message : "Échec"); }
  }
  async function sendBack() {
    const r = prompt("Que doit corriger le candidat dans son dossier d'inscription ?");
    if (r === null) return;
    try { await returnIns.mutateAsync({ id: c.id, reason: r }); toast.success("Dossier renvoyé au candidat"); }
    catch (err) { toast.error(err instanceof ApiError ? err.message : "Échec"); }
  }

  const label = (d: CandidateDocument) => meta.data?.docTypes[d.type]?.label ?? d.name;
  const form = c.inscriptionForm ?? {};
  const st = CANDIDATE_STATUS[c.status];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack} className={btnGhost}><ArrowLeft className="h-4 w-4" /> Retour</button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{c.user.lastName} {c.user.firstName}</h1>
          <p className="text-xs text-muted-foreground">{c.user.email}{c.user.phone ? ` · ${c.user.phone}` : ""} · {c.mention?.name ?? "—"} · niveau {c.level ?? "—"}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${st.cls}`}>{st.label}</span>
      </div>

      {/* Actions selon l'étape */}
      <Card className="flex flex-wrap items-center gap-2">
        {c.status === "SUBMITTED" && <button disabled={action.isPending} onClick={() => act("review")} className={btnGhost}><Eye className="h-3.5 w-3.5" /> Commencer l'examen</button>}
        {(c.status === "SUBMITTED" || c.status === "UNDER_REVIEW") && (<>
          <button disabled={action.isPending} onClick={() => act("accept")} className={btnPrimary}><Check className="h-4 w-4" /> Accepter la candidature</button>
          <button disabled={action.isPending} onClick={() => act("reject")} className={btnGhost}><X className="h-3.5 w-3.5" /> Refuser</button>
        </>)}
        {c.status === "ACCEPTED" && !c.inscriptionSubmittedAt && (
          <p className="text-sm text-muted-foreground">Candidature acceptée — en attente du dossier d'inscription du candidat.</p>
        )}
        {c.status === "ACCEPTED" && c.inscriptionSubmittedAt && (<>
          <button onClick={() => setEnrolling(true)} className={btnPrimary}><UserPlus className="h-4 w-4" /> Valider l'inscription</button>
          <button onClick={sendBack} disabled={returnIns.isPending} className={btnGhost}><RotateCcw className="h-3.5 w-3.5" /> Renvoyer pour correction</button>
        </>)}
        {c.status === "ENROLLED" && <p className="text-sm text-emerald-700">Inscription validée : le candidat est étudiant de l'UR.</p>}
        {c.status === "REJECTED" && <p className="text-sm text-red-700">Refusée : {c.rejectionReason ?? "aucun motif"}</p>}
        {c.status === "DRAFT" && <p className="text-sm text-muted-foreground">Le candidat n'a pas encore soumis sa pré-inscription.</p>}
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Pièces */}
        <div className="space-y-2 lg:col-span-2">
          {(["PRE_INSCRIPTION", "INSCRIPTION"] as const).map((stage) => {
            const docs = c.documents.filter((d) => d.stage === stage);
            return (
              <Card key={stage} className="p-0">
                <div className="border-b px-4 py-2 text-sm font-semibold">{stage === "PRE_INSCRIPTION" ? "Pièces de pré-inscription" : "Pièces d'inscription"}</div>
                {docs.length === 0 ? <p className="px-4 py-3 text-xs text-muted-foreground">Aucune pièce.</p> : docs.map((d) => {
                  const b = REVIEW_BADGE[d.reviewStatus];
                  return (
                    <button key={d.id} onClick={() => setSelected(d)}
                      className={`flex w-full items-center gap-2 border-b px-4 py-2.5 text-left last:border-0 hover:bg-muted/40 ${selected?.id === d.id ? "bg-classroom/5" : ""}`}>
                      <FileText className="h-4 w-4 shrink-0 text-classroom" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{label(d)}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{d.name}</span>
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${b.cls}`}>{b.label}</span>
                    </button>
                  );
                })}
              </Card>
            );
          })}
        </div>

        {/* Aperçu */}
        <div className="lg:col-span-3">
          {selected ? <DocViewer candidateId={c.id} doc={selected} label={label(selected)} /> : <Empty>Sélectionnez une pièce pour l'analyser.</Empty>}
        </div>
      </div>

      {/* Questionnaire + fiche */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="font-semibold">Questionnaire de motivation</h3>
          <dl className="mt-3 space-y-3 text-sm">
            {(meta.data?.questions ?? []).map((qq) => (
              <div key={qq.key}>
                <dt className="text-xs text-muted-foreground">{qq.label}</dt>
                <dd className="whitespace-pre-wrap">{c.motivation?.[qq.key] || <span className="text-muted-foreground">—</span>}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card>
          <h3 className="font-semibold">Fiche d'inscription</h3>
          {!c.inscriptionForm ? <p className="mt-3 text-sm text-muted-foreground">Pas encore remplie.</p> : (
            <>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {FORM_LABELS.filter(([k]) => form[k]).map(([k, l]) => (
                  <div key={k}><dt className="text-xs text-muted-foreground">{l}</dt><dd>{String(form[k])}</dd></div>
                ))}
              </dl>
              {form.personalStatement && (
                <div className="mt-3"><p className="text-xs text-muted-foreground">Déclaration personnelle</p><p className="whitespace-pre-wrap text-sm">{String(form.personalStatement)}</p></div>
              )}
              <div className="mt-3 space-y-1 rounded-xl bg-muted/40 p-3 text-xs">
                <p>Référence du droit d'inscription : <b>{c.paymentReference ?? "—"}</b></p>
                <p>Vient d'une autre école : <b>{c.fromOtherSchool ? "Oui" : "Non"}</b></p>
                <p>Déclaration du candidat : <b>{form.declarationAccepted ? "acceptée" : "non acceptée"}</b></p>
              </div>
            </>
          )}
        </Card>
      </div>

      {enrolling && <EnrollDialog c={c} onClose={() => setEnrolling(false)} />}
    </div>
  );
}

// Aperçu d'une pièce (PDF / image) + vérification
function DocViewer({ candidateId, doc, label }: { candidateId: string; doc: CandidateDocument; label: string }) {
  const review = useReviewDoc();
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState(doc.reviewNote ?? "");

  useEffect(() => {
    let revoke: string | null = null;
    setUrl(null); setErr(""); setNote(doc.reviewNote ?? "");
    candidateDocUrl(doc.id).then((u) => { revoke = u; setUrl(u); }).catch((e) => setErr(e.message));
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [doc.id]);

  async function decide(status: "VERIFIED" | "REJECTED") {
    try {
      await review.mutateAsync({ candidateId, docId: doc.id, status, note: status === "REJECTED" ? note : undefined });
      toast.success(status === "VERIFIED" ? "Pièce vérifiée" : "Pièce refusée — le candidat est prévenu");
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "Erreur"); }
  }

  const isImage = doc.mimeType?.startsWith("image/");
  const isPdf = doc.mimeType === "application/pdf";
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex-1 font-semibold">{label}</h3>
        {url && <a href={url} download={doc.name} className={btnGhost}>Télécharger</a>}
      </div>
      <div className="grid min-h-[420px] place-items-center overflow-hidden rounded-xl border bg-muted/30">
        {err ? <p className="text-sm text-red-600">{err}</p> : !url ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> :
          isImage ? <img src={url} alt={label} className="max-h-[600px] max-w-full object-contain" /> :
          isPdf ? <iframe src={url} title={label} className="h-[600px] w-full" /> :
          <p className="p-6 text-center text-sm text-muted-foreground">Aperçu indisponible pour ce format (Word).<br />Utilisez « Télécharger » pour l'ouvrir.</p>}
      </div>
      <div className="space-y-2">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder="Commentaire pour le candidat (obligatoire en cas de refus) : document illisible, expiré, incomplet…"
          className="w-full resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-classroom/30" />
        <div className="flex gap-2">
          <button onClick={() => decide("VERIFIED")} disabled={review.isPending} className={btnPrimary}><Check className="h-4 w-4" /> Pièce conforme</button>
          <button onClick={() => decide("REJECTED")} disabled={review.isPending} className={btnGhost}><X className="h-3.5 w-3.5" /> Refuser la pièce</button>
        </div>
      </div>
    </Card>
  );
}

// Validation de l'inscription : promotion (+ groupe) → profil étudiant + matricule.
function EnrollDialog({ c, onClose }: { c: Candidate; onClose: () => void }) {
  const promos = usePromotionOptions(c.mention?.id);
  const enroll = useEnrollCandidate();
  const options = (promos.data ?? []).filter((p) => !c.level || p.level === c.level);
  const list = options.length ? options : promos.data ?? [];
  const [promotionId, setPromotionId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [studyMode, setStudyMode] = useState<StudyMode>("PRESENTIEL");
  const groups = useGroupOptions(promotionId || undefined);
  useEffect(() => { if (!promotionId && list[0]) setPromotionId(list[0].id); }, [list, promotionId]);

  async function submit() {
    try {
      const r = await enroll.mutateAsync({ id: c.id, promotionId, groupId: groupId || undefined, studyMode });
      toast.success(`${c.user.firstName} est désormais étudiant(e) de l'UR — matricule ${r.matricule}`);
      onClose();
    } catch (err) { toast.error(err instanceof ApiError ? err.message : "Inscription impossible"); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Valider l'inscription de {c.user.firstName} {c.user.lastName}</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground">{c.mention?.name ?? "—"} · niveau {c.level ?? "—"}. Un matricule sera généré et le compte deviendra un compte étudiant.</p>
        <label className="block text-xs text-muted-foreground">Promotion d'accueil
          <select className={`${inputCls} mt-1 w-full`} value={promotionId} onChange={(e) => { setPromotionId(e.target.value); setGroupId(""); }}>
            {list.length === 0 && <option value="">Aucune promotion disponible</option>}
            {list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="block text-xs text-muted-foreground">Groupe (optionnel)
          <select className={`${inputCls} mt-1 w-full`} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">Aucun</option>
            {(groups.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        <StudyModePicker value={studyMode} onChange={setStudyMode} />
        <button onClick={submit} disabled={!promotionId || enroll.isPending} className={`${btnPrimary} w-full justify-center`}>
          <UserPlus className="h-4 w-4" /> Confirmer : devient étudiant(e)
        </button>
      </div>
    </div>
  );
}
