import fs from "fs";
import path from "path";
import yaml from "js-yaml";

// 세션 서명 키를 config.yml 에서 받되 환경변수가 있으면 그쪽이 우선한다.
// next.config 의 env 키를 쓰지 않는 이유: 클라이언트 번들에 인라인될 수 있어서.
try {
  const file = path.join(process.cwd(), "config.yml");
  if (!process.env.AUTH_SECRET && fs.existsSync(file)) {
    const cfg = yaml.load(fs.readFileSync(file, "utf8"));
    const secret = cfg && typeof cfg === "object" && cfg.auth && cfg.auth.secret;
    if (typeof secret === "string" && secret.trim()) process.env.AUTH_SECRET = secret.trim();
  }
} catch {
  // 설정 파일이 깨져 있어도 앱은 기본 키로 떠야 한다(오류는 config 로더가 보고).
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverComponentsExternalPackages: ["oracledb", "exceljs"] },
};

export default nextConfig;
