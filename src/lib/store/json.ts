import fs from "fs";
import path from "path";
import { normalizeProject } from "../projects/normalize";
import type { HistoryEntry, Project, UserRecord } from "../types";
import {
  DuplicateKeyError,
  filterHistory,
  normalizeUser,
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
  // 매 요청 파일 전체를 읽고 파싱하면 화면마다 수십 ms 씩 쌓인다. 이 프로세스만 쓰는 파일이라 메모리 사본을 기준으로 삼는다.
  const cache = new Map<string, unknown[]>();

  function read<T>(name: string): T[] {
    const hit = cache.get(name);
    if (hit) return hit as T[];
    const file = path.join(dir, `${name}.json`);
    const rows = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T[]) : [];
    cache.set(name, rows);
    return rows;
  }

  function write<T>(name: string, rows: T[]) {
    const file = path.join(dir, `${name}.json`);
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(rows), "utf8");
    fs.renameSync(tmp, file);
    cache.set(name, rows);
  }

  // 파일 하나를 읽고-고치고-쓰는 동안 다른 요청이 끼어들면 한쪽 변경이 사라진다 → 파일별로 직렬화.
  function mutate<T, R>(name: string, fn: (rows: T[]) => R): Promise<R> {
    const prev = chains.get(name) ?? Promise.resolve();
    const next = prev.then(() => {
      // 실패한 변경이 캐시에 반쯤 남지 않도록 사본에 적용한다.
      const rows = read<T>(name).slice();
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
      list: async () => (await snapshot<UserRecord>("users")).map((u) => normalizeUser(clone(u))),
      async get(id) {
        const u = (await snapshot<UserRecord>("users")).find((x) => x.userId === id);
        return u ? normalizeUser(clone(u)) : null;
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
      list: async () => (await snapshot<Project>("projects")).map((p) => normalizeProject(clone(p) as never)),
      async get(id) {
        const p = (await snapshot<Project>("projects")).find((x) => x.prjId === id);
        return p ? normalizeProject(clone(p) as never) : null;
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
      remove: (id) =>
        mutate<Project, void>("projects", (rows) => {
          const i = rows.findIndex((r) => r.prjId === id);
          if (i >= 0) rows.splice(i, 1);
        }),
    },
    config: {
      async get<T>(key: string) {
        const row = (await snapshot<ConfigRow>("config")).find((r) => r.key === key);
        return row ? (clone({ value: row.value, verNo: row.verNo, updAt: row.updAt, updUserId: row.updUserId }) as ConfigValue<T>) : null;
      },
      set: (key, value, verNo, userId) =>
        mutate<ConfigRow, void>("config", (rows) => {
          const row: ConfigRow = { key, value: clone(value), verNo, updAt: new Date().toISOString(), updUserId: userId };
          const i = rows.findIndex((r) => r.key === key);
          if (i >= 0) rows[i] = row;
          else rows.push(row);
        }),
    },
    history: {
      add: (e) =>
        mutate<HistoryEntry, void>("history", (rows) => {
          const histId = rows.reduce((m, h) => Math.max(m, h.histId), 0) + 1;
          rows.push({ ...clone(e), histId });
        }),
      async list(f) {
        return clone(filterHistory(await snapshot<HistoryEntry>("history"), f));
      },
    },
    meas: {
      async get(datId) {
        return clone((await snapshot<MeasRow>("meas")).find((r) => r.datId === datId) ?? null);
      },
      async listAll(kind) {
        return clone((await snapshot<MeasRow>("meas")).filter((r) => !kind || r.kind === kind));
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
