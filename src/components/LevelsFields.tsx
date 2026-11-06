"use client";

import { formatPrice } from "@/lib/format";

export type LevelsDraft = {
  stopLossPrice: string;
  takeProfitPrice: string;
};

export const emptyLevels = (): LevelsDraft => ({
  stopLossPrice: "",
  takeProfitPrice: "",
});

export function parseLevel(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function LevelsFields({
  levels,
  onChange,
  entryPriceUsd,
  disabled,
}: {
  levels: LevelsDraft;
  onChange: (l: LevelsDraft) => void;
  entryPriceUsd: number | null;
  disabled?: boolean;
}) {
  return (
    <div className="levels">
      <div className="small muted" style={{ marginBottom: 6 }}>
        Optional stop-loss / take-profit (USD token price
        {entryPriceUsd ? ` · entry ~${formatPrice(entryPriceUsd)}` : ""}). Leave
        blank to skip. Estimates only — checked on periodic marks.
      </div>
      <div className="field-row">
        <label className="field">
          <span>Stop-loss (USD)</span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="optional"
            value={levels.stopLossPrice}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...levels, stopLossPrice: e.target.value })
            }
          />
        </label>
        <label className="field">
          <span>Take-profit (USD)</span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="optional"
            value={levels.takeProfitPrice}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...levels, takeProfitPrice: e.target.value })
            }
          />
        </label>
      </div>
    </div>
  );
}
