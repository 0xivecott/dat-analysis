const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');

async function main() {
  console.log('========================================');
  console.log('  DAT Analysis - Daily Update');
  console.log(`  ${new Date().toISOString()}`);
  console.log('========================================\n');

  // Step 1: Fetch fresh data from APIs
  const fetcher = require('./fetch-data.js');
  try {
    await fetcher.main();
  } catch (e) {
    console.error('\nFetch failed:', e.message);
    const rawPath = path.join(DATA_DIR, 'raw-api.json');
    if (!fs.existsSync(rawPath)) {
      console.error('No fallback data available. Aborting.');
      process.exit(1);
    }
    console.log('Continuing with stale data...');
  }

  // Step 2: Compute metrics
  const computer = require('./compute-metrics.js');
  const snapshot = computer.main();

  // Step 2.5: Save daily snapshot to history.json
  const historyPath = path.join(DATA_DIR, 'history.json');
  let history = { snapshots: [] };
  if (fs.existsSync(historyPath)) {
    try { history = JSON.parse(fs.readFileSync(historyPath, 'utf8')); } catch (e) { history = { snapshots: [] }; }
  }
  const today = new Date().toISOString().slice(0, 10);
  const todayHoldings = {};
  const rawApi = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'raw-api.json'), 'utf8'));
  for (const [symbol, company] of Object.entries(rawApi.companies)) {
    todayHoldings[symbol] = {};
    for (const [coin, h] of Object.entries(company.holdings || {})) {
      todayHoldings[symbol][coin] = h.quantity;
    }
  }
  const todayEntry = { date: today, prices: rawApi.prices, holdings: todayHoldings };
  const existingIdx = history.snapshots.findIndex(s => s.date === today);
  if (existingIdx >= 0) {
    history.snapshots[existingIdx] = todayEntry;
  } else {
    history.snapshots.push(todayEntry);
  }
  history.snapshots.sort((a, b) => a.date.localeCompare(b.date));
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
  console.log(`History saved (${history.snapshots.length} snapshots total)`);

  // Step 3: Copy to deliverable-b
  const delivBPath = path.join(__dirname, '..', 'deliverable-b', 'data.json');
  fs.writeFileSync(delivBPath, JSON.stringify(snapshot, null, 2));
  console.log(`\nCopied snapshot to ${delivBPath}`);

  // Step 4: Inject inline data into deliverable-b/index.html (so it works via file://)
  const htmlPath = path.join(__dirname, '..', 'deliverable-b', 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  const inlineTag = '<script id="inline-data">';
  const inlineScript = `<script id="inline-data">window.__INLINE_DATA__=${JSON.stringify(snapshot)};</script>`;
  if (html.includes('id="inline-data"')) {
    html = html.replace(/<script id="inline-data">.*?<\/script>/s, inlineScript);
  } else {
    html = html.replace('</head>', inlineScript + '\n</head>');
  }
  fs.writeFileSync(htmlPath, html);
  console.log('Injected inline data into deliverable-b/index.html');

  console.log('\n========================================');
  console.log('  Update complete!');
  console.log('========================================');
}

main().catch(e => {
  console.error('Update failed:', e);
  process.exit(1);
});
