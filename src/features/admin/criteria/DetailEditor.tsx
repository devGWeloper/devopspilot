"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/Tabs";
import { FIT_LABEL } from "@/lib/labels";
import type { Area, Criteria, Indicator, Level } from "@/lib/types";
import s from "./criteria.module.css";

const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

function move<T>(arr: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const out = [...arr];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export function DetailEditor({ criteria, onChange }: { criteria: Criteria; onChange: (c: Criteria) => void }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set([criteria.areas[0]?.id]));

  const setAreas = (areas: Area[]) => onChange({ ...criteria, areas });
  const setArea = (ai: number, patch: Partial<Area>) => setAreas(criteria.areas.map((a, i) => (i === ai ? { ...a, ...patch } : a)));
  const setInd = (ai: number, ii: number, patch: Partial<Indicator>) =>
    setArea(ai, { indicators: criteria.areas[ai].indicators.map((x, i) => (i === ii ? { ...x, ...patch } : x)) });

  function addIndicator(ai: number) {
    const ind: Indicator = {
      id: rid("ind"),
      name: "새 지표",
      description: "",
      tier: "MINOR",
      options: [
        { id: rid("opt"), label: "충족", level: "H" },
        { id: rid("opt"), label: "일부", level: "M" },
        { id: rid("opt"), label: "미충족", level: "L" },
      ],
    };
    setArea(ai, { indicators: [...criteria.areas[ai].indicators, ind] });
  }

  function addArea() {
    const a: Area = { id: rid("area"), name: "새 영역", question: "", indicators: [] };
    setAreas([...criteria.areas, a]);
    setOpen((x) => new Set([...x, a.id]));
  }

  return (
    <div className={s.detail}>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        지표를 삭제하면 그 지표에 대한 과제 응답은 게시·재판정 시 버려집니다. 선택지 수준(상·중·하)이 적합도 판정의 근거가 됩니다.
      </p>
      {criteria.areas.map((a, ai) => {
        const isOpen = open.has(a.id);
        return (
          <section key={a.id} className={s.areaBox}>
            <header className={s.areaHead}>
              <button className={s.areaToggle} onClick={() => setOpen((x) => new Set(isOpen ? [...x].filter((k) => k !== a.id) : [...x, a.id]))} aria-expanded={isOpen}>
                <Icon name={isOpen ? "chevronDown" : "chevronRight"} size={16} />
              </button>
              <TextInput value={a.name} onChange={(e) => setArea(ai, { name: e.target.value })} aria-label="영역 이름" className={s.areaName} />
              <TextInput value={a.question} onChange={(e) => setArea(ai, { question: e.target.value })} placeholder="영역 질문 (예: AI가 참고할 맥락이 있나)" aria-label="영역 질문" />
              <span className="subtle num" style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                지표 {a.indicators.length}
              </span>
              <div className={s.iconBtns}>
                <button onClick={() => setAreas(move(criteria.areas, ai, -1))} aria-label="영역 위로">
                  <Icon name="arrowUp" size={14} />
                </button>
                <button onClick={() => setAreas(move(criteria.areas, ai, 1))} aria-label="영역 아래로">
                  <Icon name="arrowDown" size={14} />
                </button>
                <button
                  onClick={() => confirm(`'${a.name}' 영역과 지표 ${a.indicators.length}개를 삭제할까요?`) && setAreas(criteria.areas.filter((_, i) => i !== ai))}
                  aria-label="영역 삭제"
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </header>
            {isOpen && (
              <div className={s.indBox}>
                {a.indicators.map((ind, ii) => (
                  <div key={ind.id} className={s.indCard}>
                    <div className={s.indTop}>
                      <TextInput value={ind.name} onChange={(e) => setInd(ai, ii, { name: e.target.value })} aria-label="지표 이름" className={s.indNameInput} />
                      <Segmented
                        ariaLabel="Major/Minor"
                        value={ind.tier}
                        onChange={(t) => setInd(ai, ii, { tier: t })}
                        options={[
                          { key: "MAJOR", label: "Major" },
                          { key: "MINOR", label: "Minor" },
                        ]}
                      />
                      <div className={s.iconBtns}>
                        <button onClick={() => setArea(ai, { indicators: move(a.indicators, ii, -1) })} aria-label="지표 위로">
                          <Icon name="arrowUp" size={14} />
                        </button>
                        <button onClick={() => setArea(ai, { indicators: move(a.indicators, ii, 1) })} aria-label="지표 아래로">
                          <Icon name="arrowDown" size={14} />
                        </button>
                        <button onClick={() => setArea(ai, { indicators: a.indicators.filter((_, i) => i !== ii) })} aria-label="지표 삭제">
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </div>
                    <TextInput value={ind.description} onChange={(e) => setInd(ai, ii, { description: e.target.value })} placeholder="지표 설명 — PM 이 응답할 때 보는 안내" aria-label="지표 설명" />
                    <div className={s.optList}>
                      {ind.options.map((o, oi) => (
                        <div key={o.id} className={s.optRow}>
                          <TextInput
                            value={o.label}
                            onChange={(e) => setInd(ai, ii, { options: ind.options.map((x, i) => (i === oi ? { ...x, label: e.target.value } : x)) })}
                            aria-label="선택지 이름"
                          />
                          <Segmented
                            ariaLabel="선택지 수준"
                            value={o.level}
                            onChange={(lv: Level) => setInd(ai, ii, { options: ind.options.map((x, i) => (i === oi ? { ...x, level: lv } : x)) })}
                            options={(["H", "M", "L"] as const).map((lv) => ({ key: lv, label: FIT_LABEL[lv] }))}
                          />
                          <TextInput
                            value={o.hint ?? ""}
                            onChange={(e) => setInd(ai, ii, { options: ind.options.map((x, i) => (i === oi ? { ...x, hint: e.target.value || undefined } : x)) })}
                            placeholder="설명(선택)"
                            aria-label="선택지 설명"
                          />
                          <div className={s.iconBtns}>
                            <button onClick={() => setInd(ai, ii, { options: move(ind.options, oi, -1) })} aria-label="선택지 위로">
                              <Icon name="arrowUp" size={13} />
                            </button>
                            <button onClick={() => setInd(ai, ii, { options: ind.options.filter((_, i) => i !== oi) })} aria-label="선택지 삭제" disabled={ind.options.length <= 2}>
                              <Icon name="x" size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <button className={s.addLink} onClick={() => setInd(ai, ii, { options: [...ind.options, { id: rid("opt"), label: "", level: "M" }] })}>
                        + 선택지 추가
                      </button>
                    </div>
                  </div>
                ))}
                <Button size="sm" icon="plus" onClick={() => addIndicator(ai)}>
                  지표 추가
                </Button>
              </div>
            )}
          </section>
        );
      })}
      <Button icon="plus" onClick={addArea}>
        영역 추가
      </Button>
    </div>
  );
}
