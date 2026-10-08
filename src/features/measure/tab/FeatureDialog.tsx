"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Select, TextInput, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { api, errMessage } from "@/lib/apiClient";
import { useApi } from "@/lib/hooks";
import { FEATURE_STATUS_LABEL, PHASE_LABEL, PHASES, type Feature, type FeatureStatus, type MeasureSettings, type Phase } from "@/lib/measure/types";

const EMPTY: Feature = {
  prjId: "",
  wbsId: "",
  name: "",
  typeCd: "",
  devUserId: null,
  devUserNm: null,
  status: "WAIT",
  completedAt: null,
  baseline: { DESIGN: 0, DEV: 0, UNIT: 0, INTEG: 0, defects: 0, evidence: "", evidenceVerified: false },
  note: "",
};

export function FeatureDialog({
  prjId,
  feature,
  settings,
  readOnly,
  onClose,
  onSaved,
}: {
  prjId: string;
  feature: Feature | null;
  settings: MeasureSettings;
  readOnly: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast, toastError } = useToast();
  const { data: devs } = useApi<{ userId: string; userNm: string }[]>("/api/users/options?role=DEVELOPER");
  const isNew = !feature;
  const [f, setF] = useState<Feature>(feature ?? { ...EMPTY, prjId, typeCd: settings.featureTypes[0]?.code ?? "" });
  const [unit, setUnit] = useState<"h" | "MD">("h");
  const [busy, setBusy] = useState(false);
  const mul = unit === "MD" ? settings.mdHours : 1;
  const phases = PHASES.filter((p) => settings.phases[p]);
  const [vals, setVals] = useState<Record<Phase, string>>(() => Object.fromEntries(PHASES.map((p) => [p, String(f.baseline[p] || "")])) as Record<Phase, string>);

  function switchUnit(u: "h" | "MD") {
    const factor = u === "MD" ? 1 / settings.mdHours : settings.mdHours;
    setVals((v) => Object.fromEntries(PHASES.map((p) => [p, v[p] ? String(Math.round(Number(v[p]) * factor * 100) / 100) : ""])) as Record<Phase, string>);
    setUnit(u);
  }

  const totalH = phases.reduce((s, p) => s + (Number(vals[p]) || 0) * mul, 0);

  async function save() {
    setBusy(true);
    try {
      const baseline = { ...f.baseline, ...Object.fromEntries(PHASES.map((p) => [p, Number(vals[p]) || 0])) };
      await api(`/api/measure/${prjId}/features`, { body: { feature: { ...f, baseline }, unit } });
      toast(isNew ? `기능 ${f.wbsId} 을(를) 등록했습니다.` : "저장했습니다.");
      onSaved();
    } catch (e) {
      toastError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const set = (patch: Partial<Feature>) => setF((x) => ({ ...x, ...patch }));

  return (
    <Modal
      open
      wide
      eyebrow={isNew ? "New feature" : f.wbsId}
      title={isNew ? "기능 등록 · 기존 실적(A)" : readOnly ? f.name : "기능 · 기존 실적(A) 수정"}
      onClose={onClose}
      footer={
        readOnly ? (
          <Button onClick={onClose}>닫기</Button>
        ) : (
          <>
            <Button onClick={onClose}>취소</Button>
            <Button variant="primary" loading={busy} disabled={!f.wbsId.trim() || !f.name.trim()} onClick={save}>
              저장
            </Button>
          </>
        )
      }
    >
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 180px", gap: 12 }}>
          <Field label="WBS-ID" required hint="과제 안에서 유일">
            <TextInput value={f.wbsId} disabled={!isNew || readOnly} onChange={(e) => set({ wbsId: e.target.value.trim() })} placeholder="WBS-3.2.1" />
          </Field>
          <Field label="기능명" required>
            <TextInput value={f.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="유형" required>
            <Select value={f.typeCd} onChange={(e) => set({ typeCd: e.target.value })}>
              {settings.featureTypes.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="담당 개발자">
            <Select value={f.devUserId ?? ""} onChange={(e) => set({ devUserId: e.target.value || null })}>
              <option value="">미지정</option>
              {devs?.map((d) => (
                <option key={d.userId} value={d.userId}>
                  {d.userNm} ({d.userId})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="상태">
            <Select value={f.status} onChange={(e) => set({ status: e.target.value as FeatureStatus })}>
              {(["WAIT", "DOING", "DONE"] as const).map((s) => (
                <option key={s} value={s}>
                  {FEATURE_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="완료일">
            <TextInput type="date" value={f.completedAt ?? ""} disabled={f.status !== "DONE" || readOnly} onChange={(e) => set({ completedAt: e.target.value || null })} />
          </Field>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span className="eyebrow">기존 실적 A — 단계별 투입 공수</span>
            <Segmented ariaLabel="입력 단위" value={unit} onChange={switchUnit} options={[{ key: "h", label: "시간(h)" }, { key: "MD", label: `MD (1MD=${settings.mdHours}h)` }]} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${phases.length + 1}, 1fr)`, gap: 10, alignItems: "end" }}>
            {phases.map((p) => (
              <Field key={p} label={PHASE_LABEL[p]}>
                <TextInput inputMode="decimal" value={vals[p]} onChange={(e) => setVals((v) => ({ ...v, [p]: e.target.value.replace(/[^0-9.]/g, "") }))} />
              </Field>
            ))}
            <div style={{ paddingBottom: 9 }}>
              <span className="muted">합계 </span>
              <b className="num" style={{ fontSize: 18 }}>
                {Math.round(totalH * 10) / 10}h
              </b>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12 }}>
          <Field label="당시 결함 수" hint="당시 테스트케이스 기준">
            <TextInput type="number" min={0} value={f.baseline.defects} onChange={(e) => set({ baseline: { ...f.baseline, defects: Math.max(0, Math.floor(Number(e.target.value) || 0)) } })} />
          </Field>
          <Field label="근거 (WBS·ActionItem 링크 또는 메모)">
            <Textarea rows={2} value={f.baseline.evidence} onChange={(e) => set({ baseline: { ...f.baseline, evidence: e.target.value } })} />
          </Field>
        </div>
        <Checkbox
          label="근거 확인 완료 — 계획값이 아닌 실제 투입 실적임을 확인했습니다"
          checked={f.baseline.evidenceVerified}
          onChange={(e) => set({ baseline: { ...f.baseline, evidenceVerified: e.target.checked } })}
        />
      </fieldset>
    </Modal>
  );
}
