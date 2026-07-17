const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function loadData() {
  const rawApi = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'raw-api.json'), 'utf8'));
  const research = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'companies-research.json'), 'utf8'));
  return { rawApi, research };
}

function computeAvgCost(holding) {
  if (!holding || !holding.entryValueUsd || holding.entryValueUsd === 0) return null;
  return holding.entryValueUsd / holding.quantity;
}

function computePnl(holding, currentPrice) {
  if (!holding) return { unrealizedUsd: null, unrealizedPct: null };
  const currentValue = holding.quantity * currentPrice;
  if (!holding.entryValueUsd || holding.entryValueUsd === 0) {
    return { unrealizedUsd: null, unrealizedPct: null };
  }
  const unrealizedUsd = currentValue - holding.entryValueUsd;
  const unrealizedPct = (unrealizedUsd / holding.entryValueUsd) * 100;
  return { unrealizedUsd, unrealizedPct };
}

function computeBankruptcyPrice(researchData, holdings, prices) {
  if (!researchData.debt || !researchData.debt.hasLeverage || !researchData.debt.totalDebtUsd) {
    return { bankruptcyPrice: null, bufferPct: null, reason: 'No leverage / no forced liquidation price' };
  }

  const totalDebt = researchData.debt.totalDebtUsd;
  const primary = researchData.primaryCoin.toLowerCase();

  // For diversified companies (exchanges etc) where crypto is not the primary collateral,
  // bankruptcy price is not meaningful
  let totalCryptoValue = 0;
  for (const [coin, h] of Object.entries(holdings)) {
    if (h && prices[coin]) totalCryptoValue += h.quantity * prices[coin];
  }
  if (totalDebt > totalCryptoValue * 3) {
    return { bankruptcyPrice: null, bufferPct: null, reason: 'Debt exceeds crypto holdings 3x+ (company has non-crypto revenue)' };
  }

  let primaryHolding = holdings[primary];
  if (!primaryHolding || primaryHolding.quantity === 0) {
    return { bankruptcyPrice: null, bufferPct: null, reason: 'No holdings in primary coin' };
  }

  const bankruptcyPrice = totalDebt / primaryHolding.quantity;
  const currentPrice = prices[primary];
  const bufferPct = ((currentPrice - bankruptcyPrice) / currentPrice) * 100;

  return { bankruptcyPrice, bufferPct, currentPrice, coin: primary };
}

function computeLiquidityRisk(holdings, marketData) {
  let totalValueUsd = 0;
  let maxDaysToExit = 0;

  for (const [coin, holding] of Object.entries(holdings)) {
    if (!holding || !marketData[coin]) continue;
    const value = holding.quantity * (marketData[coin].volume24h ? 1 : 0);
    totalValueUsd += holding.currentValueUsd || 0;

    const dailyVolume = marketData[coin].volume24h || 1;
    const maxSellPerDay = dailyVolume * 0.01; // assume can sell 1% of daily volume without impact
    const daysToExit = (holding.currentValueUsd || 0) / maxSellPerDay;
    maxDaysToExit = Math.max(maxDaysToExit, daysToExit);
  }

  if (maxDaysToExit < 1) return { daysToExit: maxDaysToExit, level: 0, label: '< 1 day' };
  if (maxDaysToExit < 7) return { daysToExit: maxDaysToExit, level: 1, label: '1-7 days' };
  if (maxDaysToExit < 30) return { daysToExit: maxDaysToExit, level: 2, label: '7-30 days' };
  return { daysToExit: maxDaysToExit, level: 3, label: '> 30 days' };
}

function computeSellability(lockStatus, liquidityRisk) {
  if (lockStatus === 'difficult_exit') return 'difficult_exit';
  if (lockStatus === 'restricted' || liquidityRisk.level >= 2) return 'restricted';
  return 'free';
}

function computeRiskScore(leverage, concentration, liquidity, reflexivity) {
  const total = leverage + concentration + liquidity + reflexivity;
  let level;
  if (total <= 3) level = 'low';
  else if (total <= 6) level = 'medium';
  else if (total <= 9) level = 'high';
  else level = 'critical';
  return { total, level, breakdown: { leverage, concentration, liquidity, reflexivity } };
}

function getLeverageScore(researchData, holdings, prices) {
  if (!researchData.debt || !researchData.debt.hasLeverage) return 0;
  const totalDebt = researchData.debt.totalDebtUsd || 0;
  let totalHoldingsValue = 0;
  for (const [coin, h] of Object.entries(holdings)) {
    if (h && prices[coin]) totalHoldingsValue += h.quantity * prices[coin];
  }
  if (totalHoldingsValue === 0) return 0;
  const ltv = totalDebt / totalHoldingsValue;
  if (ltv < 0.2) return 1;
  if (ltv < 0.5) return 2;
  return 3;
}

function getConcentrationScore(holdings, prices) {
  let totalValue = 0;
  let maxCoinValue = 0;
  for (const [coin, h] of Object.entries(holdings)) {
    if (!h || !prices[coin]) continue;
    const val = h.quantity * prices[coin];
    totalValue += val;
    maxCoinValue = Math.max(maxCoinValue, val);
  }
  if (totalValue === 0) return 3;
  const ratio = maxCoinValue / totalValue;
  if (ratio < 0.5) return 0;
  if (ratio < 0.8) return 1;
  return Object.keys(holdings).length === 1 ? 3 : 2;
}

function getReflexivityScore(mnavPremium) {
  if (mnavPremium === null || mnavPremium === undefined) return 1;
  if (mnavPremium <= 1.0) return 0;
  if (mnavPremium <= 1.5) return 1;
  if (mnavPremium <= 3.0) return 2;
  return 3;
}

function computeChanges(prices, nameMap) {
  const historyPath = path.join(DATA_DIR, 'history.json');
  if (!fs.existsSync(historyPath)) return { recentChanges: {}, changeLog: [] };

  let history;
  try { history = JSON.parse(fs.readFileSync(historyPath, 'utf8')); } catch (e) { return { recentChanges: {}, changeLog: [] }; }

  const snapshots = history.snapshots || [];
  if (snapshots.length < 2) return { recentChanges: {}, changeLog: [] };

  const changeLog = [];
  const recentChanges = {};

  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const curr = snapshots[i];
    const allSymbols = new Set([...Object.keys(prev.holdings || {}), ...Object.keys(curr.holdings || {})]);

    for (const symbol of allSymbols) {
      const prevH = prev.holdings[symbol] || {};
      const currH = curr.holdings[symbol] || {};
      if (!prev.holdings[symbol] || !curr.holdings[symbol]) continue;

      const allCoins = new Set([...Object.keys(prevH), ...Object.keys(currH)]);
      for (const coin of allCoins) {
        const prevQty = prevH[coin] || 0;
        const currQty = currH[coin] || 0;
        const delta = currQty - prevQty;
        if (delta === 0) continue;

        const priceAtTime = (curr.prices && curr.prices[coin]) || prices[coin] || 0;
        const deltaUsd = delta * priceAtTime;
        const type = delta < 0 ? 'sell' : 'buy';

        changeLog.push({ date: curr.date, symbol, name: nameMap[symbol] || symbol, coin, delta, deltaUsd, type });
      }
    }
  }

  changeLog.sort((a, b) => b.date.localeCompare(a.date) || a.symbol.localeCompare(b.symbol));

  const latest = snapshots[snapshots.length - 1];
  const prev = snapshots[snapshots.length - 2];
  for (const symbol of Object.keys(latest.holdings || {})) {
    if (!prev.holdings[symbol]) continue;
    const coins = {};
    let hasChange = false;
    for (const coin of Object.keys(latest.holdings[symbol])) {
      const prevQty = (prev.holdings[symbol] && prev.holdings[symbol][coin]) || 0;
      const currQty = latest.holdings[symbol][coin] || 0;
      const delta = currQty - prevQty;
      if (delta !== 0) {
        const priceAtTime = (latest.prices && latest.prices[coin]) || prices[coin] || 0;
        coins[coin] = { delta, deltaUsd: delta * priceAtTime, type: delta < 0 ? 'sell' : 'buy' };
        hasChange = true;
      }
    }
    if (hasChange) {
      recentChanges[symbol] = { date: latest.date, prevDate: prev.date, coins };
    }
  }

  return { recentChanges, changeLog };
}

function computeAllMetrics() {
  const { rawApi, research } = loadData();
  const { companies, prices, marketData, circulatingSupply, fetchedAt } = rawApi;

  const results = [];

  for (const [symbol, company] of Object.entries(companies)) {
    const researchData = research.companies[symbol] || {};
    const holdings = company.holdings || {};

    // Compute per-coin metrics
    const coinMetrics = {};
    for (const [coin, holding] of Object.entries(holdings)) {
      const avgCost = computeAvgCost(holding);
      const pnl = computePnl(holding, prices[coin]);
      coinMetrics[coin] = {
        quantity: holding.quantity,
        entryValueUsd: holding.entryValueUsd,
        currentValueUsd: holding.quantity * prices[coin],
        avgCost,
        percentOfCirculating: holding.percentOfCirculating,
        ...pnl
      };
    }

    // Aggregated metrics
    let totalCurrentValue = 0;
    let totalEntryValue = 0;
    for (const m of Object.values(coinMetrics)) {
      totalCurrentValue += m.currentValueUsd || 0;
      totalEntryValue += m.entryValueUsd || 0;
    }

    const bankruptcy = computeBankruptcyPrice(researchData, holdings, prices);
    const liquidityRisk = computeLiquidityRisk(holdings, marketData);
    const sellability = computeSellability(researchData.lockStatus || 'free', liquidityRisk);

    // Risk scoring
    const leverageScore = getLeverageScore(researchData, holdings, prices);
    const concentrationScore = getConcentrationScore(holdings, prices);
    const reflexivityScore = getReflexivityScore(researchData.mnavPremium);
    const risk = computeRiskScore(leverageScore, concentrationScore, liquidityRisk.level, reflexivityScore);

    results.push({
      name: researchData.name || company.name,
      symbol,
      country: company.country,
      primaryCoin: researchData.primaryCoin || Object.keys(holdings)[0] || 'btc',
      holdings: coinMetrics,
      totalCurrentValueUsd: totalCurrentValue,
      totalEntryValueUsd: totalEntryValue > 0 ? totalEntryValue : null,
      totalUnrealizedPnlUsd: totalEntryValue > 0 ? totalCurrentValue - totalEntryValue : null,
      totalUnrealizedPnlPct: totalEntryValue > 0 ? ((totalCurrentValue - totalEntryValue) / totalEntryValue) * 100 : null,
      debt: researchData.debt || null,
      bankruptcy,
      liquidityRisk,
      sellability,
      lockStatus: researchData.lockStatus || 'free',
      mnavPremium: researchData.mnavPremium || null,
      risk,
      notes: researchData.notes || null
    });
  }

  // Compute historical changes
  const nameMap = {};
  for (const r of results) nameMap[r.symbol] = r.name;
  const { recentChanges, changeLog } = computeChanges(prices, nameMap);
  for (const r of results) {
    r.recentChange = recentChanges[r.symbol] || null;
  }

  // Sort by total current value descending
  results.sort((a, b) => b.totalCurrentValueUsd - a.totalCurrentValueUsd);

  // Identify top 3 most vulnerable
  const byRisk = [...results].sort((a, b) => b.risk.total - a.risk.total);
  const top3Vulnerable = byRisk.slice(0, 3).map(c => ({
    name: c.name,
    symbol: c.symbol,
    riskScore: c.risk.total,
    riskLevel: c.risk.level,
    primaryReason: getRiskReason(c)
  }));

  const snapshot = {
    generatedAt: new Date().toISOString(),
    dataFetchedAt: fetchedAt,
    prices,
    circulatingSupply,
    marketData,
    companies: results,
    top3Vulnerable,
    changeLog,
    disclaimer: 'This analysis is for informational purposes only and does not constitute investment advice. Data may be stale or inaccurate. Verify independently before making decisions.'
  };

  return snapshot;
}

function getRiskReason(company) {
  const reasons = [];
  if (company.risk.breakdown.leverage >= 2) reasons.push('高杠杆');
  if (company.risk.breakdown.concentration >= 2) reasons.push('单币种集中持仓');
  if (company.risk.breakdown.liquidity >= 2) reasons.push('流动性受限');
  if (company.risk.breakdown.reflexivity >= 2) reasons.push('mNAV 溢价过高');
  return reasons.join('；') || '多项中等风险因素叠加';
}

function main() {
  console.log('=== Computing Metrics ===');
  const snapshot = computeAllMetrics();

  const outputPath = path.join(DATA_DIR, 'snapshot.json');
  fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2));
  console.log(`Snapshot saved to ${outputPath}`);
  console.log(`Companies: ${snapshot.companies.length}`);
  console.log(`Top 3 Vulnerable: ${snapshot.top3Vulnerable.map(c => c.name).join(', ')}`);

  return snapshot;
}

module.exports = { main, computeAllMetrics };

if (require.main === module) {
  main();
}
