# DAT Dashboard - Auto-Updating Setup

## Daily Update Script

Run the data update script once per day to refresh holdings and price data:

```bash
cd C:\Users\ivecott.ma\dat-analysis
node scripts/update.js
```

This fetches latest data from CoinGecko API, computes all risk metrics, and writes `deliverable-b/data.json`.

## Windows Task Scheduler (Recommended)

1. Open Task Scheduler (`taskschd.msc`)
2. Create Basic Task:
   - Name: `DAT Dashboard Update`
   - Trigger: Daily, 8:00 AM (or preferred time)
   - Action: Start a program
   - Program: `"C:\Program Files\nodejs\node.exe"`
   - Arguments: `"C:\Users\ivecott.ma\dat-analysis\scripts\update.js"`
   - Start in: `C:\Users\ivecott.ma\dat-analysis`
3. In Properties > Settings:
   - Check "Run whether user is logged on or not"
   - Check "If the task fails, restart every 1 hour, up to 3 times"

## Linux/Mac Cron

```bash
# Add to crontab (crontab -e):
0 8 * * * cd /path/to/dat-analysis && /usr/bin/node scripts/update.js >> /tmp/dat-update.log 2>&1
```

## Serving the Dashboard

The dashboard is a static HTML file that loads `data.json` from the same directory.

Option 1 - Simple HTTP server:
```bash
cd deliverable-b
npx serve .
# Opens at http://localhost:3000
```

Option 2 - Open directly in browser:
```
file:///C:/Users/ivecott.ma/dat-analysis/deliverable-b/index.html
```
Note: `file://` protocol may block fetch requests in some browsers. Use a local server if data doesn't load.

## Failure Handling

- If the API is rate-limited or unavailable, the script uses the last successful `data/raw-api.json` as fallback
- The dashboard detects stale data (>48 hours old) and shows an orange warning indicator
- If `data.json` is missing entirely, the dashboard shows an error state

## Network Requirements

The update script requires network access to CoinGecko API via the configured proxy (`proxy.huobiinc.com:3128`).
If running on a different network, edit the `PROXY_HOST` and `PROXY_PORT` in `scripts/fetch-data.js`, or remove the proxy if direct internet access is available.
