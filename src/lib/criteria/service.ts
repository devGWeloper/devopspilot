import type { Store } from "../store/types";
import type { Codes, Criteria } from "../types";
import { defaultCodes, defaultCriteria } from "./defaults";

export async function getPublishedCriteria(store: Store): Promise<Criteria> {
  return (await store.config.get<Criteria>("CRITERIA"))?.value ?? defaultCriteria();
}

export async function getCodes(store: Store): Promise<Codes> {
  const stored = (await store.config.get<Codes>("CODES"))?.value;
  if (!stored) return defaultCodes();
  // 과제 선정 양식 도입 전 설정은 같은 목록 이름(domains·sysTypes)에 다른 분류를 담고 있어, 선정 목표만 살리고 목록은 양식 기준으로 바꾼다.
  if (!stored.workAreas) return { ...defaultCodes(), target: stored.target ?? defaultCodes().target };
  return { ...defaultCodes(), ...stored };
}
