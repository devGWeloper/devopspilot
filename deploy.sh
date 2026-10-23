#!/bin/bash
# ============================================================
#  deploy.sh — AI 활용 생산성 향상 PoC 포털 배포 스크립트
#  사용법:
#    ./deploy.sh           # 기본: prd
#    ./deploy.sh dev       # dev 브랜치(main) 배포
#    ./deploy.sh prd       # prd 브랜치 배포
#
#  config.yml 은 DB 비밀번호가 들어 있어 git 에 올리지 않는다.
#  서버의 $DEPLOY_DIR/config.yml 을 한 번 만들어 두면 배포 때 그대로 남는다
#  (git reset --hard 는 .gitignore 된 config.yml·data/ 를 건드리지 않음).
# ============================================================

set -e

# ────────────────────────────────────────────────────────────
#  [설정] 아래 값을 환경에 맞게 수정하세요
# ────────────────────────────────────────────────────────────
GIT_REPO_URL="ssh://git@<bitbucket-host>/<project>/devopspilot.git"   # ← git 주소 입력
DEV_BRANCH="main"                                                     # ← dev 배포 브랜치
PRD_BRANCH="prd"                                                      # ← prd 배포 브랜치
DEPLOY_DIR="/home/idms/devopspilot"                                   # ← 서버 배포 경로
PORT=5176
# ────────────────────────────────────────────────────────────

LOG_FILE="$DEPLOY_DIR/app.log"
PID_FILE="$DEPLOY_DIR/app.pid"
DEPLOY_LOG="$DEPLOY_DIR/deploy.log"

mkdir -p "$DEPLOY_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$DEPLOY_LOG"
}

# ── 0. 배포 환경/브랜치 결정 ──────────────────────────────
TARGET_ENV="${1:-prd}"

case "$TARGET_ENV" in
  dev)  GIT_BRANCH="$DEV_BRANCH" ;;
  prd)  GIT_BRANCH="$PRD_BRANCH" ;;
  *)    log "  ✗ 알 수 없는 환경: $TARGET_ENV (dev|prd 만 허용)"; exit 1 ;;
esac

log "▶ 배포 환경: $TARGET_ENV  /  브랜치: $GIT_BRANCH"

# ── 1. 소스코드 갱신 ──────────────────────────────────────
# 서버를 내리기 전에 받아 둔다 — git 주소·권한·설정 문제로 멈춰도 기존 서버는 계속 뜬 채로 남게.
log "▶ 소스코드 갱신 중..."
cd "$DEPLOY_DIR"
if [ ! -d "$DEPLOY_DIR/.git" ]; then
  log "  저장소 없음 — 최초 clone 진행..."
  git init
  git remote add origin "$GIT_REPO_URL"
fi
git fetch origin
git reset --hard "origin/$GIT_BRANCH"
chmod +x "$DEPLOY_DIR/deploy.sh"
log "  소스 갱신 완료 ($GIT_BRANCH @ $(git rev-parse --short HEAD))"

# ── 2. 설정 파일 확인 ─────────────────────────────────────
# config.yml 이 없으면 로컬 JSON 저장소에 데모 계정·샘플 과제가 들어간다 — 운영에서는 막는다.
CONFIG_FILE="$DEPLOY_DIR/config.yml"
if [ ! -f "$CONFIG_FILE" ]; then
  if [ "$TARGET_ENV" = "prd" ]; then
    log "  ✗ 설정 파일이 없습니다: $CONFIG_FILE"
    log "    cp config.example.yml config.yml 후 db·auth.secret 을 채우세요."
    exit 1
  fi
  log "  ⚠  config.yml 없음 — dev 는 로컬 JSON 저장소(data/, 데모 데이터)로 뜹니다."
else
  log "  설정 파일 확인: $CONFIG_FILE"
fi

# ── 3. 서버 중지 ──────────────────────────────────────────
# 실행 중인 서버가 .next 를 읽고 있어 빌드 전에 내린다.
log "▶ 서버 중지 중..."
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  kill "$(cat "$PID_FILE")"
  rm -f "$PID_FILE"
  sleep 2
  log "  서버 종료 완료"
else
  log "  실행 중인 서버 없음 (건너뜀)"
fi

# ── 4. 패키지 설치 ────────────────────────────────────────
log "▶ 패키지 설치 중 (빌드용 devDeps 포함)..."
npm install --silent
log "  패키지 설치 완료"

# ── 5. 빌드 ───────────────────────────────────────────────
# 이전 빌드 산출물이 섞이면 간헐적으로 페이지를 못 찾는다 — 매번 비우고 빌드.
log "▶ Next.js 빌드 중..."
rm -rf "$DEPLOY_DIR/.next"
npm run build
log "  빌드 완료"

# ── 5-1. devDependencies 정리 ─────────────────────────────
log "▶ devDependencies 정리 중..."
npm prune --omit=dev --silent
log "  정리 완료"

# ── 6. 서버 기동 ──────────────────────────────────────────
log "▶ 서버 시작 중..."
nohup node_modules/.bin/next start -p $PORT > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
log "  서버 시작 완료 (PID: $(cat "$PID_FILE"), PORT: $PORT)"
log "  로그 확인: tail -f $LOG_FILE"
log "════════════════════════ 배포 완료 ($TARGET_ENV) ════════════════════════"
