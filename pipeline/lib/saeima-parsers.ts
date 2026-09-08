// Parsers for titania.saeima.lv pages, which embed their data as JS calls.
export type SaeimaDeputyRef = { sname: string; name: string; shortStr: string; lst: string; unid: string };

export type SaeimaRecord = {
  kind: "mandate" | "faction" | "committee" | "subcommittee" | "delegation" | "other";
  type: string;
  str: string;
  position: string;
  from: string | null;
  to: string | null;
};

const KINDS: Record<string, SaeimaRecord["kind"]> = {
  "10": "mandate",
  "2": "faction",
  "3": "committee",
  "5": "subcommittee",
  "6": "delegation",
};

function objectLiteral(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(\w+):"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out[m[1]] = m[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  return out;
}

/** dd.mm.yyyy -> yyyy-mm-dd, empty -> null */
export function isoDate(s: string | undefined): string | null {
  const m = (s ?? "").match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** deputies?OpenView pages: drawDep({sname,name,shortStr,lst,unid}) */
export function parseDeputiesView(html: string): SaeimaDeputyRef[] {
  const out: SaeimaDeputyRef[] = [];
  const re = /drawDep\(\{([^}]*)\}\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const o = objectLiteral(m[1]);
    if (o.unid && o.sname) out.push({ sname: o.sname, name: o.name ?? "", shortStr: o.shortStr ?? "", lst: o.lst ?? "", unid: o.unid });
  }
  return out;
}

/** Deputy pages: drawWN({str,strLvlTp,position,dtF,dtT,...}) */
export function parseDeputyPage(html: string): SaeimaRecord[] {
  const out: SaeimaRecord[] = [];
  const re = /drawWN\(\{([^}]*)\}\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const o = objectLiteral(m[1]);
    if (!o.str) continue;
    out.push({
      kind: KINDS[o.strLvlTp ?? ""] ?? "other",
      type: o.strLvlTp ?? "",
      str: o.str,
      position: o.position ?? "",
      from: isoDate(o.dtF),
      to: isoDate(o.dtT),
    });
  }
  return out;
}
