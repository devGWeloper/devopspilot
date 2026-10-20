"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import c from "./coach.module.css";

type Side = "top" | "bottom" | "left" | "right";

export interface CoachStep {
  /** `[data-tour="…"]` 대상 — 여러 개면 화면에 있는 첫 번째 */
  target: string | string[];
  /** 몇 단어로 — 말풍선은 읽는 곳이 아니라 가리키는 곳 */
  text: string;
  /** 먼저 시도할 말풍선 위치 — 화면 밖이나 대상과 겹치면 다른 방향 */
  side: Side;
  /** 대상을 실제로 눌러 볼 수 있고, 누르면 다음 단계로 */
  live?: boolean;
  /** 처음 보는 사람에게 '왜'까지 알려야 하는 칸만 — 몇 줄 덧붙임 */
  more?: ReactNode;
}

type Box = { x: number; y: number; w: number; h: number };

const PAD = 6;
const GAP = 16;
const EDGE = 12;
const SIDES: Side[] = ["bottom", "top", "right", "left"];

function find(target: string | string[]) {
  for (const k of ([] as string[]).concat(target)) {
    const el = document.querySelector<HTMLElement>(`[data-tour="${k}"]`);
    if (el) return el;
  }
  return null;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
const fits = (b: Box, vw: number, vh: number) => b.x >= EDGE && b.y >= EDGE && b.x + b.w <= vw - EDGE && b.y + b.h <= vh - EDGE;

function bubbleAt(side: Side, h: Box, w: number, ht: number): Box {
  const cx = h.x + h.w / 2;
  const cy = h.y + h.h / 2;
  if (side === "top") return { x: cx - w / 2, y: h.y - GAP - ht, w, h: ht };
  if (side === "bottom") return { x: cx - w / 2, y: h.y + h.h + GAP, w, h: ht };
  if (side === "left") return { x: h.x - GAP - w, y: cy - ht / 2, w, h: ht };
  return { x: h.x + h.w + GAP, y: cy - ht / 2, w, h: ht };
}

/** 대상 윗부분이 이미 보이면 그대로 두고(긴 목록에서 화면이 튀지 않게), 아니면 가운데로 */
function reveal(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  if (r.top >= 70 && r.top <= window.innerHeight - 220) return;
  el.scrollIntoView({ block: r.height > window.innerHeight * 0.6 ? "start" : "center", behavior: "smooth" });
}

// 말풍선이 붙은 쪽의 반대 — 대상을 향하는 손짓
const TOWARD = { bottom: "arrowUp", top: "arrowDown", right: "chevronLeft", left: "chevronRight" } as const;

/**
 * 실제 화면 위에서 한 칸씩 짚어 주는 따라하기.
 * 짚은 칸은 덮지 않아 그대로 눌러 볼 수 있고(live), 지나간 칸에는 번호가 남아 끝나면 화면 한 장에 흐름이 다 보인다.
 * 위치는 열려 있는 동안 매 프레임 다시 잰다(스크롤·창 크기·데이터 갱신).
 */
export function Coach({
  open,
  title,
  steps,
  onClose,
  onDone,
  onHideToday,
}: {
  open: boolean;
  title: string;
  steps: CoachStep[];
  onClose: () => void;
  onDone: () => void;
  onHideToday: () => void;
}) {
  const [live, setLive] = useState<CoachStep[]>([]);
  const [i, setI] = useState(0);
  const [hole, setHole] = useState<Box | null>(null);
  const [marks, setMarks] = useState<(Box | null)[]>([]);
  const [bub, setBub] = useState<{ b: Box; side: Side; tail: number } | null>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const bubRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLive(steps.filter((s) => find(s.target)));
    setI(0);
  }, [open, steps]);

  const step = live[i];
  const total = live.length;
  const last = i === total - 1;
  const next = useCallback(() => (last ? onDone() : setI((v) => v + 1)), [last, onDone]);

  useEffect(() => {
    if (!open || !step) return;
    const el = find(step.target);
    if (el) reveal(el);
  }, [open, step]);

  // 짚은 칸을 직접 누르면 그 동작은 그대로 하고 다음 단계로
  useEffect(() => {
    if (!open || !step?.live) return;
    const el = find(step.target);
    if (!el) return;
    const on = () => setTimeout(next, 350);
    el.addEventListener("click", on);
    return () => el.removeEventListener("click", on);
  }, [open, step, next]);

  useEffect(() => {
    if (!open || !step) return;
    let raf = 0;
    let lastKey = "";
    const tick = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const box = (el: HTMLElement | null): Box | null => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        // 긴 목록은 화면에 보이는 부분만 뚫는다
        const y = Math.max(r.top - PAD, 0);
        const bottom = Math.min(r.bottom + PAD, vh);
        return bottom - y < 8 ? null : { x: r.left - PAD, y, w: r.width + PAD * 2, h: bottom - y };
      };
      const h = box(find(step.target));
      const done = live.slice(0, i).map((s) => box(find(s.target)));
      let b: { b: Box; side: Side; tail: number } | null = null;
      if (h) {
        const w = bubRef.current?.offsetWidth ?? 280;
        const ht = bubRef.current?.offsetHeight ?? 110;
        const order = [step.side, ...SIDES.filter((s) => s !== step.side)];
        const side = order.find((s) => fits(bubbleAt(s, h, w, ht), vw, vh)) ?? step.side;
        const raw = bubbleAt(side, h, w, ht);
        const bx = { ...raw, x: clamp(raw.x, EDGE, vw - w - EDGE), y: clamp(raw.y, EDGE, vh - ht - EDGE) };
        // 말풍선이 밀려나도 꼬리는 대상 가운데를 가리키게
        const tail = side === "top" || side === "bottom" ? clamp(h.x + h.w / 2 - bx.x, 20, w - 20) : clamp(h.y + h.h / 2 - bx.y, 20, ht - 20);
        b = { b: bx, side, tail };
      }
      const key = JSON.stringify([vw, vh, h, done, b]);
      if (key !== lastKey) {
        lastKey = key;
        setVp({ w: vw, h: vh });
        setHole(h);
        setMarks(done);
        setBub(b);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [open, step, live, i]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, next, onClose]);

  if (!open || !step) return null;
  const H = hole ?? { x: vp.w / 2, y: vp.h / 2, w: 0, h: 0 };

  const bar = (
    <div className={c.bar}>
      <b>{title}</b>
      <span className={c.prog}>
        {Array.from({ length: total }, (_, k) => (
          <button key={k} className={`${c.seg} ${k < i ? c.segDone : k === i ? c.segOn : ""}`} onClick={() => setI(k)} aria-label={`${k + 1}단계`} />
        ))}
      </span>
      <span className={c.count}>
        {i + 1}/{total}
      </span>
      <button className={c.link} onClick={onHideToday}>
        오늘 하루 보지 않기
      </button>
      <button className={c.x} aria-label="닫기" onClick={onClose}>
        <Icon name="x" size={16} />
      </button>
    </div>
  );

  return createPortal(
    <div className={c.root} role="dialog" aria-label={title}>
      {/* 네 조각으로 어둡게 덮어 가운데 칸은 실제로 눌린다 */}
      <div className={c.dim} style={{ left: 0, top: 0, width: vp.w, height: H.y }} />
      <div className={c.dim} style={{ left: 0, top: H.y + H.h, width: vp.w, height: Math.max(0, vp.h - H.y - H.h) }} />
      <div className={c.dim} style={{ left: 0, top: H.y, width: H.x, height: H.h }} />
      <div className={c.dim} style={{ left: H.x + H.w, top: H.y, width: Math.max(0, vp.w - H.x - H.w), height: H.h }} />

      {hole && (
        <div className={`${c.ring} ${step.live ? c.ringLive : ""}`} style={{ left: H.x, top: H.y, width: H.w, height: H.h }}>
          {!step.live && <div className={c.block} />}
        </div>
      )}

      {marks.map((m, k) =>
        m ? (
          <span key={k} className={c.done} style={{ left: m.x - 10, top: m.y - 10 }} title={live[k].text}>
            <Icon name="check" size={12} stroke={3} />
          </span>
        ) : null,
      )}

      {hole && (
        <span className={c.badge} style={{ left: H.x - 13, top: H.y - 13 }}>
          {i + 1}
        </span>
      )}

      <div
        key={i}
        ref={bubRef}
        className={`${c.bubble} ${step.more ? c.wide : ""} ${bub ? c[bub.side] : c.measure}`}
        style={bub ? { left: bub.b.x, top: bub.b.y, ["--tail" as string]: `${bub.tail}px` } : undefined}
      >
        <p className={c.say}>{step.text}</p>
        {step.more && <div className={c.more}>{step.more}</div>}
        <div className={c.row}>
          {step.live ? (
            <span className={c.try}>
              <span className={c.hand}>
                <Icon name={TOWARD[bub?.side ?? "bottom"]} size={13} stroke={2.5} />
              </span>
              눌러 보세요
            </span>
          ) : (
            <span />
          )}
          <button className={c.next} onClick={next}>
            {last ? "끝" : "다음"}
            {!last && <Icon name="chevronRight" size={14} />}
          </button>
        </div>
      </div>

      {bar}
    </div>,
    document.body,
  );
}

const KEY = (id: string) => `poc.tour.${id}`;

/**
 * 자동으로 띄울지 기억한다 — 끝까지 한 사람은 다시 띄우지 않고, '오늘 하루 보지 않기'는 그날만.
 * 브라우저 저장소가 막혀 있어도 화면은 돌아가야 하므로 실패하면 그냥 띄운다.
 */
export function useCoach(id: string, today: string, auto: boolean) {
  const [open, setOpen] = useState(false);
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY(id)) ?? "{}") as { done?: boolean; hideOn?: string };
    } catch {
      return {};
    }
  };
  const write = (v: { done?: boolean; hideOn?: string }) => {
    try {
      localStorage.setItem(KEY(id), JSON.stringify({ ...read(), ...v }));
    } catch {
      /* 저장소를 못 쓰면 다음에 다시 뜰 뿐 */
    }
  };

  useEffect(() => {
    if (!auto) return;
    const v = read();
    if (v.done || v.hideOn === today) return;
    // 화면이 다 그려진 뒤 대상 위치를 재야 한다.
    const h = setTimeout(() => setOpen(true), 400);
    return () => clearTimeout(h);
  }, [auto, today]);

  return {
    open,
    toggle: () => setOpen((v) => !v),
    close: () => setOpen(false),
    done: () => (write({ done: true }), setOpen(false)),
    hideToday: () => (write({ hideOn: today }), setOpen(false)),
  };
}
