import type { MeasKind, MeasRow, Store } from "../store/types";
import { defaultMeasureSettings } from "./defaults";
import { datId } from "./keys";
import type { AiUse, Commit, Defect, Effort, Feature, MeasureInput, MeasureSettings } from "./types";

export const SETTINGS_KEY = "MEASURE";

type Entity = { FEATURE: Feature; EFFORT: Effort; DEFECT: Defect; AIUSE: AiUse; COMMIT: Commit };

export function idOf<K extends MeasKind>(kind: K, o: Entity[K]): string {
  switch (kind) {
    case "FEATURE": {
      const f = o as Feature;
      return datId.feature(f.prjId, f.wbsId);
    }
    case "EFFORT": {
      const e = o as Effort;
      return datId.effort(e.prjId, e.wbsId, e.workDt, e.phase, e.srcCd === "GRID" ? "GRID" : e.userId);
    }
    case "DEFECT": {
      const d = o as Defect;
      return datId.defect(d.prjId, d.defectId);
    }
    case "AIUSE": {
      const u = o as AiUse;
      return datId.aiuse(u.prjId, u.workDt, u.userId, u.wbsId, u.model, u.srcCd);
    }
    default: {
      const c = o as Commit;
      return datId.commit(c.prjId, c.hash);
    }
  }
}

export function toRow<K extends MeasKind>(kind: K, o: Entity[K], actorId: string, now: string): MeasRow {
  const x = o as unknown as Record<string, unknown>;
  const workDt = (kind === "FEATURE" ? x.completedAt : kind === "DEFECT" ? x.foundDt : x.workDt) as string | null;
  const userId = (kind === "FEATURE" ? x.devUserId : kind === "COMMIT" ? x.author : kind === "DEFECT" ? null : x.userId) as string | null;
  const srcCd = kind === "FEATURE" ? "MANUAL" : kind === "COMMIT" ? "GIT" : String(x.srcCd ?? "MANUAL");
  return {
    datId: idOf(kind, o),
    kind,
    prjId: String(x.prjId),
    wbsId: (x.wbsId as string | null) ?? null,
    workDt: workDt ?? null,
    userId: userId ?? null,
    srcCd,
    data: o,
    regUserId: actorId,
    regAt: now,
    updAt: now,
  };
}

function rowsToInput(rows: MeasRow[], settings: MeasureSettings): MeasureInput {
  const of = <T>(k: MeasKind) => rows.filter((r) => r.kind === k).map((r) => ({ ...(r.data as T), prjId: r.prjId }) as T);
  return {
    settings,
    features: of<Feature>("FEATURE").sort((a, b) => a.wbsId.localeCompare(b.wbsId, undefined, { numeric: true })),
    efforts: of<Effort>("EFFORT"),
    defects: of<Defect>("DEFECT"),
    usages: of<AiUse>("AIUSE"),
    commits: of<Commit>("COMMIT"),
  };
}

export async function getSettings(store: Store): Promise<MeasureSettings> {
  const saved = (await store.config.get<Partial<MeasureSettings>>(SETTINGS_KEY))?.value ?? {};
  const d = defaultMeasureSettings();
  return { ...d, ...saved, phases: { ...d.phases, ...(saved.phases ?? {}) }, sizeBands: { ...d.sizeBands, ...(saved.sizeBands ?? {}) } };
}

export async function loadInput(store: Store, prjIds: string[] | "ALL"): Promise<MeasureInput> {
  const settings = await getSettings(store);
  if (prjIds === "ALL") return rowsToInput(await store.meas.listAll(), settings);
  const rows = (await Promise.all(prjIds.map((p) => store.meas.list(p)))).flat();
  return rowsToInput(rows, settings);
}
