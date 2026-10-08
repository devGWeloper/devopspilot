import type { LlmConfig } from "../config";

// 사내 OpenAI 호환 엔드포인트를 LangChain ChatOpenAI 로 호출한다. 키는 서버에서만 읽고 로그에 남기지 않는다.
export async function callLlm(cfg: LlmConfig, prompt: { system: string; user: string }): Promise<string> {
  const { ChatOpenAI } = await import("@langchain/openai");
  const llm = new ChatOpenAI({
    model: cfg.model,
    apiKey: cfg.apiKey,
    temperature: cfg.temperature,
    timeout: cfg.timeoutMs,
    maxRetries: 1,
    configuration: { baseURL: cfg.baseUrl },
  });
  const res = await llm.invoke([
    ["system", prompt.system],
    ["human", prompt.user],
  ]);
  const c = res.content;
  if (typeof c === "string") return c;
  return c.map((part) => (typeof part === "string" ? part : "text" in part ? String(part.text) : "")).join("");
}

export function llmReady(cfg: LlmConfig): string | null {
  if (!cfg.enabled) return "AI 판정 기능이 꺼져 있습니다 (config.yml llm.enabled).";
  if (!cfg.baseUrl || !cfg.model) return "config.yml 의 llm.baseUrl·model 을 입력해 주세요.";
  return null;
}
