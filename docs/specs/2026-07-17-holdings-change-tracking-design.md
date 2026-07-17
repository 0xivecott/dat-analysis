# Holdings Change Tracking (Historical Sell/Buy Monitoring)

## Overview

Add daily holdings change detection to the DAT dashboard. Each time `update.js` runs, it saves a snapshot of all companies' holdings. The system compares consecutive daily snapshots to detect buy/sell activity and surfaces this in the dashboard.

## Data Storage

### New file: `data/history.json`

```json
{
  "snapshots": [
    {
      "date": "2026-07-17",
      "prices": { "btc": 62846, "eth": 1828.51, "sol": 74.44 },
      "holdings": {
        "MSTR.US": { "btc": 843775 },
        "GLXY.US": { "btc": 25723, "eth": 61137, "sol": 775289 }
      }
    }
  ]
}
```

Rules:
- One entry per calendar date (same-day re-runs overwrite, never duplicate)
- Each entry stores: date, prices, and per-company per-coin quantity only
- Permanent retention, no auto-cleanup (~1-2KB/day, ~500KB/year)

## Script Changes

### `scripts/update.js`

Insert new step between compute-metrics and deliverable-b copy:

1. Read `data/history.json` (initialize `{"snapshots":[]}` if missing)
2. Extract today's holdings from `raw-api.json`: for each company, store `{ [coin]: quantity }`
3. Extract today's prices
4. If today's date already exists in snapshots array, overwrite it; otherwise append
5. Write back to `data/history.json`

### `scripts/compute-metrics.js`

New function `computeChanges(history, prices)`:

1. Load `data/history.json`
2. Sort snapshots by date ascending
3. For each company, compare latest snapshot vs previous snapshot:
   - `delta = today.quantity - yesterday.quantity`
   - `deltaUsd = delta * today's price`
   - `type = delta < 0 ? "sell" : delta > 0 ? "buy" : null`
4. Attach `recentChange` to each company in output:
   ```json
   {
     "recentChange": {
       "date": "2026-07-18",
       "prevDate": "2026-07-17",
       "coins": {
         "btc": { "delta": -500, "deltaUsd": -31423000, "type": "sell" }
       }
     }
   }
   ```
5. Build top-level `changeLog` array from ALL consecutive snapshot pairs (only non-zero deltas):
   ```json
   {
     "changeLog": [
       { "date": "2026-07-18", "symbol": "MSTR.US", "name": "Strategy", "coin": "btc", "delta": -500, "deltaUsd": -31423000, "type": "sell" }
     ]
   }
   ```
   Sorted by date descending.

## Frontend Changes (deliverable-b/index.html)

### Main Table: New Column "变动"

- Position: between "可售性" and "风险" columns
- Content:
  - Sell: `🔴 -500 BTC` (red text) with small USD value below (`-$31.4M`)
  - Buy: `🟢 +1,200 BTC` (green text) with small USD value below (`+$75.4M`)
  - No change: `—`
- Sortable by `deltaUsd`

### New Filter Button

- Label: `有变动`
- `data-filter="changed"`
- Shows only companies where `recentChange` has at least one non-null coin delta

### New Section: "持仓变动历史"

- Position: after charts section, before footer
- Heading: `<h2>持仓变动历史</h2>`
- Table with columns: 日期 | 公司 | 币种 | 变动量 | 美元价值 | 类型
- Rows sorted by date descending
- Sell rows: red-tinted background
- Buy rows: green-tinted background
- Empty state: "暂无历史数据，明日起开始记录变动"

## Edge Cases

- First run ever: no previous snapshot exists, `recentChange` = null for all, changeLog = empty, show empty-state message
- Company disappears from API: treat as "data unavailable", do NOT mark as sell
- Company appears in API for first time: treat as "new entry", do NOT mark as buy (no previous baseline)
- Same-day multiple runs: overwrite today's snapshot, no false "change" detected
- API failure with fallback data: `update.js` already handles this — stale data means no delta detected (correct behavior)

## File Changes Summary

| File | Change |
|------|--------|
| `data/history.json` | New file (created on first run) |
| `scripts/update.js` | Add Step 2.5: save daily snapshot to history.json |
| `scripts/compute-metrics.js` | Add `computeChanges()`, attach `recentChange` + `changeLog` to output |
| `deliverable-b/index.html` | New column, new filter, new history section |
