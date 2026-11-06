"use client";

import { useEffect, useRef, useState } from "react";
import { formatMarketCap, formatPrice } from "@/lib/format";
import type { MemeToken, MemesApiResponse } from "@/lib/types";

function Avatar({
  src,
  symbol,
  sizeClass = "avatar",
}: {
  src: string | null;
  symbol: string;
  sizeClass?: string;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={sizeClass} src={src} alt="" />;
  }
  return (
    <div className={`${sizeClass} fallback`} aria-hidden>
      {(symbol || "?").slice(0, 3)}
    </div>
  );
}

export function ListScreen({
  loading,
  error,
  data,
  onRefresh,
  onOpen,
}: {
  loading: boolean;
  error: string | null;
  data: MemesApiResponse | null;
  onRefresh: () => void;
  onOpen: (t: MemeToken) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const tokens = data?.tokens ?? [];

  useEffect(() => {
    setIndex(0);
    trackRef.current?.scrollTo({ left: 0 });
  }, [data?.fetchedAt]);

  function onScroll() {
    const el = trackRef.current;
    if (!el || tokens.length === 0) return;
    const card = el.querySelector(".swipe-card") as HTMLElement | null;
    if (!card) return;
    const gap = 12;
    const w = card.offsetWidth + gap;
    const i = Math.round(el.scrollLeft / w);
    setIndex(Math.max(0, Math.min(tokens.length - 1, i)));
  }

  function jumpTo(i: number) {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector(".swipe-card") as HTMLElement | null;
    if (!card) return;
    const gap = 12;
    el.scrollTo({ left: i * (card.offsetWidth + gap), behavior: "smooth" });
    setIndex(i);
  }

  return (
    <div className="wallet-section">
      <div className="section-title">Live meme swipe</div>
      {error && (
        <div className="error">
          {error}{" "}
          <button type="button" className="btn btn-ghost" onClick={onRefresh}>
            Retry
          </button>
        </div>
      )}
      {loading && !data && <div className="loading">Loading live listings…</div>}
      {data && (
        <>
          <div className="card" style={{ padding: 10, marginBottom: 12 }}>
            <div className="small muted">
              {data.disclaimer}
              <br />
              Coverage: {data.coverage.priced}/{data.coverage.listed} priced ·{" "}
              {data.coverage.unpriced} unpriced · swipe to browse · tap card to
              paper-buy prompt
            </div>
          </div>

          <div className="swipe-meta">
            <div className="swipe-counter">
              {tokens.length ? index + 1 : 0}/{tokens.length}
            </div>
            <div className="swipe-dots" aria-hidden>
              {tokens.slice(0, 12).map((_, i) => (
                <span key={i} className={i === Math.min(index, 11) ? "on" : ""} />
              ))}
            </div>
          </div>

          <div className="swipe-wrap">
            <div
              className="swipe-track"
              ref={trackRef}
              onScroll={onScroll}
              role="list"
              aria-label="Swipeable live memes"
            >
              {tokens.map((t) => (
                <button
                  key={t.address}
                  type="button"
                  className="swipe-card"
                  role="listitem"
                  onClick={() => onOpen(t)}
                >
                  <div className="hero">
                    <Avatar src={t.iconUrl} symbol={t.symbol} />
                    <div className="name">{t.name}</div>
                    <div className="sym">
                      ${t.symbol}
                      {t.dexId ? ` · ${t.dexId}` : ""}
                    </div>
                    {!t.priced && <span className="badge">Unpriced</span>}
                  </div>
                  <div className="swipe-stats">
                    <div className="stat">
                      <div className="label">Price (est.)</div>
                      <div className="value">
                        {t.priced ? formatPrice(t.priceUsd) : "—"}
                      </div>
                    </div>
                    <div className="stat">
                      <div className="label">Market cap</div>
                      <div className="value">
                        {t.priced ? formatMarketCap(t.marketCap) : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="swipe-hint">
                    Swipe for next · tap for Yes/No paper buy
                  </div>
                </button>
              ))}
            </div>
          </div>

          {tokens.length > 0 && (
            <>
              <div className="section-title">All tokens</div>
              <div className="compact-strip" aria-label="Jump to token">
                {tokens.map((t, i) => (
                  <button
                    key={t.address}
                    type="button"
                    className={`compact-chip ${i === index ? "on" : ""}`}
                    onClick={() => jumpTo(i)}
                  >
                    <Avatar src={t.iconUrl} symbol={t.symbol} />
                    ${t.symbol}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
