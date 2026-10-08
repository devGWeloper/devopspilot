import path from "path";
import { loadConfig } from "../config";
import { createJsonStore } from "./json";
import { ensureSeed } from "./seed";
import type { Store } from "./types";

export class StoreUnavailableError extends Error {
  constructor(cause: unknown) {
    super(`DB 연결 실패: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "StoreUnavailableError";
  }
}

// dev 서버의 HMR 로 모듈이 다시 로드돼도 풀·뮤텍스가 하나만 있도록 globalThis 에 둔다.
const g = globalThis as unknown as { __pocStore?: Promise<Store> };

async function create(): Promise<Store> {
  const cfg = loadConfig();
  if (!cfg.db) {
    const store = createJsonStore(path.join(process.cwd(), "data"));
    await ensureSeed(store, { samples: true });
    return store;
  }
  try {
    const { createOracleStore } = await import("./oracle");
    const store = await createOracleStore(cfg.db);
    await ensureSeed(store, { samples: false });
    return store;
  } catch (e) {
    throw new StoreUnavailableError(e);
  }
}

export function getStore(): Promise<Store> {
  if (!g.__pocStore) {
    g.__pocStore = create().catch((e) => {
      // 실패한 Promise 를 캐시하면 DB 가 살아나도 재시작 전까지 계속 실패한다.
      g.__pocStore = undefined;
      throw e;
    });
  }
  return g.__pocStore;
}

export type { Store } from "./types";
