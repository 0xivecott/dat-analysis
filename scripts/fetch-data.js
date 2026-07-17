const https = require('https');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

const TARGET_SYMBOLS = new Set([
  'MSTR.US', 'XXI.US', '3350.T', 'MARA.US', 'RIOT.US', 'CLSK.US', 'SMLR.US',
  'BMNR.US', 'SBET.US', 'BTBT.US',
  'DFDV.US', 'UPXI.US', 'HODL.CN',
  'GLXY.US', 'COIN.US'
]);

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DAT-Analysis/1.0)' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else if (res.statusCode === 429) {
          reject(new Error('RATE_LIMITED'));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, retries = 3, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      const data = await fetchUrl(url);
      return JSON.parse(data);
    } catch (e) {
      if (e.message === 'RATE_LIMITED' && i < retries - 1) {
        console.log(`  Rate limited, waiting ${delay/1000}s before retry ${i+2}/${retries}...`);
        await sleep(delay);
        delay *= 2;
      } else {
        throw e;
      }
    }
  }
}

async function fetchTreasuryData() {
  console.log('Fetching BTC treasury data...');
  const btcData = await fetchWithRetry('https://api.coingecko.com/api/v3/companies/public_treasury/bitcoin');
  await sleep(3000);

  console.log('Fetching ETH treasury data...');
  const ethData = await fetchWithRetry('https://api.coingecko.com/api/v3/companies/public_treasury/ethereum');
  await sleep(3000);

  console.log('Fetching SOL treasury data...');
  const solData = await fetchWithRetry('https://api.coingecko.com/api/v3/companies/public_treasury/solana');
  await sleep(3000);

  console.log('Fetching current prices...');
  const prices = await fetchWithRetry('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true');

  return { btcData, ethData, solData, prices };
}

function filterTargetCompanies(treasuryData) {
  const { btcData, ethData, solData, prices } = treasuryData;

  const companiesMap = {};

  function processCompanies(companies, coin) {
    for (const c of companies) {
      if (!TARGET_SYMBOLS.has(c.symbol)) continue;
      if (!companiesMap[c.symbol]) {
        companiesMap[c.symbol] = {
          name: c.name,
          symbol: c.symbol,
          country: c.country,
          holdings: {}
        };
      }
      companiesMap[c.symbol].holdings[coin] = {
        quantity: c.total_holdings,
        entryValueUsd: c.total_entry_value_usd,
        currentValueUsd: c.total_current_value_usd,
        percentOfCirculating: c.percentage_of_total_supply
      };
    }
  }

  processCompanies(btcData.companies || [], 'btc');
  processCompanies(ethData.companies || [], 'eth');
  processCompanies(solData.companies || [], 'sol');

  return {
    companies: companiesMap,
    prices: {
      btc: prices.bitcoin.usd,
      eth: prices.ethereum.usd,
      sol: prices.solana.usd
    },
    marketData: {
      btc: { marketCap: prices.bitcoin.usd_market_cap, volume24h: prices.bitcoin.usd_24h_vol },
      eth: { marketCap: prices.ethereum.usd_market_cap, volume24h: prices.ethereum.usd_24h_vol },
      sol: { marketCap: prices.solana.usd_market_cap, volume24h: prices.solana.usd_24h_vol }
    },
    circulatingSupply: {
      btc: btcData.total_holdings / (btcData.market_cap_dominance / 100) * (100 / btcData.market_cap_dominance) || 19900000,
      eth: 120600000,
      sol: 582000000
    },
    fetchedAt: new Date().toISOString()
  };
}

async function main() {
  try {
    console.log('=== DAT Data Fetch ===');
    console.log(`Time: ${new Date().toISOString()}`);

    const rawData = await fetchTreasuryData();

    const btcCirculating = rawData.btcData.companies[0]
      ? rawData.btcData.companies[0].total_holdings / (rawData.btcData.companies[0].percentage_of_total_supply / 100)
      : 19900000;

    const ethCirculating = rawData.ethData.companies[0]
      ? rawData.ethData.companies[0].total_holdings / (rawData.ethData.companies[0].percentage_of_total_supply / 100)
      : 120600000;

    const solCirculating = rawData.solData.companies[0]
      ? rawData.solData.companies[0].total_holdings / (rawData.solData.companies[0].percentage_of_total_supply / 100)
      : 582000000;

    const filtered = filterTargetCompanies(rawData);
    filtered.circulatingSupply = { btc: btcCirculating, eth: ethCirculating, sol: solCirculating };

    const outputPath = path.join(DATA_DIR, 'raw-api.json');
    fs.writeFileSync(outputPath, JSON.stringify(filtered, null, 2));
    console.log(`\nData saved to ${outputPath}`);
    console.log(`Companies found: ${Object.keys(filtered.companies).length}/${TARGET_SYMBOLS.size}`);

    const missing = [...TARGET_SYMBOLS].filter(s => !filtered.companies[s]);
    if (missing.length > 0) {
      console.log(`Missing from API: ${missing.join(', ')}`);
    }

    return filtered;
  } catch (e) {
    console.error('Fetch failed:', e.message);

    const fallbackPath = path.join(DATA_DIR, 'raw-api.json');
    if (fs.existsSync(fallbackPath)) {
      console.log('Using previous data as fallback.');
      return JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
    }
    throw e;
  }
}

module.exports = { main, fetchWithRetry };

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}
