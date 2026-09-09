import { useEffect, useMemo, useState } from "react";
import { MIN_ANSWERED, rank, type Answer } from "../lib/kompass.ts";

type Label = { lv: string; en: string };
type Statement = { id: string; statement: Label; topic: Label; stances: Record<string, { score: number; quote: string } | null> };
type ListInfo = { slug: string; no: number; name: string; href: string };
type Props = { locale: "lv" | "en"; statements: Statement[]; lists: ListInfo[]; labels: Record<string, string> };

type Stored = { answers: Record<string, -2 | 0 | 2>; weights: Record<string, 1 | 2>; step: number; done: boolean };
const KEY = "kompass.v1";

function load(ids: Set<string>): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) throw new Error("empty");
    const s = JSON.parse(raw) as Stored;
    const answers: Stored["answers"] = {};
    const weights: Stored["weights"] = {};
    for (const [k, v] of Object.entries(s.answers ?? {})) if (ids.has(k) && [-2, 0, 2].includes(v)) answers[k] = v;
    for (const [k, v] of Object.entries(s.weights ?? {})) if (ids.has(k) && (v === 1 || v === 2)) weights[k] = v;
    return { answers, weights, step: Math.min(s.step ?? 0, ids.size), done: Boolean(s.done) };
  } catch {
    return { answers: {}, weights: {}, step: 0, done: false };
  }
}

export default function Kompass({ locale, statements, lists, labels: L }: Props) {
  const ids = useMemo(() => new Set(statements.map((s) => s.id)), [statements]);
  const [state, setState] = useState<Stored>({ answers: {}, weights: {}, step: 0, done: false });
  const [started, setStarted] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const s = load(ids);
    setState(s);
    if (s.done || Object.keys(s.answers).length > 0) setStarted(true);
  }, [ids]);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* private mode */
    }
  }, [state]);

  const answered = Object.keys(state.answers).length;
  const answersFull = useMemo(() => {
    const out: Record<string, Answer> = {};
    for (const [id, value] of Object.entries(state.answers)) out[id] = { value, important: (state.weights[id] ?? 1) === 2 };
    return out;
  }, [state.answers, state.weights]);
  const results = useMemo(
    () => rank(answersFull, lists.map((l) => ({ slug: l.slug, no: l.no, stances: Object.fromEntries(statements.map((s) => [s.id, s.stances[l.slug]?.score ?? null])) }))),
    [answersFull, lists, statements],
  );
  const listOf = useMemo(() => new Map(lists.map((l) => [l.slug, l])), [lists]);
  const answerLabel = (v: -2 | 0 | 2 | undefined): string =>
    v === 2 ? L["kompass.agree"] : v === -2 ? L["kompass.disagree"] : v === 0 ? L["kompass.neutral"] : L["kompass.skip"];
  const stanceLabel = (v: number): string => (v >= 1 ? L["kompass.agree"] : v <= -1 ? L["kompass.disagree"] : L["kompass.neutral"]);

  const reset = () => {
    setState({ answers: {}, weights: {}, step: 0, done: false });
    setStarted(false);
    setOpen(null);
  };
  const answer = (id: string, value: -2 | 0 | 2 | null) => {
    setState((s) => {
      const answers = { ...s.answers };
      if (value === null) delete answers[id];
      else answers[id] = value;
      const step = s.step + 1;
      return { ...s, answers, step, done: step >= statements.length };
    });
  };

  if (!started) {
    return (
      <div className="card" style={{ maxWidth: "44rem" }}>
        <p>{L["kompass.intro"]}</p>
        <p className="notice soft" style={{ margin: 0 }}>{L["kompass.disclaimer"]}</p>
        <p style={{ margin: "0.75rem 0 0" }}>
          <button type="button" className="btn" onClick={() => setStarted(true)}>{L["kompass.start"]}</button>
        </p>
      </div>
    );
  }

  if (!state.done && state.step < statements.length) {
    const s = statements[state.step];
    const important = (state.weights[s.id] ?? 1) === 2;
    return (
      <div className="card" style={{ maxWidth: "44rem" }}>
        <p className="muted" style={{ margin: 0 }}>
          {state.step + 1} {L["kompass.progress"]} {statements.length} · {s.topic[locale]}
        </p>
        <h2 style={{ margin: "0.35rem 0 0.75rem" }}>{s.statement[locale]}</h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={() => answer(s.id, 2)}>{L["kompass.agree"]}</button>
          <button type="button" className="btn" onClick={() => answer(s.id, 0)}>{L["kompass.neutral"]}</button>
          <button type="button" className="btn" onClick={() => answer(s.id, -2)}>{L["kompass.disagree"]}</button>
          <button type="button" className="btn" style={{ color: "var(--muted)" }} onClick={() => answer(s.id, null)}>{L["kompass.skip"]}</button>
        </div>
        <label style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginTop: "0.75rem", fontSize: "0.92rem" }}>
          <input type="checkbox" checked={important} onChange={(e) => setState((st) => ({ ...st, weights: { ...st.weights, [s.id]: e.target.checked ? 2 : 1 } }))} />
          {L["kompass.important"]}
        </label>
        {state.step > 0 && (
          <p style={{ margin: "0.75rem 0 0" }}>
            <button type="button" className="btn" onClick={() => setState((st) => ({ ...st, step: st.step - 1 }))}>{L["kompass.back"]}</button>
          </p>
        )}
      </div>
    );
  }

  if (answered < MIN_ANSWERED) {
    return (
      <div className="card" style={{ maxWidth: "44rem" }}>
        <p>{L["kompass.min_answers"]}</p>
        <button type="button" className="btn" onClick={reset}>{L["kompass.restart"]}</button>
      </div>
    );
  }

  return (
    <div>
      <div className="results-bar">
        <h2 style={{ margin: 0 }}>{L["kompass.results"]}</h2>
        <button type="button" className="btn" onClick={reset}>{L["kompass.restart"]}</button>
      </div>
      <p className="notice soft">{L["kompass.disclaimer"]}</p>
      {results.map((r) => {
        const list = listOf.get(r.slug)!;
        const isOpen = open === r.slug;
        return (
          <article key={r.slug} className="card" style={{ marginTop: "0.75rem", opacity: r.unranked ? 0.65 : 1 }}>
            <div style={{ display: "flex", gap: "0.7rem", alignItems: "center", flexWrap: "wrap" }}>
              <span className="list-no">{list.no}</span>
              <h3 style={{ margin: 0, flex: 1 }}><a href={list.href}>{list.name}</a></h3>
              <strong style={{ fontSize: "1.4rem", fontVariantNumeric: "tabular-nums" }}>{r.score === null ? "-" : `${r.score}%`}</strong>
            </div>
            <div className="meter" style={{ marginTop: "0.4rem" }}>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                {r.unranked ? L["kompass.unranked"] : `${L["kompass.coverage"]} ${r.coveredAxes} ${L["kompass.of_answered"]} (${r.answeredAxes})`}
              </span>
              <span />
              <div className="track"><div className="fill" style={{ width: `${r.score ?? 0}%` }} /></div>
            </div>
            <p style={{ margin: "0.5rem 0 0" }}>
              <button type="button" className="btn" onClick={() => setOpen(isOpen ? null : r.slug)}>
                {L["kompass.details"]} {isOpen ? "▴" : "▾"}
              </button>
            </p>
            {isOpen && (
              <div className="table-wrap" style={{ marginTop: "0.6rem" }}>
                <table className="data compact">
                  <thead>
                    <tr>
                      <th>{locale === "lv" ? "Apgalvojums" : "Statement"}</th>
                      <th>{L["kompass.your_answer"]}</th>
                      <th>{L["kompass.list_position"]}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statements
                      .filter((s) => s.id in state.answers)
                      .map((s) => {
                        const stance = s.stances[r.slug];
                        return (
                          <tr key={s.id}>
                            <td>{s.statement[locale]}</td>
                            <td>{answerLabel(state.answers[s.id])}{(state.weights[s.id] ?? 1) === 2 ? " ★" : ""}</td>
                            <td>
                              {stance === null ? (
                                <span className="muted">{L["kompass.silent"]}</span>
                              ) : (
                                <>
                                  <strong>{stanceLabel(stance.score)}</strong>
                                  <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.2rem" }}>
                                    "{stance.quote}" <em>({L["kompass.quote_note"]})</em>
                                  </div>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
