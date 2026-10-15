import fs from "fs";
import path from "path";
import yaml from "js-yaml";

export interface DbConfig {
  user: string;
  password: string;
  connectString: string;
}

export interface AppConfig {
  db: DbConfig | null;
  authSecret: string | null;
  /** 텔레메트리 수신 토큰 — 비우면 /api/otel 수신을 받지 않는다 */
  collectToken: string | null;
  loadError: string | null;
}

let cached: AppConfig | null = null;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function parse(raw: unknown): Omit<AppConfig, "loadError"> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, Record<string, unknown> | undefined>;
  const db = r.db ?? {};
  const user = str(db.user);
  const password = str(db.password);
  const connectString = str(db.connectString);
  return {
    // 셋 중 하나라도 비면 JSON 저장소로 간다 — 반쯤 채운 설정으로 Oracle 에 붙으려다 실패하지 않게.
    db: user && password && connectString ? { user, password, connectString } : null,
    authSecret: str(r.auth?.secret) || null,
    collectToken: process.env.POC_COLLECT_TOKEN?.trim() || str(r.collect?.token) || null,
  };
}

export function loadConfig(): AppConfig {
  if (cached) return cached;
  const file = path.join(process.cwd(), "config.yml");
  let raw: unknown = null;
  let loadError: string | null = null;
  if (fs.existsSync(file)) {
    try {
      raw = yaml.load(fs.readFileSync(file, "utf8"));
    } catch (e) {
      loadError = `config.yml 을 읽을 수 없습니다: ${String(e)}`;
      console.error(loadError);
    }
  }
  cached = { ...parse(raw), loadError };
  return cached;
}

export function resetConfigCache(): void {
  cached = null;
}
