import fs from "fs";
import path from "path";
import type { HistoryEntry, Project, UserRecord } from "../types";
import {
  DuplicateKeyError,
  filterHistory,
  formatPrjId,
  prjNumber,
  type ConfigValue,
  type MeasRow,
  type Store,
} from "./types";

interface ConfigRow extends ConfigValue<unknown> {
  key: string;
}

const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

export function createJsonStore(dir: string): Store {
  fs.mkdirSync(dir, { recursive: true });
  const chains = new Map<string, Promise<unknown>>();

  function read<T>(name: string): T[] {
    const file = path.join(dir, `${name}.json`);
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, "utf8")) as T[];
  }

  function write<T>(name: string, rows: T[]) {
    const file = path.join(dir, `${name}.json`);
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(rows, null, 1), "utf8");
    fs.renameSync(tmp, file);
  }

  // 파일 하나를 읽고-고치고-쓰는 동안 다른 요청이 끼어들면 한쪽 변경이 사라진다 → 파일별로 직렬화.
  function mutate<T, R>(name: string, fn: (rows: T[]) => R): Promise<R> {
    const prev = chains.get(name) ?? Promise.resolve();
    const next = prev.then(() => {
      const rows = read<T>(name);
      const out = fn(rows);
      write(name, rows);
      return out;
    });
    chains.set(name, next.catch(() => undefined));
    return next;
  }

  async function snapshot<T>(name: string): Promise<T[]> {
    await chains.get(name);
    return read<T>(name);
  }

  return {
    kind: "json",
    users: {
      list: () => snapshot<UserRecord>("users"),
      async get(id) {
        return (await snapshot<UserRecord>("users")).find((u) => u.userId === id) ?? null;
      },
      insert: (u) =>
        mutate<UserRecord, void>("users", (rows) => {
          if (rows.some((r) => r.userId === u.userId)) throw new DuplicateKeyError(u.userId);
          rows.push(clone(u));
        }),
      update: (id, patch) =>
        mutate<UserRecord, void>("users", (rows) => {
          const i = rows.findIndex((r) => r.userId === id);
          if (i >= 0) rows[i] = { ...rows[i], ...clone(patch), userId: id };
        }),
    },
    projects: {
      list: () => snapshot<Project>("projects"),
      async get(id) {
        return (await snapshot<Project>("projects")).find((p) => p.prjId === id) ?? null;
      },
      insert: (p) =>
        mutate<Project, void>("projects", (rows) => {
          if (rows.some((r) => r.prjId === p.prjId)) throw new DuplicateKeyError(p.prjId);
          rows.push(clone(p));
        }),
      update: (p, expectedUpdAt) =>
        mutate<Project, boolean>("projects", (rows) => {
          const i = rows.findIndex((r) => r.prjId === p.prjId);
          if (i < 0 || rows[i].updAt !== expectedUpdAt) return false;
          rows[i] = clone(p);
          return true;
        }),
      async nextId() {
        const rows = await snapshot<Project>("projects");
        return formatPrjId(rows.reduce((m, p) => Math.max(m, prjNumber(p.prjId)), 0) + 1);
      },
    },
    config: {
      async get<T>(key: string) {
        const row = (await snapshot<ConfigRow>("config")).find((r) => r.key === key);
        return row ? ({ value: row.value, verNo: row.verNo, updAt: row.updAt, updUserId: row.updUserId } as ConfigValue<T>) : null;
      },
      set: (key, value, verNo, userId) =>
        mutate<ConfigRow, void>("config", (rows) => {
          const row: ConfigRow = { key, value: clone(value), verNo, updAt: new Date().toISOString(), updUserId: userId };
          const i = rows.findIndex((r) => r.key === key);
          if (i >= 0) rows[i] = row;
          else rows.push(row);
        }),
      async keys(prefix) {
        return (await snapshot<ConfigRow>("config"))
          .map((r) => r.key)
          .filter((k) => k.startsWith(prefix))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      },
    },
    history: {
      add: (e) =>
        mutate<HistoryEntry, void>("history", (rows) => {
          const histId = rows.reduce((m, h) => Math.max(m, h.histId), 0) + 1;
          rows.push({ ...clone(e), histId });
        }),
      async list(f) {
        return filterHistory(await snapshot<HistoryEntry>("history"), f);
      },
    },
    meas: {
      async list(prjId, kind) {
        return (await snapshot<MeasRow>("meas")).filter((r) => r.prjId === prjId && (!kind || r.kind === kind));
      },
      async listAll(kind) {
        return (await snapshot<MeasRow>("meas")).filter((r) => !kind || r.kind === kind);
      },
      upsert: (input) =>
        mutate<MeasRow, void>("meas", (rows) => {
          const index = new Map(rows.map((r, i) => [r.datId, i]));
          for (const r of input) {
            const i = index.get(r.datId);
            if (i === undefined) {
              index.set(r.datId, rows.length);
              rows.push(clone(r));
            } else {
              rows[i] = { ...clone(r), regUserId: rows[i].regUserId, regAt: rows[i].regAt };
            }
          }
        }),
      remove: (datId) =>
        mutate<MeasRow, void>("meas", (rows) => {
          const i = rows.findIndex((r) => r.datId === datId);
          if (i >= 0) rows.splice(i, 1);
        }),
    },
  };
}
