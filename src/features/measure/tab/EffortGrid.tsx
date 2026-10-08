"use client";

import { Fragment, useRef, useState, type KeyboardEvent } from "react";
import type { Me } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import { api, errMessage } from "@/lib/apiClient";
import { can } from "@/lib/auth/permissions";
import { hours, pct } from "@/lib/format";
import { kstDate } from "@/lib/measure/csv";
import { PHASE_LABEL, PHASES, type Feature, type FeatureMetric, type Phase } from "@/lib/measure/types";
import { FeatureDialog } from "./FeatureDialog";
import type { MeasureData } from "./MeasureTab";
import s from "./tab.module.css";

const SHORT: Record<Phase, string> = { DESIGN: "설계 h", DEV: "개발 h", UNIT: "테스트 h", INTEG: "통합 h" };

export function EffortGrid({ data, me, onChanged }: { data: MeasureData; me: Me; onChanged: () => void }) {
  const { toastError, toast } = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ feature: Feature | null } | null>(null);
  const cells = useRef<Map<string, HTMLElement>>(new Map());

  const p = data.project;
  const st = data.input.settings;
  const phases = PHASES.filter((ph) => st.phases[ph]);
  const canPl = can(me, "measure.feature", { project: p });
  const types = Object.fromEntries(st.featureTypes.map((t) => [t.code, t.label]));
  const rows = data.metrics.byFeature;
  const total = data.metrics.overall;
  const cellKey = (wbsId: string, ph: Phase | "DONE") => `${wbsId}|${ph}`;
  const order = rows.flatMap((r) => [...phases, "DONE" as const].map((ph) => cellKey(r.feature.wbsId, ph)));
  const canDev = (f: Feature) => can(me, "measure.effort", { project: p, feature: f });

  function start(k: string, value: string) {
    setEditing(k);
    setDraft(value);
    setFailed(null);
  }

  async function commit(fm: FeatureMetric, ph: Phase | "DONE", value: string) {
    const k = cellKey(fm.feature.wbsId, ph);
    setEditing(null);
    if (ph === "DONE") {
      if (!value || value === fm.feature.completedAt) return;
      setSaving(k);
      try {
        await api("/api/measure/today", { body: { date: value, items: [], completes: [{ prjId: p.prjId, wbsId: fm.feature.wbsId }] } });
        toast(`${fm.feature.wbsId} 완료일 ${value}`);
        onChanged();
      } catch (e) {
        setFailed(k);
        toastError(errMessage(e));
      } finally {
        setSaving(null);
      }
      return;
    }
    const n = value.trim() === "" ? 0 : Number(value);
    if (!Number.isFinite(n) || n < 0) {
      setFailed(k);
      toastError("0 이상의 숫자를 입력해 주세요.");
      return;
    }
    if (Math.abs(n - fm.bByPhase[ph]) < 0.001) return;
    setSaving(k);
    try {
      const r = await api<{ adjustment: number }>(`/api/measure/${p.prjId}/grid`, { method: "PUT", body: { wbsId: fm.feature.wbsId, phase: ph, hours: n } });
      toast(`${fm.feature.wbsId} ${PHASE_LABEL[ph]} ${hours(n)} (오늘자 보정 ${r.adjustment > 0 ? "+" : ""}${r.adjustment}h)`);
      onChanged();
    } catch (e) {
      setFailed(k);
      toastError(errMessage(e));
    } finally {
      setSaving(null);
    }
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>, fm: FeatureMetric, ph: Phase | "DONE") {
    const k = cellKey(fm.feature.wbsId, ph);
    if (e.key === "Escape") {
      setEditing(null);
      cells.current.get(k)?.focus();
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      void commit(fm, ph, draft);
      const i = order.indexOf(k) + (e.shiftKey ? -1 : 1);
      const next = order[i];
      if (next && e.key === "Tab") setTimeout(() => cells.current.get(next)?.focus(), 0);
    }
  }

  function phaseCell(fm: FeatureMetric, ph: Phase) {
    const k = cellKey(fm.feature.wbsId, ph);
    const editable = canDev(fm.feature);
    if (editing === k) {
      return (
        <td className={`${s.dev} ${s.editingCell}`}>
          <input autoFocus className={s.cellInput} inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ""))} onKeyDown={(e) => onKey(e, fm, ph)} onBlur={() => commit(fm, ph, draft)} aria-label={`${fm.feature.wbsId} ${PHASE_LABEL[ph]}`} />
        </td>
      );
    }
    return (
      <td
        className={`${s.dev} ${s.r} num ${editable ? s.editable : ""} ${failed === k ? s.failed : ""}`}
        tabIndex={editable ? 0 : -1}
        ref={(el) => {
          if (el) cells.current.set(k, el);
        }}
        onClick={() => editable && start(k, String(fm.bByPhase[ph] || ""))}
        onKeyDown={(e) => editable && (e.key === "Enter" || /^[0-9.]$/.test(e.key)) && start(k, /^[0-9.]$/.test(e.key) ? e.key : String(fm.bByPhase[ph] || ""))}
        title={editable ? "클릭하거나 Enter 로 수정" : undefined}
      >
        {saving === k ? <span className={s.spin} /> : fm.bByPhase[ph] ? fm.bByPhase[ph].toLocaleString() : <span className="subtle">·</span>}
      </td>
    );
  }

  function doneCell(fm: FeatureMetric) {
    const k = cellKey(fm.feature.wbsId, "DONE");
    const editable = canDev(fm.feature);
    if (editing === k) {
      return (
        <td className={`${s.dev} ${s.editingCell}`}>
          <input autoFocus type="date" max={kstDate(Date.now())} className={s.cellInput} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => onKey(e, fm, "DONE")} onBlur={() => commit(fm, "DONE", draft)} aria-label={`${fm.feature.wbsId} 완료일`} />
        </td>
      );
    }
    return (
      <td
        className={`${s.dev} num ${editable ? s.editable : ""}`}
        tabIndex={editable ? 0 : -1}
        ref={(el) => {
          if (el) cells.current.set(k, el);
        }}
        onClick={() => editable && start(k, fm.feature.completedAt ?? kstDate(Date.now()))}
        onKeyDown={(e) => editable && e.key === "Enter" && start(k, fm.feature.completedAt ?? kstDate(Date.now()))}
      >
        {saving === k ? <span className={s.spin} /> : fm.feature.completedAt ?? <span className="subtle">{fm.feature.status === "DOING" ? "진행" : "대기"}</span>}
      </td>
    );
  }

  return (
    <>
      <div className={s.gridWrap}>
        <table className={s.grid}>
          <thead>
            <tr className={s.band}>
              <th colSpan={4} className={s.bandPl}>PL 사전 기입</th>
              <th colSpan={phases.length + 1} className={s.bandDev}>개발자 기입</th>
              <th colSpan={2} className={s.bandAuto}>자동 계산</th>
            </tr>
            <tr>
              <th className={s.pl}>WBS-ID</th>
              <th className={s.pl}>기능명</th>
              <th className={s.pl}>유형</th>
              <th className={`${s.pl} ${s.r}`}>기존 실적 A</th>
              {phases.map((ph) => (
                <th key={ph} className={`${s.dev} ${s.r}`}>
                  {SHORT[ph]}
                </th>
              ))}
              <th className={s.dev}>완료일</th>
              <th className={`${s.auto} ${s.r}`}>Replay B</th>
              <th className={`${s.auto} ${s.r}`}>절감률</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((fm) => (
              <tr key={fm.feature.wbsId}>
                <td className={`${s.pl} num`}>
                  <button className={s.linkBtn} onClick={() => setDialog({ feature: fm.feature })} title="기능·기존 실적 보기">
                    {fm.feature.wbsId}
                  </button>
                </td>
                <td className={s.pl}>
                  <span className={s.fname}>{fm.feature.name}</span>
                  <span className="subtle" style={{ fontSize: 11.5 }}>
                    {fm.feature.devUserNm ?? "담당 미지정"}
                  </span>
                </td>
                <td className={s.pl}>{types[fm.feature.typeCd] ?? fm.feature.typeCd}</td>
                <td className={`${s.pl} ${s.r} num`}>
                  <button className={s.linkBtn} onClick={() => setDialog({ feature: fm.feature })}>
                    {hours(fm.a)}
                  </button>
                  {!fm.feature.baseline.evidenceVerified && <span className={s.unverified} title="근거 확인 전">!</span>}
                </td>
                {phases.map((ph) => (
                  <Fragment key={ph}>{phaseCell(fm, ph)}</Fragment>
                ))}
                {doneCell(fm)}
                <td className={`${s.auto} ${s.r} num`}>
                  <b>{hours(fm.b)}</b>
                </td>
                <td className={`${s.auto} ${s.r}`}>
                  <span className={s.saving}>
                    <span className={s.savingBar}>
                      <span style={{ width: `${Math.max(0, Math.min(100, (fm.savingRate ?? 0) * 100))}%` }} />
                    </span>
                    <b className="num">{pct(fm.savingRate)}</b>
                  </span>
                </td>
              </tr>
            ))}
            {canPl && (
              <tr className={s.addRow}>
                <td colSpan={phases.length + 7}>
                  <button className={s.linkBtn} onClick={() => setDialog({ feature: null })}>
                    + 기능 추가
                  </button>
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>
                완료 기능 합계 <span className="subtle">({total.doneCount}/{total.featureCount})</span>
              </td>
              <td className={`${s.r} num`}>{hours(total.sumA)}</td>
              {phases.map((ph) => (
                <td key={ph} className={`${s.r} num`}>
                  {hours(rows.filter((r) => r.feature.status === "DONE").reduce((a, r) => a + r.bByPhase[ph], 0))}
                </td>
              ))}
              <td />
              <td className={`${s.r} num`}>{hours(total.sumB)}</td>
              <td className={`${s.r} num`}>
                <b>{pct(total.savingRate)}</b>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className={s.gridNote}>
        단계 시간을 여기서 바꾸면 개발자의 일별 기록은 그대로 두고, 차이만큼 오늘자 보정 기록이 남습니다. 절감률 = (A − B) ÷ A.
      </p>
      {dialog && (
        <FeatureDialog
          prjId={p.prjId}
          feature={dialog.feature}
          settings={st}
          readOnly={!canPl}
          onClose={() => setDialog(null)}
          onSaved={() => (setDialog(null), onChanged())}
        />
      )}
    </>
  );
}
