"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { f1 } from "@/lib/format";
import type { ReqStatus } from "@/lib/measure/metrics";
import type { EffortReqVM, EffortVM } from "@/lib/views";
import { StageBar, StatusText } from "../common/bits";
import b from "../common/board.module.css";
import s from "./effort.module.css";
import { PendingPanel } from "./PendingPanel";
import { ReqPanel } from "./ReqPanel";
import { UploadDialog } from "./UploadDialog";

type FKey = "need" | ReqStatus;
const FKEYS: [FKey, string][] = [
  ["need", "확정 필요"],
  ["ING", "측정 중"],
  ["DONE", "측정 완료"],
  ["WAIT", "측정 대기"],
];

export function EffortBoard({ vm, me, today }: { vm: EffortVM; me: { userId: string; role: string }; today: string }) {
  const dev = me.role === "DEVELOPER";
  const [owner, setOwner] = useState("");
  const [prj, setPrj] = useState("");
  const [f, setF] = useState<Set<FKey>>(new Set(["need", "ING"]));
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [una, setUna] = useState(false);
  const [upload, setUpload] = useState(false);

  const owners = useMemo(() => {
    const m = new Map<string, string>();
    vm.reqs.forEach((r) => r.owners.forEach((o) => m.set(o.userId, o.userNm)));
    return Array.from(m).sort((a, c) => a[1].localeCompare(c[1]));
  }, [vm]);

  const needOf = (r: EffortReqVM) => r.owners.filter((o) => !owner || o.userId === owner).reduce((a, o) => a + o.need, 0);
  const base = vm.reqs.filter(
    (r) => (!owner || r.owners.some((o) => o.userId === owner)) && (!prj || (prj === "개발" || prj === "운영" ? r.kind === prj : r.prjId === prj)),
  );
  const hit = (r: EffortReqVM, k: FKey) => (k === "need" ? needOf(r) > 0 : r.status === k);
  const list = base.filter((r) => Array.from(f).some((k) => hit(r, k)));
  const pending = vm.pending.filter((p) => !owner || p.userId === owner);
  const prjOpts = Array.from(new Map(base.concat(vm.reqs).map((r) => [r.prjId, `${r.prjNm} · ${r.kind}`])));

  // 처음 열면 확정이 필요한 요구사항(없으면 첫 번째)을 펼쳐 둔다.
  useEffect(() => {
    if (sel.size || una || !list.length) return;
    setSel(new Set([(list.find((r) => needOf(r) > 0) ?? list[0]).reqId]));
  }, [list.length]);

  const shown = vm.reqs.filter((r) => sel.has(r.reqId));
  const toggleF = (k: FKey) => setF((x) => (x.has(k) ? new Set(Array.from(x).filter((y) => y !== k)) : new Set([...Array.from(x), k])));
  const pick = (id: string) => {
    setSel(new Set([id]));
    setUna(false);
  };
  const multi = (id: string, on: boolean) => setSel((x) => (on ? new Set([...Array.from(x), id]) : new Set(Array.from(x).filter((y) => y !== id))));

  return (
    <>
      <div className={b.head}>
        <div>
          <h1 className={b.title}>
            투입 공수 <span className="muted" style={{ fontWeight: 500, fontSize: 16 }}>· 입력 · 실적</span>
          </h1>
          <span className={b.note}>
            AI 도구 내 시간은 텔레메트리·업로드로 자동 수집 · 날마다 확인하고 AI 도구 외 시간을 더해 확정 · 확정한 값만 측정 결과에 들어갑니다
          </span>
        </div>
        {dev && (
          <div className={b.acts}>
            <Button icon="upload" onClick={() => setUpload(true)}>
              AI 사용 기록 올리기
            </Button>
          </div>
        )}
      </div>

      <div className={s.ef}>
        <aside className={s.lp} aria-label="요구사항 목록">
          <div className={s.box}>
            {!dev && (
              <label className={s.fl}>
                담당자
                <select className={b.sel} value={owner} onChange={(e) => (setOwner(e.target.value), setSel(new Set()))}>
                  <option value="">전체</option>
                  {owners.map(([id, nm]) => (
                    <option key={id} value={id}>
                      {nm}
                    </option>
                  ))}
                </select>
                <span className={b.pill}>조회 전용</span>
              </label>
            )}
            <label className={s.fl}>
              과제
              <select className={b.sel} value={prj} onChange={(e) => (setPrj(e.target.value), setSel(new Set()))}>
                <option value="">전체</option>
                <option value="개발">개발 과제 전체</option>
                <option value="운영">운영 과제 전체</option>
                {prjOpts.map(([id, nm]) => (
                  <option key={id} value={id}>
                    {nm}
                  </option>
                ))}
              </select>
            </label>
            <div className={s.cks}>
              {FKEYS.map(([k, l]) => (
                <label key={k}>
                  <input type="checkbox" checked={f.has(k)} onChange={() => toggleF(k)} />
                  {l} <span className="num muted">{base.filter((r) => hit(r, k)).length}</span>
                </label>
              ))}
            </div>
          </div>

          {pending.length ? (
            <button className={`${s.chk} ${una ? s.chkOn : ""}`} onClick={() => setUna((v) => !v)} aria-expanded={una}>
              <b>
                확인 필요 · 업무 코드 없이 잡힌 AI 사용 {pending.length}건 · {f1(pending.reduce((a, p) => a + p.minutes, 0) / 60)}h
              </b>
              <span className={b.small}>{dev ? "요구사항·단계에 배정하거나 업무 외 사용으로 표시해 주세요" : "개발자가 배정하거나 업무 외로 표시해야 합니다"}</span>
            </button>
          ) : (
            <div className={`${s.chk} ${s.chkNone}`}>
              <b>확인 필요 없음</b>
              <span className={b.xs}>업무 코드 없이 잡힌 AI 사용이 없습니다{vm.offCount ? ` · 업무 외 표시 ${vm.offCount}건` : ""}</span>
            </div>
          )}

          <div className={b.xs} style={{ display: "flex", justifyContent: "space-between" }}>
            <span>
              {dev ? "내 담당" : owner ? `${owners.find((o) => o[0] === owner)?.[1]} 담당` : "전체"} 요구사항 {list.length}건
            </span>
            <span>☐ 체크 = 함께 보기</span>
          </div>
          <div className={s.list}>
            {list.map((r) => {
              const need = needOf(r);
              const on = sel.has(r.reqId);
              return (
                <div
                  key={r.reqId}
                  className={`${s.rc} ${on ? s.rcSel : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={on}
                  onClick={() => pick(r.reqId)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), pick(r.reqId))}
                >
                  <input type="checkbox" checked={on} onClick={(e) => e.stopPropagation()} onChange={(e) => multi(r.reqId, e.target.checked)} aria-label={`${r.name} 함께 보기`} />
                  <div className={s.rcb}>
                    <div className={b.xs}>
                      {r.prjNm} <span className={b.pill}>{r.kind}</span>
                      {!dev && ` · ${r.owners.map((o) => o.userNm).join(", ")}`}
                    </div>
                    <div className={b.small}>
                      <b>{r.name}</b> <span className={b.mono} style={{ color: "var(--subtle)" }}>{r.reqId}</span>
                    </div>
                    <StageBar stages={r.stages} mine={dev ? me.userId : undefined} />
                    <div className={s.rcm}>
                      <StatusText s={r.status} />
                      {need > 0 && <span className={b.pillWarn}>확정 필요 {need}일</span>}
                      <span className={`${b.xs} num`} style={{ marginLeft: "auto" }}>
                        {f1(r.md)} / {f1(r.baseMd)} M/D
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {list.length === 0 && <p className="muted small">조건에 맞는 요구사항이 없습니다. 위 체크를 바꿔 보세요.</p>}
          </div>
        </aside>

        <section className={s.rp}>
          {una && <PendingPanel list={pending} readOnly={!dev} showUser={!dev} onClose={() => setUna(false)} />}
          {shown.map((r) => (
            <ReqPanel key={r.reqId} r={r} me={me} today={today} onClose={sel.size > 1 ? () => multi(r.reqId, false) : undefined} />
          ))}
          {!shown.length && !una && (
            <div className={s.panel}>
              <p className="muted">왼쪽에서 요구사항을 고르세요.</p>
            </div>
          )}
        </section>
      </div>

      {upload && <UploadDialog onClose={() => setUpload(false)} />}
    </>
  );
}
