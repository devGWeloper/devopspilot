import { can, type ActorFull } from "../auth/permissions";
import { analyzeBalance } from "../balance";
import { loadConfig } from "../config";
import { getCodes, getPublishedCriteria } from "../criteria/service";
import { FIT_LABEL } from "../fitness";
import { record } from "../history";
import { err, forbiddenR, notFoundR, okR, type ServiceResult } from "../result";
import type { Store } from "../store/types";
import type { AiResult, Project } from "../types";
import { callLlm, llmReady } from "./assess";
import { parseAssessResponse } from "./parse";
import { buildAssessPrompt, PROMPT_TEMPLATE } from "./prompt";

export interface AiPrompt {
  text: string;
  version: number;
  updatedBy: string | null;
  updatedAt: string | null;
}

export async function getPrompt(store: Store): Promise<AiPrompt> {
  return (await store.config.get<AiPrompt>("AI_PROMPT"))?.value ?? { text: PROMPT_TEMPLATE, version: 0, updatedBy: null, updatedAt: null };
}

export async function savePrompt(store: Store, actor: ActorFull, text: string): Promise<ServiceResult<AiPrompt>> {
  if (!can(actor, "ai.use")) return forbiddenR();
  if (!text?.trim()) return err(422, "VALIDATION", "프롬프트를 입력해 주세요.");
  if (text.length > 20_000) return err(422, "VALIDATION", "프롬프트가 너무 깁니다(2만 자 이내).");
  const prev = await getPrompt(store);
  const next: AiPrompt = { text, version: prev.version + 1, updatedBy: actor.userNm, updatedAt: new Date().toISOString() };
  await store.config.set(`AI_PROMPT@${next.version}`, next, next.version, actor.userId);
  await store.config.set("AI_PROMPT", next, next.version, actor.userId);
  await record(store, actor, { targetTyp: "AI_PROMPT", targetId: `v${next.version}`, actionCd: "UPDATE", summary: `AI 판정 프롬프트 v${next.version} 저장` });
  return okR(next);
}

export async function assessProject(store: Store, actor: ActorFull, prjId: string): Promise<ServiceResult<Project>> {
  if (!can(actor, "ai.use")) return forbiddenR();
  const cfg = loadConfig().llm;
  const notReady = llmReady(cfg);
  if (notReady) return err(409, "LLM_NOT_READY", notReady);
  const p = await store.projects.get(prjId);
  if (!p) return notFoundR("과제");
  const prompt = await getPrompt(store);
  if (prompt.version === 0) return err(409, "NO_PROMPT", "컨설턴트 프롬프트를 먼저 저장해 주세요.");
  const criteria = await getPublishedCriteria(store);
  const codes = await getCodes(store);
  const all = await store.projects.list();
  const messages = buildAssessPrompt({ consultantPrompt: prompt.text, criteria, project: p, balance: analyzeBalance(all, criteria, codes), codes });

  let text: string;
  try {
    text = await callLlm(cfg, messages);
  } catch (e) {
    // 키·내부 주소가 섞일 수 있어 원문 대신 요약만 돌려준다.
    console.error("[ai] llm call failed", { prjId, err: e instanceof Error ? e.name : "error" });
    return err(502, "LLM_FAILED", `LLM 호출에 실패했습니다: ${e instanceof Error ? e.message.slice(0, 160) : "알 수 없는 오류"}`);
  }
  const parsed = parseAssessResponse(text);
  if (!parsed.ok) return err(502, "LLM_BAD_OUTPUT", parsed.error);

  const ai: AiResult = { ...parsed.value, model: cfg.model, promptVersion: prompt.version, criteriaVersion: criteria.version, assessedAt: new Date().toISOString(), assessedBy: actor.userNm };
  // AI 결과만 갱신하므로 다른 사람의 동시 편집을 덮지 않도록 최신본을 다시 읽어 붙인다.
  for (let i = 0; i < 3; i++) {
    const cur = await store.projects.get(prjId);
    if (!cur) return notFoundR("과제");
    const next: Project = { ...cur, ai, aiFit: ai.grade, updAt: new Date(Math.max(Date.now(), new Date(cur.updAt).getTime() + 1)).toISOString() };
    if (await store.projects.update(next, cur.updAt)) {
      await record(store, actor, { targetTyp: "PROJECT", targetId: prjId, actionCd: "AI_ASSESS", summary: `AI 의견: ${FIT_LABEL[ai.grade]} (${cfg.model}, 프롬프트 v${prompt.version})` });
      return okR(next);
    }
  }
  return err(409, "CONFLICT", "저장 중 충돌이 반복됐습니다. 다시 시도해 주세요.");
}

export async function ping(): Promise<ServiceResult<{ model: string; ms: number }>> {
  const cfg = loadConfig().llm;
  const notReady = llmReady(cfg);
  if (notReady) return err(409, "LLM_NOT_READY", notReady);
  const t0 = Date.now();
  try {
    await callLlm(cfg, { system: "짧게 답하라.", user: "OK 라고만 답하라." });
    return okR({ model: cfg.model, ms: Date.now() - t0 });
  } catch (e) {
    return err(502, "LLM_FAILED", `연결 실패: ${e instanceof Error ? e.message.slice(0, 160) : "알 수 없는 오류"}`);
  }
}
