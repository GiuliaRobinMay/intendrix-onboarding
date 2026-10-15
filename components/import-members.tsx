"use client";

// Import a client's people from the file they actually send.
//
// Nobody types thirty names in. The client sends a spreadsheet — Excel
// nearly always, sometimes a CSV, now and then a plain list — with its
// own column names in its own order. So this reads the file, guesses
// which column is which from the headings, lets a person correct the
// guess, shows exactly who would be added, and only then adds them.
//
// It never adds anyone twice: a row whose address or name is already on
// the client, or appears twice in the file, is shown and unticked. A
// row with no address is unticked too — without one nothing can be
// sent to that person, so it is a decision, not an oversight.

import { useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, TriangleAlert, Upload, X } from "lucide-react";
import { GradientButton, GhostButton } from "@/components/ui";
import { useData } from "@/lib/state";
import type { Client, MemberRole } from "@/lib/types";

type Field = "firstName" | "lastName" | "fullName" | "email" | "title";

const FIELDS: Array<{ key: Field; label: string; hint: string }> = [
  { key: "firstName", label: "First name", hint: "or pick a Full name column instead" },
  { key: "lastName", label: "Last name", hint: "" },
  { key: "fullName", label: "Full name", hint: "split into first and last if there is no separate column" },
  { key: "email", label: "Email", hint: "required — nothing can be sent without it" },
  { key: "title", label: "Title", hint: "optional — their job title" },
];

/** What a heading usually says when it means each field. */
const GUESS: Record<Field, RegExp> = {
  firstName: /^(first|given|voornaam|prenom|first[\s_-]*name|fname)\b/i,
  lastName: /^(last|surname|family|achternaam|nom|last[\s_-]*name|lname)\b/i,
  fullName: /^(full[\s_-]*name|name|naam|participant|person|employee)\b/i,
  email: /e[\s_-]*mail|^mail\b|address/i,
  title: /^(title|job|function|functie|position|role)\b/i,
};

type Mapping = Partial<Record<Field, number>>;

interface Candidate {
  row: number;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  title: string;
  /** why it starts unticked, when it does */
  flag: string | null;
}

/** A CSV or text file into rows. Picks the separator the first line
 *  uses most — comma, semicolon or tab — and honours quotes. */
function parseDelimited(text: string): string[][] {
  const first = text.split(/\r?\n/)[0] ?? "";
  const sep = [",", ";", "\t"].sort(
    (a, b) => first.split(b).length - first.split(a).length
  )[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim()));
}

async function readFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (/\.(xlsx|xlsm|xls)$/.test(name)) {
    // the parser is heavy and only needed here, so it loads on demand
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
    });
    return rows
      .map((r) => r.map((c) => String(c ?? "").trim()))
      .filter((r) => r.some(Boolean));
  }
  return parseDelimited(await file.text()).map((r) => r.map((c) => c.trim()));
}

/** Does the first row read like headings rather than a person? */
const looksLikeHeader = (row: string[]) =>
  row.some((c) => Object.values(GUESS).some((re) => re.test(c))) &&
  !row.some((c) => /@/.test(c));

function guessMapping(headers: string[]): Mapping {
  const m: Mapping = {};
  for (const key of ["email", "firstName", "lastName", "title", "fullName"] as Field[]) {
    const i = headers.findIndex(
      (h, idx) => GUESS[key].test(h) && !Object.values(m).includes(idx)
    );
    if (i >= 0) m[key] = i;
  }
  // a Name column next to a First name column is a last name, not a full one
  if (m.firstName !== undefined && m.fullName !== undefined && m.lastName === undefined) {
    m.lastName = m.fullName;
    delete m.fullName;
  }
  return m;
}

const splitName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  return parts.length < 2
    ? { first: full.trim(), last: "" }
    : { first: parts[0], last: parts.slice(1).join(" ") };
};

export function ImportMembers({ client, onClose }: { client: Client; onClose: () => void }) {
  const { dispatch } = useData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<Mapping>({});
  const [role, setRole] = useState<MemberRole>("participant");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const headers = useMemo(() => {
    if (!rows.length) return [];
    return hasHeader
      ? rows[0].map((h, i) => h || `Column ${i + 1}`)
      : rows[0].map((_, i) => `Column ${i + 1}`);
  }, [rows, hasHeader]);
  const body = useMemo(() => (hasHeader ? rows.slice(1) : rows), [rows, hasHeader]);

  const onFile = async (file: File) => {
    setError(null);
    setDone(null);
    try {
      const data = await readFile(file);
      if (!data.length) {
        setError("The file is empty.");
        return;
      }
      setFileName(file.name);
      setRows(data);
      const header = looksLikeHeader(data[0]);
      setHasHeader(header);
      setMapping(guessMapping(header ? data[0] : []));
    } catch {
      setError("Could not read that file — is it an Excel sheet, a CSV or a plain text list?");
    }
  };

  // who the mapping produces, flagged where adding them would be a mistake
  const candidates: Candidate[] = useMemo(() => {
    if (!body.length) return [];
    const cell = (r: string[], f: Field) =>
      mapping[f] === undefined ? "" : (r[mapping[f]!] ?? "").trim();
    const onClient = {
      emails: new Set(client.members.map((m) => m.email.trim().toLowerCase()).filter(Boolean)),
      names: new Set(client.members.map((m) => m.name.trim().toLowerCase())),
    };
    const seenEmail = new Set<string>();
    const seenName = new Set<string>();
    return body.map((r, row) => {
      let first = cell(r, "firstName");
      let last = cell(r, "lastName");
      if (!first && !last && mapping.fullName !== undefined) {
        const s = splitName(cell(r, "fullName"));
        first = s.first;
        last = s.last;
      }
      const name = [first, last].filter(Boolean).join(" ");
      const email = cell(r, "email").toLowerCase();
      const title = cell(r, "title");
      let flag: string | null = null;
      if (!name && !email) flag = "empty row";
      else if (!email) flag = "no email address";
      else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) flag = "not an email address";
      else if (onClient.emails.has(email)) flag = "already on this client";
      else if (name && onClient.names.has(name.toLowerCase())) flag = "same name already on this client";
      else if (seenEmail.has(email)) flag = "twice in the file";
      else if (name && seenName.has(name.toLowerCase())) flag = "same name twice in the file";
      if (email) seenEmail.add(email);
      if (name) seenName.add(name.toLowerCase());
      return { row, firstName: first, lastName: last, name, email, title, flag };
    });
  }, [body, mapping, client.members]);

  // every clean row starts ticked; a flagged one is a decision
  useEffect(() => {
    setPicked(new Set(candidates.filter((c) => !c.flag).map((c) => c.row)));
  }, [candidates]);

  const ready = candidates.filter((c) => picked.has(c.row) && c.flag !== "empty row");
  const flagged = candidates.filter((c) => c.flag && c.flag !== "empty row").length;

  const add = () => {
    for (const c of ready)
      dispatch({
        type: "addMember",
        clientId: client.id,
        name: c.name || c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        title: c.title,
        email: c.email,
        role,
      });
    setDone(ready.length);
  };

  const setField = (f: Field, idx: string) =>
    setMapping((m) => {
      const next = { ...m };
      if (idx === "") delete next[f];
      else next[f] = Number(idx);
      return next;
    });

  return (
    <div className="mb-4 rounded-lg border border-white/10 bg-white/3 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <FileSpreadsheet size={15} className="text-mist" />
            Import a list of people
          </h3>
          <p className="mt-1 text-[11px] text-mist">
            Excel, CSV or a plain text list. Say which column is which, check the
            names, add them.
          </p>
        </div>
        <button
          onClick={onClose}
          data-tip="Close"
          className="cursor-pointer rounded p-1 text-mist hover:text-paper"
        >
          <X size={14} />
        </button>
      </div>

      {done !== null ? (
        <p className="mt-4 text-xs font-semibold">
          Added {done} {done === 1 ? "person" : "people"} to {client.shortName}.{" "}
          <button onClick={onClose} className="cursor-pointer text-mist underline hover:text-paper">
            Close
          </button>
        </p>
      ) : (
        <>
          {/* step 1 — the file */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.xlsm,.csv,.txt,.tsv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
            <GhostButton onClick={() => fileRef.current?.click()}>
              <span className="flex items-center gap-1.5">
                <Upload size={13} /> {fileName ? "Choose another file" : "Choose a file"}
              </span>
            </GhostButton>
            {fileName && (
              <span className="text-xs text-mist">
                <span className="font-semibold text-paper">{fileName}</span> · {body.length} row
                {body.length === 1 ? "" : "s"}
              </span>
            )}
            {rows.length > 0 && (
              <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[11px] text-mist">
                <input
                  type="checkbox"
                  checked={hasHeader}
                  onChange={(e) => setHasHeader(e.target.checked)}
                />
                First row is headings
              </label>
            )}
          </div>
          {error && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#ff7a55]">
              <TriangleAlert size={12} /> {error}
            </p>
          )}

          {rows.length > 0 && (
            <>
              {/* step 2 — which column is which */}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {FIELDS.map((f) => (
                  <label key={f.key} className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-mist">
                      {f.label}
                      {f.key === "email" && <span className="text-[#ff7a55]"> *</span>}
                    </span>
                    <select
                      value={mapping[f.key] ?? ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                      className={`cursor-pointer rounded-md border bg-navy/60 px-2 py-1.5 text-xs font-semibold focus:outline-none ${
                        f.key === "email" && mapping.email === undefined
                          ? "border-[#eb320f]/70 focus:border-[#ff7a55]"
                          : "border-white/12 focus:border-white/40"
                      }`}
                    >
                      <option value="">— not in the file —</option>
                      {headers.map((h, i) => (
                        <option key={i} value={i}>
                          {h}
                        </option>
                      ))}
                    </select>
                    {f.hint && <span className="text-[10px] text-mist/70">{f.hint}</span>}
                  </label>
                ))}
              </div>

              {/* step 3 — who that gives */}
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                <span className="font-semibold">
                  {ready.length} to add
                  {flagged ? <span className="text-mist"> · {flagged} to look at</span> : null}
                </span>
                <label className="ml-auto flex items-center gap-2 text-[11px] text-mist">
                  Everyone as
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as MemberRole)}
                    className="cursor-pointer rounded-md border border-white/12 bg-navy/60 px-2 py-1 text-xs font-semibold text-paper focus:outline-none"
                  >
                    <option value="participant">Participant</option>
                    <option value="leader">Leader</option>
                    <option value="coach">Coach</option>
                  </select>
                </label>
              </div>

              <div className="mt-2 max-h-80 overflow-y-auto rounded-md border border-white/8">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-panel text-[11px] text-mist">
                    <tr>
                      <th className="w-8 px-2 py-2" />
                      <th className="px-2 py-2 font-semibold">Name</th>
                      <th className="px-2 py-2 font-semibold">Email</th>
                      <th className="px-2 py-2 font-semibold">Title</th>
                      <th className="px-2 py-2 font-semibold" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {candidates
                      .filter((c) => c.flag !== "empty row")
                      .map((c) => (
                        <tr key={c.row} className={picked.has(c.row) ? "" : "opacity-60"}>
                          <td className="px-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={picked.has(c.row)}
                              disabled={!c.email || c.flag === "not an email address"}
                              onChange={(e) =>
                                setPicked((s) => {
                                  const next = new Set(s);
                                  if (e.target.checked) next.add(c.row);
                                  else next.delete(c.row);
                                  return next;
                                })
                              }
                            />
                          </td>
                          <td className="px-2 py-1.5 font-semibold">{c.name || <span className="text-mist">—</span>}</td>
                          <td className="px-2 py-1.5 text-mist">{c.email || "—"}</td>
                          <td className="px-2 py-1.5 text-mist">{c.title || "—"}</td>
                          <td className="px-2 py-1.5 text-[11px] font-semibold text-[#ff7a55]">
                            {c.flag}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <GradientButton
                  onClick={add}
                  disabled={ready.length === 0 || mapping.email === undefined}
                  tip={
                    mapping.email === undefined
                      ? "Say which column holds the email address first"
                      : undefined
                  }
                >
                  Add {ready.length} {ready.length === 1 ? "person" : "people"}
                </GradientButton>
                <GhostButton onClick={onClose}>Cancel</GhostButton>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
