export interface ParseWarning {
  line: number;
  message: string;
}

export interface ParseResult<T> {
  rows: T[];
  warnings: ParseWarning[];
}

// RFC 4180: 따옴표 안의 쉼표·줄바꿈·이스케이프("")를 처리한다. 엑셀이 붙이는 BOM 도 벗긴다.
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}

export function extractWbs(text: string | null | undefined, pattern: string): string | null {
  if (!text) return null;
  try {
    return new RegExp(pattern).exec(text)?.[0] ?? null;
  } catch {
    return null;
  }
}

export function headerIndex(header: string[], names: string[]): number {
  const norm = header.map((h) => h.trim().toLowerCase());
  for (const n of names) {
    const i = norm.indexOf(n.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

export function toNum(v: string | undefined): number | null {
  if (v === undefined || v.trim() === "") return 0;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const DATE_RE = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/;

export function normDate(v: string | undefined): string | null {
  const m = DATE_RE.exec((v ?? "").trim());
  if (!m) return null;
  const s = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
}

// 측정 대상이 국내 조직이므로 일자 경계는 KST(UTC+9)로 자른다 — 서버 타임존 설정과 무관하게 같은 결과를 내기 위해.
export function kstDate(ms: number): string {
  return new Date(ms + 9 * 3600_000).toISOString().slice(0, 10);
}
