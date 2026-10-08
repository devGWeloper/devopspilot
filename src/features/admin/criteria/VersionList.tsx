"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Panel";
import { api } from "@/lib/apiClient";
import { useApi } from "@/lib/hooks";
import { FIT_COLOR, fmtDateTime } from "@/lib/labels";
import type { Criteria } from "@/lib/types";
import { ruleSentences } from "../../project-detail/RationaleTab";
import s from "./criteria.module.css";

interface Ver {
  version: number;
  publishedAt: string | null;
  publishedBy: string | null;
  indicators: number;
  majors: number;
}

export function VersionList() {
  const { data } = useApi<Ver[]>("/api/admin/criteria/versions");
  const [view, setView] = useState<Criteria | null>(null);

  if (!data) return <Skeleton h={80} />;
  return (
    <>
      <ul className={s.versions}>
        {data.map((v, i) => (
          <li key={v.version}>
            <button onClick={() => api<Criteria>(`/api/admin/criteria/versions?v=${v.version}`).then(setView)}>
              <b>v{v.version}</b>
              {i === 0 && <span className={s.current}>현재</span>}
              <span className="subtle">
                {fmtDateTime(v.publishedAt)} · {v.publishedBy ?? "—"}
              </span>
              <span className="muted num" style={{ fontSize: 12 }}>
                지표 {v.indicators} · Major {v.majors}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Modal open={!!view} wide title={`평가 기준 v${view?.version ?? ""}`} eyebrow="읽기 전용" onClose={() => setView(null)}>
        {view && (
          <div style={{ display: "grid", gap: 14 }}>
            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--muted)", fontSize: 13 }}>
              {ruleSentences(view).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            {view.areas.map((a) => (
              <div key={a.id}>
                <b>{a.name}</b> <span className="subtle">{a.question}</span>
                <ul className={s.verInds}>
                  {a.indicators.map((i) => (
                    <li key={i.id}>
                      <span style={{ fontWeight: i.tier === "MAJOR" ? 700 : 500 }}>
                        {i.name} {i.tier === "MAJOR" && <span className={s.majorTag}>MAJOR</span>}
                      </span>
                      <span className="muted" style={{ fontSize: 12.5 }}>
                        {i.options.map((o) => (
                          <span key={o.id} style={{ marginRight: 10 }}>
                            <span style={{ color: FIT_COLOR[o.level] }}>●</span> {o.label}
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
