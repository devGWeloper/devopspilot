import type { DbConfig } from "../config";
import type { AgreeCd, Fit, HistoryEntry, OrgCd, Project, ProjectStatus, Role, UserRecord } from "../types";
import { TABLES } from "./schema";
import {
  DuplicateKeyError,
  formatPrjId,
  type ConfigValue,
  type HistoryFilter,
  type MeasKind,
  type MeasRow,
  type Store,
} from "./types";

type OracleDb = typeof import("oracledb");
type Row = Record<string, unknown>;

const s = (v: unknown) => (v === null || v === undefined ? null : String(v));
const json = <T>(v: unknown, d: T): T => {
  if (typeof v !== "string" || !v) return d;
  try {
    return JSON.parse(v) as T;
  } catch {
    return d;
  }
};

export async function createOracleStore(cfg: DbConfig): Promise<Store> {
  // 드라이버가 없는 PC 에서도 앱 모듈 로드가 깨지지 않도록 지연 로드한다.
  const oracledb: OracleDb = (await import("oracledb")).default ?? (await import("oracledb"));
  oracledb.fetchAsString = [oracledb.CLOB];
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  oracledb.autoCommit = true;
  const pool = await oracledb.createPool({ ...cfg, poolMin: 1, poolMax: 8, poolIncrement: 1 });
  const clob = (v: unknown) => ({ val: v === undefined ? null : JSON.stringify(v), type: oracledb.CLOB });

  async function q(sql: string, binds: Record<string, unknown> = {}): Promise<Row[]> {
    const conn = await pool.getConnection();
    try {
      const r = await conn.execute<Row>(sql, binds as never);
      return r.rows ?? [];
    } finally {
      await conn.close();
    }
  }

  async function exec(sql: string, binds: Record<string, unknown> = {}): Promise<number> {
    const conn = await pool.getConnection();
    try {
      const r = await conn.execute(sql, binds as never);
      return r.rowsAffected ?? 0;
    } catch (e) {
      if (String(e).includes("ORA-00001")) throw new DuplicateKeyError(String(binds.id ?? ""));
      throw e;
    } finally {
      await conn.close();
    }
  }

  async function ensureSchema() {
    const existing = new Set(
      (await q("SELECT TABLE_NAME FROM USER_TABLES WHERE TABLE_NAME LIKE 'POC\\_%' ESCAPE '\\'")).map((r) =>
        String(r.TABLE_NAME),
      ),
    );
    for (const t of TABLES) {
      if (existing.has(t.name)) continue;
      for (const stmt of t.ddl) await exec(stmt);
      console.info(`[store] created table ${t.name}`);
    }
  }

  await ensureSchema();

  const toUser = (r: Row): UserRecord => ({
    userId: String(r.USER_ID),
    userNm: String(r.USER_NM),
    orgCd: String(r.ORG_CD) as OrgCd,
    deptNm: s(r.DEPT_NM) ?? "",
    role: String(r.ROLE_CD) as Role,
    useYn: r.USE_YN === "Y",
    pwdHash: String(r.PWD_HASH),
    pwdSalt: String(r.PWD_SALT),
    lastLoginAt: s(r.LAST_LOGIN_DT),
    regAt: String(r.REG_DT),
    updAt: String(r.UPD_DT),
  });

  const userBinds = (u: UserRecord) => ({
    id: u.userId,
    nm: u.userNm,
    org: u.orgCd,
    dept: u.deptNm,
    role: u.role,
    hash: u.pwdHash,
    salt: u.pwdSalt,
    useYn: u.useYn ? "Y" : "N",
    lastLogin: u.lastLoginAt,
    regAt: u.regAt,
    updAt: u.updAt,
  });

  const toProject = (r: Row): Project => ({
    prjId: String(r.PRJ_ID),
    prjNm: String(r.PRJ_NM),
    sysNm: s(r.SYS_NM) ?? "",
    pmUserId: String(r.PM_USER_ID),
    pmUserNm: s(r.PM_USER_NM) ?? "",
    status: String(r.STATUS_CD) as ProjectStatus,
    statusNote: s(r.STATUS_NOTE),
    devTypeCd: s(r.DEV_TYPE_CD),
    mainLangCd: s(r.MAIN_LANG_CD),
    domainCd: s(r.DOMAIN_CD),
    sysTypeCd: s(r.SYS_TYPE_CD),
    answerCnt: Number(r.ANSWER_CNT ?? 0),
    indicatorCnt: Number(r.INDICATOR_CNT ?? 0),
    suggestFit: String(r.SUGGEST_FIT) as Fit,
    finalFit: String(r.FINAL_FIT) as Fit,
    aiFit: (s(r.AI_FIT) as Fit | null) ?? null,
    axAgree: String(r.AX_AGREE_CD) as AgreeCd,
    hxAgree: String(r.HX_AGREE_CD) as AgreeCd,
    critVer: Number(r.CRIT_VER ?? 1),
    base: json(r.BASE_JSON, {} as Project["base"]),
    eval: json(r.EVAL_JSON, { answers: {}, notes: {}, confirm: null }),
    reviews: json(r.REVIEW_JSON, []),
    ai: json(r.AI_JSON, null),
    regUserId: s(r.REG_USER_ID) ?? "",
    regAt: String(r.REG_DT),
    updUserId: s(r.UPD_USER_ID) ?? "",
    updAt: String(r.UPD_DT),
  });

  const projectBinds = (p: Project) => ({
    id: p.prjId,
    nm: p.prjNm,
    sys: p.sysNm,
    pm: p.pmUserId,
    pmNm: p.pmUserNm,
    st: p.status,
    note: p.statusNote,
    dev: p.devTypeCd,
    lang: p.mainLangCd,
    dom: p.domainCd,
    stype: p.sysTypeCd,
    ans: p.answerCnt,
    ind: p.indicatorCnt,
    sug: p.suggestFit,
    fin: p.finalFit,
    ai: p.aiFit,
    ax: p.axAgree,
    hx: p.hxAgree,
    ver: p.critVer,
    base: clob(p.base),
    ev: clob(p.eval),
    rev: clob(p.reviews),
    aiJson: clob(p.ai),
    regUser: p.regUserId,
    regAt: p.regAt,
    updUser: p.updUserId,
    updAt: p.updAt,
  });

  const toMeas = (r: Row): MeasRow => ({
    datId: String(r.DAT_ID),
    kind: String(r.KIND_CD) as MeasKind,
    prjId: String(r.PRJ_ID),
    wbsId: s(r.WBS_ID),
    workDt: s(r.WORK_DT),
    userId: s(r.USER_ID),
    srcCd: String(r.SRC_CD),
    data: json(r.DATA_JSON, null),
    regUserId: s(r.REG_USER_ID) ?? "",
    regAt: String(r.REG_DT),
    updAt: String(r.UPD_DT),
  });

  return {
    kind: "oracle",
    users: {
      async list() {
        return (await q("SELECT * FROM POC_USER_MAS ORDER BY REG_DT, USER_ID")).map(toUser);
      },
      async get(id) {
        const rows = await q("SELECT * FROM POC_USER_MAS WHERE USER_ID = :id", { id });
        return rows[0] ? toUser(rows[0]) : null;
      },
      async insert(u) {
        await exec(
          `INSERT INTO POC_USER_MAS (USER_ID, USER_NM, ORG_CD, DEPT_NM, ROLE_CD, PWD_HASH, PWD_SALT, USE_YN, LAST_LOGIN_DT, REG_DT, UPD_DT)
           VALUES (:id, :nm, :org, :dept, :role, :hash, :salt, :useYn, :lastLogin, :regAt, :updAt)`,
          userBinds(u),
        );
      },
      async update(id, patch) {
        const cur = await this.get(id);
        if (!cur) return;
        const u = { ...cur, ...patch, userId: id };
        await exec(
          `UPDATE POC_USER_MAS SET USER_NM = :nm, ORG_CD = :org, DEPT_NM = :dept, ROLE_CD = :role, PWD_HASH = :hash,
             PWD_SALT = :salt, USE_YN = :useYn, LAST_LOGIN_DT = :lastLogin, REG_DT = :regAt, UPD_DT = :updAt
           WHERE USER_ID = :id`,
          userBinds(u),
        );
      },
    },
    projects: {
      async list() {
        return (await q("SELECT * FROM POC_PRJ_MAS ORDER BY PRJ_ID")).map(toProject);
      },
      async get(id) {
        const rows = await q("SELECT * FROM POC_PRJ_MAS WHERE PRJ_ID = :id", { id });
        return rows[0] ? toProject(rows[0]) : null;
      },
      async insert(p) {
        await exec(
          `INSERT INTO POC_PRJ_MAS (PRJ_ID, PRJ_NM, SYS_NM, PM_USER_ID, PM_USER_NM, STATUS_CD, STATUS_NOTE, DEV_TYPE_CD,
             MAIN_LANG_CD, DOMAIN_CD, SYS_TYPE_CD, ANSWER_CNT, INDICATOR_CNT, SUGGEST_FIT, FINAL_FIT, AI_FIT,
             AX_AGREE_CD, HX_AGREE_CD, CRIT_VER, BASE_JSON, EVAL_JSON, REVIEW_JSON, AI_JSON, REG_USER_ID, REG_DT, UPD_USER_ID, UPD_DT)
           VALUES (:id, :nm, :sys, :pm, :pmNm, :st, :note, :dev, :lang, :dom, :stype, :ans, :ind, :sug, :fin, :ai,
             :ax, :hx, :ver, :base, :ev, :rev, :aiJson, :regUser, :regAt, :updUser, :updAt)`,
          projectBinds(p),
        );
      },
      async update(p, expectedUpdAt) {
        const n = await exec(
          `UPDATE POC_PRJ_MAS SET PRJ_NM = :nm, SYS_NM = :sys, PM_USER_ID = :pm, PM_USER_NM = :pmNm, STATUS_CD = :st,
             STATUS_NOTE = :note, DEV_TYPE_CD = :dev, MAIN_LANG_CD = :lang, DOMAIN_CD = :dom, SYS_TYPE_CD = :stype,
             ANSWER_CNT = :ans, INDICATOR_CNT = :ind, SUGGEST_FIT = :sug, FINAL_FIT = :fin, AI_FIT = :ai,
             AX_AGREE_CD = :ax, HX_AGREE_CD = :hx, CRIT_VER = :ver, BASE_JSON = :base, EVAL_JSON = :ev,
             REVIEW_JSON = :rev, AI_JSON = :aiJson, REG_USER_ID = :regUser, REG_DT = :regAt, UPD_USER_ID = :updUser, UPD_DT = :updAt
           WHERE PRJ_ID = :id AND UPD_DT = :expected`,
          { ...projectBinds(p), expected: expectedUpdAt },
        );
        return n === 1;
      },
      async nextId() {
        const rows = await q(
          "SELECT NVL(MAX(TO_NUMBER(REGEXP_SUBSTR(PRJ_ID, '[0-9]+$'))), 0) AS N FROM POC_PRJ_MAS WHERE REGEXP_LIKE(PRJ_ID, '^PRJ-[0-9]+$')",
        );
        return formatPrjId(Number(rows[0]?.N ?? 0) + 1);
      },
    },
    config: {
      async get<T>(key: string) {
        const rows = await q("SELECT * FROM POC_CFG_MAS WHERE CFG_KEY = :k", { k: key });
        const r = rows[0];
        if (!r) return null;
        return {
          value: json<T>(r.CFG_JSON, null as T),
          verNo: Number(r.VER_NO),
          updAt: String(r.UPD_DT),
          updUserId: s(r.UPD_USER_ID) ?? "",
        } as ConfigValue<T>;
      },
      async set(key, value, verNo, userId) {
        await exec(
          `MERGE INTO POC_CFG_MAS t USING (SELECT :k AS CFG_KEY FROM DUAL) s ON (t.CFG_KEY = s.CFG_KEY)
           WHEN MATCHED THEN UPDATE SET CFG_JSON = :v, VER_NO = :ver, UPD_USER_ID = :u, UPD_DT = :d
           WHEN NOT MATCHED THEN INSERT (CFG_KEY, CFG_JSON, VER_NO, UPD_USER_ID, UPD_DT) VALUES (:k, :v, :ver, :u, :d)`,
          { k: key, v: clob(value), ver: verNo, u: userId, d: new Date().toISOString() },
        );
      },
      async keys(prefix) {
        const rows = await q("SELECT CFG_KEY FROM POC_CFG_MAS WHERE CFG_KEY LIKE :p ESCAPE '\\'", {
          p: prefix.replace(/[\\%_]/g, (c) => `\\${c}`) + "%",
        });
        return rows.map((r) => String(r.CFG_KEY)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      },
    },
    history: {
      async add(e) {
        await exec(
          `INSERT INTO POC_HIST_HIS (TARGET_TYP, TARGET_ID, ACTION_CD, SUMMARY, DIFF_JSON, USER_ID, USER_NM, REG_DT)
           VALUES (:t, :id, :a, :sm, :d, :u, :un, :r)`,
          {
            t: e.targetTyp,
            id: e.targetId,
            a: e.actionCd,
            sm: e.summary.slice(0, 500),
            d: clob(e.diff ?? null),
            u: e.userId,
            un: e.userNm,
            r: e.regAt,
          },
        );
      },
      async list(f: HistoryFilter) {
        const where: string[] = [];
        const b: Record<string, unknown> = { lim: Math.min(Math.max(f.limit ?? 200, 1), 1000) };
        if (f.targetTyp) (where.push("TARGET_TYP = :tt"), (b.tt = f.targetTyp));
        if (f.targetId) (where.push("TARGET_ID = :ti"), (b.ti = f.targetId));
        if (f.userId) (where.push("USER_ID = :ui"), (b.ui = f.userId));
        if (f.from) (where.push("REG_DT >= :fr"), (b.fr = f.from));
        if (f.to) (where.push("REG_DT <= :to"), (b.to = f.to));
        const rows = await q(
          `SELECT * FROM POC_HIST_HIS ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY HIST_ID DESC FETCH FIRST :lim ROWS ONLY`,
          b,
        );
        return rows.map(
          (r): HistoryEntry => ({
            histId: Number(r.HIST_ID),
            targetTyp: String(r.TARGET_TYP) as HistoryEntry["targetTyp"],
            targetId: String(r.TARGET_ID),
            actionCd: String(r.ACTION_CD),
            summary: s(r.SUMMARY) ?? "",
            diff: json(r.DIFF_JSON, null),
            userId: s(r.USER_ID) ?? "",
            userNm: s(r.USER_NM) ?? "",
            regAt: String(r.REG_DT),
          }),
        );
      },
    },
    meas: {
      async list(prjId, kind) {
        const rows = kind
          ? await q("SELECT * FROM POC_MEAS_DAT WHERE PRJ_ID = :p AND KIND_CD = :k", { p: prjId, k: kind })
          : await q("SELECT * FROM POC_MEAS_DAT WHERE PRJ_ID = :p", { p: prjId });
        return rows.map(toMeas);
      },
      async listAll(kind) {
        const rows = kind
          ? await q("SELECT * FROM POC_MEAS_DAT WHERE KIND_CD = :k", { k: kind })
          : await q("SELECT * FROM POC_MEAS_DAT");
        return rows.map(toMeas);
      },
      async upsert(rows) {
        if (rows.length === 0) return;
        const conn = await pool.getConnection();
        try {
          await conn.executeMany(
            `MERGE INTO POC_MEAS_DAT t USING (SELECT :datId AS DAT_ID FROM DUAL) s ON (t.DAT_ID = s.DAT_ID)
             WHEN MATCHED THEN UPDATE SET KIND_CD = :kind, PRJ_ID = :prj, WBS_ID = :wbs, WORK_DT = :dt, USER_ID = :usr,
               SRC_CD = :src, DATA_JSON = :data, UPD_DT = :updAt
             WHEN NOT MATCHED THEN INSERT (DAT_ID, KIND_CD, PRJ_ID, WBS_ID, WORK_DT, USER_ID, SRC_CD, DATA_JSON, REG_USER_ID, REG_DT, UPD_DT)
               VALUES (:datId, :kind, :prj, :wbs, :dt, :usr, :src, :data, :regUser, :regAt, :updAt)`,
            rows.map((r) => ({
              datId: r.datId,
              kind: r.kind,
              prj: r.prjId,
              wbs: r.wbsId,
              dt: r.workDt,
              usr: r.userId,
              src: r.srcCd,
              data: JSON.stringify(r.data),
              regUser: r.regUserId,
              regAt: r.regAt,
              updAt: r.updAt,
            })),
            {
              bindDefs: {
                datId: { type: oracledb.STRING, maxSize: 200 },
                kind: { type: oracledb.STRING, maxSize: 10 },
                prj: { type: oracledb.STRING, maxSize: 20 },
                wbs: { type: oracledb.STRING, maxSize: 50 },
                dt: { type: oracledb.STRING, maxSize: 10 },
                usr: { type: oracledb.STRING, maxSize: 100 },
                src: { type: oracledb.STRING, maxSize: 20 },
                data: { type: oracledb.CLOB },
                regUser: { type: oracledb.STRING, maxSize: 50 },
                regAt: { type: oracledb.STRING, maxSize: 30 },
                updAt: { type: oracledb.STRING, maxSize: 30 },
              },
            },
          );
        } finally {
          await conn.close();
        }
      },
      async remove(datId) {
        await exec("DELETE FROM POC_MEAS_DAT WHERE DAT_ID = :id", { id: datId });
      },
    },
  };
}
