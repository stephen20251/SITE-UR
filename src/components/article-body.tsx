// Corps d'une actualité : le texte saisi par l'administration (texte brut) est mis en
// forme sans rien réécrire. Les lignes en MAJUSCULES deviennent des titres, les suites
// de lignes courtes des listes à puces, le reste des paragraphes justifiés.
import { Fragment } from "react";
import { UI, serif } from "@/components/site-layout";

type Node =
  | { kind: "h"; level: 2 | 3; text: string }
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: { marker?: string; text: string }[] };

const EMOJI = /^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*/u;

// Titre : ligne courte écrite en majuscules (avec ou sans emoji devant),
// ou ligne courte commençant par un emoji et finissant par « ? ».
function isHeading(line: string) {
  if (line.length > 70) return false;
  const letters = line.replace(/[^\p{L}]/gu, "");
  if (letters.length >= 3 && letters === letters.toLocaleUpperCase("fr")) return true;
  return EMOJI.test(line) && line.endsWith("?") && line.length <= 60;
}

// Élément de liste : ligne courte sans ponctuation finale de phrase.
const isShortItem = (line: string) => line.length <= 80 && !/[.!?:;…]$/.test(line);
// Élément introduit par un emoji : « 🗣️ La conversation : … »
const emojiItem = (line: string) => {
  const m = line.match(EMOJI);
  return m && / : /.test(line) ? { marker: m[1], text: line.slice(m[0].length) } : null;
};

export function parseArticle(body: string): Node[] {
  const blocks = body.replace(/\r\n?/g, "\n").split(/\n\s*\n/)
    .map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((b) => b.length);
  const nodes: Node[] = [];
  const pushItem = (item: { marker?: string; text: string }) => {
    const last = nodes[nodes.length - 1];
    if (last?.kind === "ul" && !!last.items[0]?.marker === !!item.marker) last.items.push(item);
    else nodes.push({ kind: "ul", items: [item] });
  };
  const heading = (text: string) => nodes.push({ kind: "h", level: nodes.length === 0 ? 2 : 3, text });

  for (let i = 0; i < blocks.length; i++) {
    let lines = blocks[i];
    if (lines.length > 1 && isHeading(lines[0])) { heading(lines[0]); lines = lines.slice(1); }
    if (lines.length === 1) {
      const line = lines[0];
      if (isHeading(line)) { heading(line); continue; }
      const em = emojiItem(line);
      // Une suite d'au moins deux éléments « emoji : texte » forme une liste
      const nextEm = blocks[i + 1]?.length === 1 && emojiItem(blocks[i + 1][0]);
      const prev = nodes[nodes.length - 1];
      if (em && (nextEm || (prev?.kind === "ul" && prev.items[0]?.marker))) { pushItem(em); continue; }
      // Lignes courtes isolées (ex. parcours d'une formation) : liste si elles se suivent ou suivent un titre
      const nextShort = blocks[i + 1]?.length === 1 && isShortItem(blocks[i + 1][0]) && !isHeading(blocks[i + 1][0]);
      if (isShortItem(line) && !EMOJI.test(line) && (nextShort || prev?.kind === "h" || (prev?.kind === "ul" && !prev.items[0]?.marker))) {
        pushItem({ text: line });
        continue;
      }
      nodes.push({ kind: "p", lines });
      continue;
    }
    // Bloc de plusieurs lignes courtes : liste
    if (lines.length > 1 && lines.every((l) => l.length <= 90 && !EMOJI.test(l))) {
      nodes.push({ kind: "ul", items: lines.map((text) => ({ text })) });
      continue;
    }
    nodes.push({ kind: "p", lines });
  }
  return nodes;
}

// Paragraphes justifiés sur ordinateur, alignés à gauche sur mobile.
export const PROSE_P = `text-left text-base leading-[1.7] sm:text-justify sm:text-[1.0625rem] [hyphens:auto] ${UI.text} dark:text-slate-300`;

export function ArticleBody({ body }: { body: string }) {
  const nodes = parseArticle(body);
  return (
    <div lang="fr" className="space-y-5">
      {nodes.map((n, i) => {
        const prev = nodes[i - 1];
        if (n.kind === "h") {
          return n.level === 2
            ? <h2 key={i} className={`${prev ? "!mt-12" : ""} text-2xl font-semibold leading-snug sm:text-3xl ${UI.title}`} style={serif}>{n.text}</h2>
            : <h3 key={i} className={`${prev ? "!mt-10" : ""} border-l-2 border-[#e3262b] pl-3 text-lg font-semibold leading-snug tracking-wide sm:text-xl ${UI.title}`} style={serif}>{n.text}</h3>;
        }
        if (n.kind === "ul") {
          return (
            <ul key={i} className={`${prev?.kind === "h" ? "!mt-4" : prev?.kind === "ul" ? "!mt-8" : ""} space-y-2.5 pl-1`}>
              {n.items.map((it, j) => (
                <li key={j} className={`flex items-start gap-3 text-base leading-[1.7] sm:text-[1.0625rem] ${UI.text} dark:text-slate-300`}>
                  {it.marker
                    ? <span aria-hidden className="w-6 shrink-0 text-center leading-[1.7]">{it.marker}</span>
                    : <span aria-hidden className="mt-[0.72em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#e3262b] ring-4 ring-[#e3262b]/15 dark:bg-[#f87171] dark:ring-[#f87171]/15" />}
                  <span className="min-w-0 flex-1"><ItemText text={it.text} /></span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className={PROSE_P}>
            {n.lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{l}</Fragment>)}
          </p>
        );
      })}
    </div>
  );
}

// « La conversation : entraîne-toi… » → terme en gras, puis l'explication.
function ItemText({ text }: { text: string }) {
  const k = text.indexOf(" : ");
  if (k <= 0 || k > 40) return <>{text}</>;
  return <><strong className={`font-semibold ${UI.title}`}>{text.slice(0, k)}</strong>{text.slice(k)}</>;
}
