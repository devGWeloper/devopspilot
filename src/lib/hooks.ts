"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./apiClient";
import type { Codes, Criteria } from "./types";

export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!url);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    if (!url) return;
    const my = ++seq.current;
    setLoading(true);
    try {
      const d = await api<T>(url);
      if (my === seq.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (my === seq.current) setError(e instanceof Error ? e.message : "불러오지 못했습니다.");
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, setData, error, loading, reload };
}

// 기준·코드는 여러 화면이 동시에 쓰므로 한 번만 받아 공유한다. 기준이 게시되면 invalidateRefs() 로 비운다.
let critCache: Promise<Criteria> | null = null;
let codesCache: Promise<Codes> | null = null;

export function invalidateRefs() {
  critCache = null;
  codesCache = null;
}

export function useRefs() {
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const [codes, setCodes] = useState<Codes | null>(null);
  useEffect(() => {
    critCache ??= api<Criteria>("/api/criteria").catch((e) => {
      critCache = null;
      throw e;
    });
    codesCache ??= api<Codes>("/api/codes").catch((e) => {
      codesCache = null;
      throw e;
    });
    let alive = true;
    critCache.then((c) => alive && setCriteria(c)).catch(() => undefined);
    codesCache.then((c) => alive && setCodes(c)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return { criteria, codes };
}

export function labelOf(list: { code: string; label: string }[] | undefined, code: string | null | undefined): string {
  if (!code) return "—";
  return list?.find((x) => x.code === code)?.label ?? code;
}

export function optionLabel(c: Criteria | null, indicatorId: string, optionId: string | null | undefined): string {
  if (!c || !optionId) return "—";
  for (const a of c.areas) for (const i of a.indicators) if (i.id === indicatorId) return i.options.find((o) => o.id === optionId)?.label ?? optionId;
  return optionId;
}
