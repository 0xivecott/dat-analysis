const fs = require('fs');
const path = require('path');

const snapshot = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'snapshot.json'), 'utf8'));
const snapshotJson = JSON.stringify(snapshot);

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DAT Risk Analysis Report</title>
<style>
:root{--bg:#0f1117;--surface:#1a1d27;--border:#2a2d3a;--text:#e4e4e7;--text-dim:#9ca3af;--accent:#6366f1;--green:#22c55e;--red:#ef4444;--yellow:#eab308;--orange:#f97316}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,monospace;background:var(--bg);color:var(--text);line-height:1.6;padding:20px}
.container{max-width:1400px;margin:0 auto}
h1{font-size:1.8rem;margin-bottom:4px}h2{font-size:1.3rem;margin:24px 0 12px;color:var(--accent);border-bottom:1px solid var(--border);padding-bottom:6px}h3{font-size:1.1rem;margin:16px 0 8px}
.subtitle{color:var(--text-dim);font-size:.9rem;margin-bottom:20px}
.disclaimer{background:#1c1408;border:1px solid #854d0e;border-radius:8px;padding:12px 16px;margin:16px 0;font-size:.85rem;color:#fbbf24}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0}
.card{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:16px}
.card-title{font-size:.85rem;color:var(--text-dim);margin-bottom:4px}
.card-value{font-size:1.5rem;font-weight:700}
.filters{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
.filter-btn{background:var(--surface);border:1px solid var(--border);color:var(--text);padding:6px 14px;border-radius:6px;cursor:pointer;font-size:.85rem;transition:all .2s}
.filter-btn:hover,.filter-btn.active{background:var(--accent);border-color:var(--accent);color:#fff}
table{width:100%;border-collapse:collapse;font-size:.82rem;margin:12px 0}
th{background:var(--surface);padding:10px 8px;text-align:left;border-bottom:2px solid var(--border);cursor:pointer;user-select:none;white-space:nowrap;position:sticky;top:0;z-index:10}
th:hover{color:var(--accent)}td{padding:8px;border-bottom:1px solid var(--border);vertical-align:top}
tr:hover{background:rgba(99,102,241,.05)}
.risk-low{color:var(--green)}.risk-medium{color:var(--yellow)}.risk-high{color:var(--orange)}.risk-critical{color:var(--red)}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.75rem;font-weight:600}
.badge-btc{background:#f59e0b20;color:#f59e0b}.badge-eth{background:#6366f120;color:#8b8ff5}.badge-sol{background:#9333ea20;color:#a855f7}
.pnl-pos{color:var(--green)}.pnl-neg{color:var(--red)}
.bar-chart{margin:16px 0}
.bar-row{display:flex;align-items:center;margin:4px 0;gap:8px}
.bar-label{width:140px;font-size:.8rem;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar-track{flex:1;height:22px;background:var(--surface);border-radius:4px;overflow:hidden}
.bar-fill{height:100%;border-radius:4px;display:flex;align-items:center;padding-left:6px;font-size:.7rem;color:#fff;font-weight:600}
.bar-value{margin-left:8px;font-size:.75rem;color:var(--text-dim);white-space:nowrap}
.vulnerable-card{background:linear-gradient(135deg,#1a0505,#1f1015);border:1px solid #7f1d1d;border-radius:8px;padding:16px;margin:8px 0}
.vulnerable-card h4{color:var(--red);margin-bottom:4px}
.vulnerable-card .reason{color:var(--text-dim);font-size:.85rem}
.tooltip{position:relative;cursor:help;border-bottom:1px dotted var(--text-dim)}
.tooltip::after{content:attr(data-tip);position:absolute;bottom:100%;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:6px 10px;border-radius:4px;font-size:.75rem;white-space:pre-wrap;max-width:280px;opacity:0;pointer-events:none;transition:opacity .2s;z-index:100}
.tooltip:hover::after{opacity:1}
.meta{color:var(--text-dim);font-size:.78rem;margin-top:24px;border-top:1px solid var(--border);padding-top:12px}
@media(max-width:900px){.grid-2{grid-template-columns:1fr}table{font-size:.75rem}.bar-label{width:80px}}
</style>
</head>
<body>
<div class="container">
<h1>Digital Asset Treasury Companies (DAT)</h1>
<p class="subtitle">Risk Analysis Report &mdash; Snapshot: <span id="snap-date"></span></p>
<div class="disclaimer">This report is for informational and research purposes only. It does not constitute investment advice. Data may be stale or estimated. Verify against primary sources (SEC filings, company IR pages) before making any decisions.</div>
<div class="grid-2">
<div class="card"><div class="card-title">Total Holdings Value (15 companies)</div><div class="card-value" id="total-val"></div></div>
<div class="card"><div class="card-title">Current Prices</div><div class="card-value" id="prices-display"></div></div>
</div>
<h2>Holdings &amp; Risk Table</h2>
<div class="filters">
<button class="filter-btn active" data-filter="all">All (15)</button>
<button class="filter-btn" data-filter="btc">BTC</button>
<button class="filter-btn" data-filter="eth">ETH</button>
<button class="filter-btn" data-filter="sol">SOL</button>
<button class="filter-btn" data-filter="high-risk">High Risk Only</button>
</div>
<div style="overflow-x:auto"><table id="main-table"><thead><tr>
<th data-col="rank">#</th>
<th data-col="name">Company</th>
<th data-col="primaryCoin">Coin</th>
<th data-col="quantity">Holdings</th>
<th data-col="avgCost"><span class="tooltip" data-tip="Total entry value / quantity. Null if undisclosed by company.">Avg Cost</span></th>
<th data-col="pctCirculating"><span class="tooltip" data-tip="Holdings as % of total circulating supply">% Circ.</span></th>
<th data-col="pnlPct"><span class="tooltip" data-tip="Unrealized profit/loss vs disclosed entry cost">P&amp;L</span></th>
<th data-col="bankruptcyPrice"><span class="tooltip" data-tip="Coin price where total debt exceeds holdings value (leveraged only)">Bankr. Price</span></th>
<th data-col="bufferPct"><span class="tooltip" data-tip="How far current price is above bankruptcy threshold">Buffer</span></th>
<th data-col="sellability"><span class="tooltip" data-tip="Assessment: lock status + volume-based exit capacity + reflexivity">Sellability</span></th>
<th data-col="riskTotal"><span class="tooltip" data-tip="Composite 0-12: leverage + concentration + liquidity + reflexivity">Risk</span></th>
</tr></thead><tbody id="table-body"></tbody></table></div>

<h2>Risk Assessment</h2>
<h3>Top 3 Most Vulnerable</h3>
<div id="vulnerable-section"></div>

<h3>Risk Scoring Methodology</h3>
<div class="card" style="font-size:.85rem">
<p>Each company scored on 4 axes (0-3 each, total 0-12):</p>
<ul style="margin:8px 0 0 20px">
<li><strong>Leverage</strong>: 0=no debt, 1=LTV&lt;20%, 2=LTV 20-50%, 3=LTV&gt;50%</li>
<li><strong>Concentration</strong>: 0=diversified multi-coin, 3=100% single coin exposure</li>
<li><strong>Liquidity</strong>: 0=exit in &lt;1 day, 1=1-7d, 2=7-30d, 3=&gt;30 days (at 1% daily vol)</li>
<li><strong>Reflexivity</strong>: 0=trades at/below NAV, 1=&lt;50% premium, 2=50-200%, 3=&gt;200% mNAV</li>
</ul>
<p style="margin-top:8px"><strong>Rating:</strong> Low (0-3) | Medium (4-6) | High (7-9) | Critical (10-12)</p>
</div>

<h2>Comparative Charts</h2>
<h3>Holdings Value (USD)</h3><div id="chart-holdings" class="bar-chart"></div>
<h3>Bankruptcy Price Buffer (leveraged companies only)</h3><div id="chart-buffer" class="bar-chart"></div>
<h3>Risk Score Distribution</h3><div id="chart-risk" class="bar-chart"></div>

<h2>Key Findings</h2>
<div class="card" style="font-size:.85rem" id="findings"></div>

<h2>Definitions &amp; Caveats</h2>
<div class="card" style="font-size:.85rem">
<p><strong>Bankruptcy Price:</strong> For leveraged companies, the coin price at which total debt exceeds total holdings value (debt / coin quantity). Most DAT companies use equity-settled convertible notes &mdash; no forced BTC liquidation occurs, but company may become insolvent if stock crashes and refinancing fails.</p>
<p style="margin-top:8px"><strong>Sellability:</strong> Based on: (1) staking/lock status, (2) position size vs daily volume (assuming 1% of daily volume sellable without &gt;2% slippage), (3) reflexivity (selling triggers stock decline, triggering more selling).</p>
<p style="margin-top:8px"><strong>Data Freshness:</strong> Holdings and prices from CoinGecko API (snapshot time shown above). Debt data from SEC filings and company disclosures (may lag by 1-2 quarters). Average cost shows "&#x2014;" when company has not disclosed entry price.</p>
<p style="margin-top:8px"><strong>Sources:</strong> CoinGecko Public Treasury API, Strategy.com/debt, SEC EDGAR, company IR pages and press releases.</p>
</div>
<div class="meta">
<p>Generated: <span id="gen-date"></span> | Data fetched: <span id="fetch-date"></span></p>
<p>This is not investment advice. Past performance does not indicate future results. Verify all data independently.</p>
</div>
</div>
<script>
const DATA=${snapshotJson};
function fmt(n,d=0){if(n==null)return"\\u2014";return n.toLocaleString("en-US",{maximumFractionDigits:d})}
function fmtUsd(n){if(n==null)return"\\u2014";if(Math.abs(n)>=1e9)return"$"+(n/1e9).toFixed(2)+"B";if(Math.abs(n)>=1e6)return"$"+(n/1e6).toFixed(1)+"M";return"$"+fmt(n)}
function fmtPct(n){return n==null?"\\u2014":n.toFixed(1)+"%"}

document.getElementById("snap-date").textContent=new Date(DATA.generatedAt).toLocaleString();
document.getElementById("gen-date").textContent=new Date(DATA.generatedAt).toLocaleString();
document.getElementById("fetch-date").textContent=new Date(DATA.dataFetchedAt).toLocaleString();
document.getElementById("total-val").textContent=fmtUsd(DATA.companies.reduce((s,c)=>s+c.totalCurrentValueUsd,0));
document.getElementById("prices-display").innerHTML="BTC $"+fmt(DATA.prices.btc)+" | ETH $"+fmt(DATA.prices.eth)+" | SOL $"+fmt(DATA.prices.sol,2);

let sortCol="riskTotal",sortDir=-1,activeFilter="all";
function filterCompanies(){return DATA.companies.filter(c=>{if(activeFilter==="all")return true;if(activeFilter==="high-risk")return c.risk.total>=7;return c.primaryCoin.toLowerCase()===activeFilter})}

function renderTable(){
  const filtered=filterCompanies();
  const rows=filtered.map((c,i)=>{const p=c.primaryCoin.toLowerCase();const h=c.holdings[p];return{rank:i+1,name:c.name,symbol:c.symbol,primaryCoin:c.primaryCoin.toUpperCase(),quantity:h?h.quantity:0,avgCost:h?h.avgCost:null,pctCirculating:h?h.percentOfCirculating:null,pnlPct:c.totalUnrealizedPnlPct,pnlUsd:c.totalUnrealizedPnlUsd,bankruptcyPrice:c.bankruptcy.bankruptcyPrice,bufferPct:c.bankruptcy.bufferPct,sellability:c.sellability,riskTotal:c.risk.total,riskLevel:c.risk.level,totalValue:c.totalCurrentValueUsd}});
  rows.sort((a,b)=>{let va=a[sortCol],vb=b[sortCol];if(va==null)va=-Infinity;if(vb==null)vb=-Infinity;return(va>vb?1:va<vb?-1:0)*sortDir});
  const tbody=document.getElementById("table-body");
  tbody.innerHTML=rows.map((r,i)=>{
    const cb='<span class="badge badge-'+r.primaryCoin.toLowerCase()+'">'+r.primaryCoin+"</span>";
    const pc=r.pnlPct>0?"pnl-pos":r.pnlPct<0?"pnl-neg":"";
    const rc="risk-"+r.riskLevel;
    const sl=r.sellability==="free"?"\\u2705 Free":r.sellability==="restricted"?"\\u26A0\\uFE0F Limited":"\\u274C Difficult";
    return "<tr><td>"+(i+1)+"</td><td><strong>"+r.name+'</strong><br><span style="color:var(--text-dim);font-size:.75rem">'+r.symbol+"</span></td><td>"+cb+"</td><td>"+fmt(r.quantity)+'<br><span style="color:var(--text-dim);font-size:.75rem">'+fmtUsd(r.totalValue)+"</span></td><td>"+(r.avgCost?"$"+fmt(r.avgCost):"\\u2014")+"</td><td>"+(r.pctCirculating?r.pctCirculating.toFixed(3)+"%":"\\u2014")+'</td><td class="'+pc+'">'+fmtPct(r.pnlPct)+"</td><td>"+(r.bankruptcyPrice?"$"+fmt(r.bankruptcyPrice):"N/A")+"</td><td>"+(r.bufferPct!=null?'<span class="'+(r.bufferPct>50?"pnl-pos":r.bufferPct>20?"":"pnl-neg")+'">'+r.bufferPct.toFixed(1)+"%</span>":"\\u2014")+"</td><td>"+sl+'</td><td><span class="'+rc+'" style="font-weight:700">'+r.riskTotal+'/12</span><br><span class="'+rc+'" style="font-size:.75rem">'+r.riskLevel.toUpperCase()+"</span></td></tr>"
  }).join("");
}

document.querySelectorAll("#main-table th").forEach(th=>{th.addEventListener("click",()=>{const col=th.dataset.col;if(!col)return;if(sortCol===col)sortDir*=-1;else{sortCol=col;sortDir=-1}renderTable()})});
document.querySelectorAll(".filter-btn").forEach(btn=>{btn.addEventListener("click",()=>{document.querySelectorAll(".filter-btn").forEach(b=>b.classList.remove("active"));btn.classList.add("active");activeFilter=btn.dataset.filter;renderTable()})});

document.getElementById("vulnerable-section").innerHTML=DATA.top3Vulnerable.map((v,i)=>'<div class="vulnerable-card"><h4>#'+(i+1)+" "+v.name+" ("+v.symbol+") \\u2014 Risk "+v.riskScore+'/12</h4><div class="reason">'+v.primaryReason+"</div></div>").join("");

function renderBarChart(id,data,colorFn){
  const el=document.getElementById(id);if(!el)return;
  const valid=data.filter(d=>d.value!=null&&d.value>0);
  if(!valid.length){el.innerHTML='<p style="color:var(--text-dim)">No data available</p>';return}
  const mx=Math.max(...valid.map(d=>d.value));
  el.innerHTML=valid.map(d=>{const pct=Math.max(2,(d.value/mx)*100);const col=colorFn?colorFn(d):"var(--accent)";return'<div class="bar-row"><div class="bar-label">'+d.label+'</div><div class="bar-track"><div class="bar-fill" style="width:'+pct+"%;background:"+col+'">'+(pct>20?d.display:"")+'</div></div><div class="bar-value">'+(pct<=20?d.display:"")+"</div></div>"}).join("");
}

renderBarChart("chart-holdings",DATA.companies.map(c=>({label:c.symbol.split(".")[0],value:c.totalCurrentValueUsd,display:fmtUsd(c.totalCurrentValueUsd)})),d=>d.value>10e9?"var(--orange)":d.value>1e9?"var(--accent)":"#6b7280");

const bd=DATA.companies.filter(c=>c.bankruptcy.bufferPct!=null).sort((a,b)=>a.bankruptcy.bufferPct-b.bankruptcy.bufferPct).map(c=>({label:c.symbol.split(".")[0],value:c.bankruptcy.bufferPct,display:c.bankruptcy.bufferPct.toFixed(1)+"%"}));
renderBarChart("chart-buffer",bd,d=>d.value<50?"var(--red)":d.value<70?"var(--yellow)":"var(--green)");

renderBarChart("chart-risk",[...DATA.companies].sort((a,b)=>b.risk.total-a.risk.total).map(c=>({label:c.symbol.split(".")[0],value:c.risk.total,display:c.risk.total+"/12"})),d=>d.value>=10?"var(--red)":d.value>=7?"var(--orange)":d.value>=4?"var(--yellow)":"var(--green)");

// Key findings
const leveraged=DATA.companies.filter(c=>c.debt&&c.debt.hasLeverage);
const totalDebt=leveraged.reduce((s,c)=>s+(c.debt?.totalDebtUsd||0),0);
const findings=document.getElementById("findings");
findings.innerHTML=\`
<ul style="margin-left:20px">
<li><strong>\${DATA.companies.length} companies</strong> hold combined <strong>\${fmtUsd(DATA.companies.reduce((s,c)=>s+c.totalCurrentValueUsd,0))}</strong> in crypto treasury assets</li>
<li><strong>\${leveraged.length} companies</strong> use leverage (total debt: <strong>\${fmtUsd(totalDebt)}</strong>)</li>
<li><strong>Strategy (MSTR)</strong> dominates with \${((DATA.companies[0]?.totalCurrentValueUsd||0)/DATA.companies.reduce((s,c)=>s+c.totalCurrentValueUsd,0)*100).toFixed(0)}% of total holdings value</li>
<li><strong>Highest leverage risk:</strong> Metaplanet (3350.T) with \${DATA.companies.find(c=>c.symbol==="3350.T")?.bankruptcy.bufferPct?.toFixed(0)||"?"}% buffer to bankruptcy price</li>
<li><strong>Most concentrated:</strong> All BTC-only holders score 3/3 on concentration risk</li>
<li><strong>Liquidity concern:</strong> Large holders (MSTR, BMNR) would take 30+ days to exit at 1% daily volume</li>
</ul>\`;

renderTable();
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, '..', 'deliverable-a.html'), html);
console.log('Deliverable A written: ' + (html.length/1024).toFixed(1) + ' KB');
