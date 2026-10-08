import type { Store } from "../store/types";
import type { Codes, Criteria } from "../types";
import { defaultCodes, defaultCriteria } from "./defaults";

export async function getPublishedCriteria(store: Store): Promise<Criteria> {
  return (await store.config.get<Criteria>("CRITERIA"))?.value ?? defaultCriteria();
}

export async function getCodes(store: Store): Promise<Codes> {
  return (await store.config.get<Codes>("CODES"))?.value ?? defaultCodes();
}
