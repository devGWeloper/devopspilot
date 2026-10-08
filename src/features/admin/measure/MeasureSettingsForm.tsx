"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, TextInput } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Callout, Panel, Skeleton } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { api, errMessage } from "@/lib/apiClient";
import { useApi } from "@/lib/hooks";
import { PHASE_LABEL, PHASES, type MeasureSettings, type TokenPrice } from "@/lib/measure/types";
import s from "./measureSettings.module.css";

const n = (v: string) => (v.trim() === "" ? 0 : Number(v));

export function MeasureSettingsForm() {
  const { toast, toastError } = useToast();
  const { data, error } = useApi<MeasureSettings>("/api/admin/measure-settings");
  const [st, setSt] = useState<MeasureSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setSt(data);
  }, [data]);

  if (error) return <Callout tone="danger">{error}</Callout>;
  if (!st) return <Skeleton h={400} />;

  const set = (patch: Partial<MeasureSettings>) => {
    setSt({ ...st, ...patch });
    setDirty(true);
  };
  const setPrice = (i: number, patch: Partial<TokenPrice>) => set({ tokenPrices: st.tokenPrices.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  async function save() {
    setBusy(true);
    try {
      setSt(await api<MeasureSettings>("/api/admin/measure-settings", { method: "PUT", body: st }));
      setDirty(false);
      toast("측정 설정을 저장했습니다. 모든 지표가 새 값으로 다시 계산됩니다.");
    } catch (e) {
      toastError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Measurement settings"
        title="측정 설정"
        description="단가·판정 기간 등 지표 계산에 쓰는 값입니다. 저장하면 대시보드와 내보내기가 즉시 새 값으로 계산됩니다."
        actions={
          <Button variant="primary" loading={busy} disabled={!dirty} onClick={save}>
            저장
          </Button>
        }
      />
      {st.sampleValues && (
        <div style={{ marginBottom: 16 }}>
          <Callout tone="warn">현재 단가는 데모용 예시값입니다. 사내 기준으로 확인해 저장해 주세요.</Callout>
        </div>
      )}
      <div className={s.grid}>
        <Panel eyebrow="Cost" title="단가">
          <div style={{ display: "grid", gap: 16 }}>
            <Field label="인건비 시간당 단가 (원)" hint="전 과제 공통 단일 값">
              <TextInput type="number" min={0} value={st.laborRatePerHour} onChange={(e) => set({ laborRatePerHour: n(e.target.value) })} />
            </Field>
            <div>
              <span className="eyebrow">모델별 토큰 단가 (원 / 100만 토큰)</span>
              <table className={s.prices}>
                <thead>
                  <tr>
                    <th>모델명 (로그의 model 값과 같게)</th>
                    <th>입력</th>
                    <th>출력</th>
                    <th>캐시 읽기</th>
                    <th>캐시 쓰기</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {st.tokenPrices.map((p, i) => (
                    <tr key={i}>
                      <td>
                        <TextInput value={p.model} onChange={(e) => setPrice(i, { model: e.target.value })} />
                      </td>
                      {(["input", "output", "cacheRead", "cacheWrite"] as const).map((k) => (
                        <td key={k}>
                          <TextInput type="number" min={0} value={p[k]} onChange={(e) => setPrice(i, { [k]: n(e.target.value) })} />
                        </td>
                      ))}
                      <td>
                        <button className={s.del} onClick={() => set({ tokenPrices: st.tokenPrices.filter((_, j) => j !== i) })} aria-label="삭제">
                          <Icon name="trash" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className={s.add} onClick={() => set({ tokenPrices: [...st.tokenPrices, { model: "", input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }] })}>
                + 모델 추가
              </button>
            </div>
          </div>
        </Panel>

        <Panel eyebrow="Rules" title="판정 기준">
          <div style={{ display: "grid", gap: 16 }}>
            <Field label="측정 단계" hint="요구분석·고객협의는 비교에서 제외. 통합테스트는 재현 가능한 경우만 포함하세요.">
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                {PHASES.map((p) => (
                  <Checkbox key={p} label={PHASE_LABEL[p]} checked={st.phases[p]} onChange={(e) => set({ phases: { ...st.phases, [p]: e.target.checked } })} />
                ))}
              </div>
            </Field>
            <div className={s.row3}>
              <Field label="사후 수정 판정 기간 (일)">
                <TextInput type="number" min={0} value={st.postFixDays} onChange={(e) => set({ postFixDays: n(e.target.value) })} />
              </Field>
              <Field label="교차 검증 허용 오차 (일)">
                <TextInput type="number" min={0} value={st.crossCheckToleranceDays} onChange={(e) => set({ crossCheckToleranceDays: n(e.target.value) })} />
              </Field>
              <Field label="미입력 경고 (일)">
                <TextInput type="number" min={0} value={st.idleAlertDays} onChange={(e) => set({ idleAlertDays: n(e.target.value) })} />
              </Field>
            </div>
            <div className={s.row3}>
              <Field label="1MD 환산 (h)">
                <TextInput type="number" min={1} value={st.mdHours} onChange={(e) => set({ mdHours: n(e.target.value) })} />
              </Field>
              <Field label="규모 S 상한 (h)" hint="S < 이 값 ≤ M">
                <TextInput type="number" min={0} value={st.sizeBands.S} onChange={(e) => set({ sizeBands: { ...st.sizeBands, S: n(e.target.value) } })} />
              </Field>
              <Field label="규모 M 상한 (h)" hint="M < 이 값 ≤ L">
                <TextInput type="number" min={0} value={st.sizeBands.M} onChange={(e) => set({ sizeBands: { ...st.sizeBands, M: n(e.target.value) } })} />
              </Field>
            </div>
            <Field label="WBS-ID 정규식" hint="커밋 메시지·브랜치명에서 WBS-ID 를 찾을 때 사용">
              <TextInput value={st.wbsPattern} onChange={(e) => set({ wbsPattern: e.target.value })} style={{ fontFamily: "ui-monospace, Consolas, monospace" }} />
            </Field>
          </div>
        </Panel>

        <Panel eyebrow="Codes" title="기능 유형 코드">
          <table className={s.prices}>
            <thead>
              <tr>
                <th style={{ width: 140 }}>코드</th>
                <th>이름</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {st.featureTypes.map((t, i) => (
                <tr key={i}>
                  <td>
                    <TextInput value={t.code} disabled={!!data?.featureTypes.some((x) => x.code === t.code)} onChange={(e) => set({ featureTypes: st.featureTypes.map((x, j) => (j === i ? { ...x, code: e.target.value.toUpperCase() } : x)) })} />
                  </td>
                  <td>
                    <TextInput value={t.label} onChange={(e) => set({ featureTypes: st.featureTypes.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                  </td>
                  <td>
                    <button className={s.del} onClick={() => set({ featureTypes: st.featureTypes.filter((_, j) => j !== i) })} aria-label="삭제">
                      <Icon name="trash" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className={s.add} onClick={() => set({ featureTypes: [...st.featureTypes, { code: "", label: "" }] })}>
            + 유형 추가
          </button>
        </Panel>
      </div>
    </>
  );
}
