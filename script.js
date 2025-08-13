/* ========= Helpers & constants ========= */
document.documentElement.dataset.theme='dark';
const qs=(s,el=document)=>el.querySelector(s), qsa=(s,el=document)=>[...el.querySelectorAll(s)];
const fmtNum=v=>isFinite(v)?Number(v).toFixed(2):'—';
const fmtVol=v=>isFinite(v)?Intl.NumberFormat().format(v):'—';
const fmtTime=ms=>{try{return new Date(ms).toLocaleString()}catch{return'—'}};

const DEFAULT_ROWS=[
  {name:'Avalanche',ticker:'AVAX',qty:115.51,entry:25.96,symbol:'AVAXUSDT',cg:'avalanche-2'},
  {name:'Injective',ticker:'INJ',qty:130.07,entry:15.345,symbol:'INJUSDT',cg:'injective-protocol'},
  {name:'Render',ticker:'RNDR',qty:215.624,entry:4.633,symbol:'RNDRUSDT',cg:'render-token'},
  {name:'ADX',ticker:'ADX',qty:9132,entry:0.1095,symbol:'ADXUSDT',cg:'adex'},
  {name:'HBAR',ticker:'HBAR',qty:3546.82,entry:0.28164,symbol:'HBARUSDT',cg:'hedera-hashgraph'},
];

const LS_KEY='portfolioRows_v2_saif';
const TF_KEY='indicatorTF_v1';
const TECH_TF_KEY='tech_tf_v1';
const TECH_TICKER_KEY='tech_ticker_v1';
const TECH_CFG_KEY='tech_cfg_v1';
const TECH_AUTO_KEY='tech_auto_v1';
const GFLT_KEY='gainers_filters_v1';

const CG_LOGOS={
  'avalanche-2':'https://assets.coingecko.com/coins/images/12559/small/coin-round-red.png',
  'injective-protocol':'https://assets.coingecko.com/coins/images/12882/small/INJ_Logo_Black.png',
  'render-token':'https://assets.coingecko.com/coins/images/11636/small/rndr.png',
  'adex':'https://assets.coingecko.com/coins/images/847/small/adex.png',
  'hedera-hashgraph':'https://assets.coingecko.com/coins/images/3688/small/hbar.png'
};

const tvLink=t=>`https://www.tradingview.com/chart/NGJkbIn7/?symbol=${encodeURIComponent((t||'BTC').toUpperCase().replace(/USDT$/,'')+'USDT')}`;

/* ========= Tabs ========= */
function setActive(hash){ qsa('.section').forEach(s=>s.classList.remove('active')); qs(hash)?.classList.add('active'); qsa('nav a').forEach(a=>a.classList.toggle('active', a.getAttribute('href')===hash)); if(location.hash!==hash) history.replaceState(null,'',hash); }
addEventListener('hashchange',()=>setActive(location.hash||'#portfolio'));

/* ========= Storage & API ========= */
function loadRows(){ try{ const saved=JSON.parse(localStorage.getItem(LS_KEY)); if(!Array.isArray(saved)||!saved.length){ localStorage.setItem(LS_KEY,JSON.stringify(DEFAULT_ROWS)); return DEFAULT_ROWS; } return saved; }catch{ localStorage.setItem(LS_KEY,JSON.stringify(DEFAULT_ROWS)); return DEFAULT_ROWS; } }
function saveRows(r){ localStorage.setItem(LS_KEY,JSON.stringify(r)); }
async function fetchPrice(sym){ const r=await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`); if(!r.ok) throw new Error('price'); const j=await r.json(); return +j.price; }
async function fetchKlines(sym,intv='1h',limit=200){ const r=await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${intv}&limit=${limit}`); if(!r.ok) throw new Error('kl'); const j=await r.json(); return j.map(k=>({t:+k[6],open:+k[1],high:+k[2],low:+k[3],close:+k[4]})); }
async function fetch24h(sym){ const r=await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`); if(!r.ok) throw new Error('24h'); return r.json(); }

/* ========= Indicators ========= */
const sma=(a,p)=>a.length<p?NaN:a.slice(-p).reduce((x,y)=>x+y,0)/p;
function emaLast(a,p){ if(a.length<p) return NaN; let e=sma(a.slice(0,p),p), k=2/(p+1); for(let i=p;i<a.length;i++) e=a[i]*k+e*(1-k); return e; }
function calcRSI(c,period=14){ if(c.length<period+1) return NaN; let g=0,l=0; for(let i=1;i<=period;i++){const d=c[i]-c[i-1]; if(d>=0) g+=d; else l-=d;} let ag=g/period, al=l/period; for(let i=period+1;i<c.length;i++){const d=c[i]-c[i-1]; const G=Math.max(d,0), L=Math.max(-d,0); ag=(ag*(period-1)+G)/period; al=(al*(period-1)+L)/period;} const rs=al===0?100:ag/al; return 100-(100/(1+rs)); }
function calcMACD(c,fast=12,slow=26,signal=9){
  if(c.length<slow+signal) return {macd:NaN,signal:NaN,hist:NaN};
  const ema=(a,p)=>{const k=2/(p+1); let v=a.slice(0,p).reduce((x,y)=>x+y,0)/p; for(let i=p;i<a.length;i++) v=a[i]*k+v*(1-k); return v;};
  const macdNow=ema(c,fast)-ema(c,slow);
  const macds=[]; for(let i=slow;i<c.length;i++){ const sub=c.slice(0,i+1); macds.push(ema(sub,fast)-ema(sub,slow)); }
  const last=macds.slice(-signal); const sig= last.length? last.reduce((a,b)=>a+b,0)/last.length : NaN;
  return {macd:macdNow,signal:sig,hist:macdNow-sig};
}
function calcADX(h,l,c,period=14){
  const n=Math.min(h.length,l.length,c.length); if(n<period*3) return {adx:NaN,pdi:NaN,mdi:NaN};
  const tr=[],pdm=[],mdm=[];
  for(let i=1;i<n;i++){ const up=h[i]-h[i-1], dn=l[i-1]-l[i];
    tr.push(Math.max(h[i]-l[i], Math.abs(h[i]-c[i-1]), Math.abs(l[i]-c[i-1])));
    pdm.push((up>dn&&up>0)?up:0); mdm.push((dn>up&&dn>0)?dn:0);}
  const rma=(a,p)=>{ let s=a.slice(0,p).reduce((x,y)=>x+y,0), v=s/p; for(let i=p;i<a.length;i++) v=(v*(p-1)+a[i])/p; return v; };
  const trR=rma(tr,period), pdR=rma(pdm,period), mdR=rma(mdm,period);
  const pdi=100*(pdR/trR), mdi=100*(mdR/trR);
  const dx=[]; let trS=tr.slice(0,period).reduce((x,y)=>x+y,0), pdS=pdm.slice(0,period).reduce((x,y)=>x+y,0), mdS=mdm.slice(0,period).reduce((x,y)=>x+y,0);
  let pdiS=100*(pdS/trS), mdiS=100*(mdS/trS); dx.push(100*Math.abs(pdiS-mdiS)/Math.max(1,(pdiS+mdiS)));
  for(let i=period;i<tr.length;i++){ trS=trS-tr[i-period]+tr[i]; pdS=pdS-pdm[i-period]+pdm[i]; mdS=mdS-mdm[i-period]+mdm[i]; pdiS=100*(pdS/trS); mdiS=100*(mdS/trS); dx.push(100*Math.abs(pdiS-mdiS)/Math.max(1,(pdiS+mdiS))); }
  let adx; if(dx.length<period) adx=NaN; else { adx=dx.slice(0,period).reduce((x,y)=>x+y,0)/period; for(let i=period;i<dx.length;i++) adx=(adx*(period-1)+dx[i])/period; }
  return {adx,pdi,mdi};
}
function calcATR(highs, lows, closes, period=14){
  const n = Math.min(highs.length, lows.length, closes.length);
  if(n < period+1) return NaN;
  const tr=[];
  for(let i=1;i<n;i++){
    const h=highs[i], l=lows[i], pc=closes[i-1];
    tr.push(Math.max(h-l, Math.abs(h-pc), Math.abs(l-pc)));
  }
  // Wilder’s smoothing
  let atr = tr.slice(0,period).reduce((a,b)=>a+b,0)/period;
  for(let i=period;i<tr.length;i++){
    atr = (atr*(period-1) + tr[i]) / period;
  }
  return atr;
}

/* ========= Rule parameters ========= */
const RULES = {
  minLiquidityUSD: 5_000_000,
  rsiBuyLow: 40, rsiBuyHigh: 60, rsiCross: 50,
  rsiSell: 45, rsiOverbought: 70,
  adxStrong: 20,
  // Exhaustion additions:
  extPct20: 0.06,     // price > EMA20 by 6%+
  extPct50: 0.12,     // price > EMA50 by 12%+
  resistLookback: 60, // bars to look back for recent swing high
  resistNearPct: 0.03,// within 3% of recent high
  wickWarnRatio: 0.60 // upper wick > 60% of candle range
};

/* ========= Pill helpers ========= */
const S = {GOOD:'good', BAD:'bad', NEU:'neutral'};
function statusRSI(rsi,cfg){ if(!isFinite(rsi)) return S.NEU; if(rsi>=70) return S.NEU; if(rsi>=cfg.rsiBuy) return S.GOOD; if(rsi<cfg.rsiSell) return S.BAD; return S.NEU; }
function statusMACD(macd,signal,hist){ if(!(isFinite(macd)&&isFinite(signal))) return S.NEU; if(hist>0&&macd>signal) return S.GOOD; if(hist<0&&macd<signal) return S.BAD; return S.NEU; }
function statusEMA(price,e20,e50,e200){ if(!isFinite(price)||!isFinite(e20)||!isFinite(e50)||!isFinite(e200)) return S.NEU; if(price>e20&&price>e50&&price>e200) return S.GOOD; if(price<e20&&price<e50&&price<e200) return S.BAD; return S.NEU; }
function statusDI(adx,pdi,mdi,thr){ if(!(isFinite(adx)&&isFinite(pdi)&&isFinite(mdi))) return S.NEU; if(adx>=thr && pdi>mdi) return S.GOOD; if(adx>=thr && mdi>pdi) return S.BAD; return S.NEU; }
function statusADX(adx,thr){ if(!isFinite(adx)) return S.NEU; return adx>=thr ? S.GOOD : S.NEU; }
const prevStatus={};
function flashIfChanged(key, pillEl, status){ const prev=prevStatus[key]; prevStatus[key]=status; if(!prev) return; if(prev!==status){ pillEl.classList.add('flash'); setTimeout(()=>pillEl.classList.remove('flash'), 650); } }

function drawSparkline(canvas, series){
  if(!canvas || !series || series.length<2){ if(canvas){canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);} return; }
  const ctx=canvas.getContext('2d'); const w=canvas.width, h=canvas.height;
  ctx.clearRect(0,0,w,h);
  const last = series.slice(-24); const min=Math.min(...last), max=Math.max(...last), range=(max-min)||1;
  ctx.beginPath();
  last.forEach((v,i)=>{ const x = (i/(last.length-1))*w; const y = h - ((v-min)/range)*h; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
  ctx.lineWidth=2; ctx.strokeStyle='#9fb0c6'; ctx.stroke();
}

/* ========= Config UI defaults ========= */
const defaultCfg=()=>({rsiBuy:55,rsiSell:45,adxStrong:25,alignWeight:1.2});
const getCfg=()=>{ try{return Object.assign(defaultCfg(), JSON.parse(localStorage.getItem(TECH_CFG_KEY)||'{}'));}catch{return defaultCfg()} };
const setCfg=cfg=>localStorage.setItem(TECH_CFG_KEY, JSON.stringify(Object.assign(defaultCfg(),cfg)));

/* ========= Step-2 helpers ========= */
function macdRecentBullCross(closes, lookback=3){
  for(let k=1;k<=lookback;k++){
    const a = calcMACD(closes.slice(0,-k),12,26,9);
    const b = calcMACD(closes.slice(0,-(k-1)),12,26,9);
    if(isFinite(a.macd)&&isFinite(a.signal)&&isFinite(b.macd)&&isFinite(b.signal)){
      if(a.macd<=a.signal && b.macd>b.signal) return true;
    }
  }
  return false;
}
function step2Checks({closes,rsi,macd,signal,hist,ema20,ema50,ema200,adx,pdi,mdi}){
  const checks=[];
  const rsiOk = (isFinite(rsi) && rsi>=RULES.rsiBuyLow && rsi<=RULES.rsiBuyHigh) ||
                (isFinite(rsi) && isFinite(calcRSI(closes.slice(0,-1),14)) && calcRSI(closes.slice(0,-1),14)<RULES.rsiCross && rsi>=RULES.rsiCross);
  checks.push({name:`RSI in 40–60 or crossed above 50`, ok: !!rsiOk});

  const macdOk = ((isFinite(hist) && hist>0) && (isFinite(macd)&&isFinite(signal)&&macd>signal)) || macdRecentBullCross(closes,3);
  checks.push({name:`MACD histogram > 0 & recent bullish cross`, ok: !!macdOk});

  const emaOk = isFinite(ema20)&&isFinite(ema50)&&isFinite(ema200) && (ema20>ema50&&ema50>ema200);
  checks.push({name:`EMA stack bullish (20 > 50 > 200)`, ok: !!emaOk});

  const adxOk = isFinite(adx) && adx>RULES.adxStrong && isFinite(pdi) && isFinite(mdi) && pdi>mdi;
  checks.push({name:`ADX > ${RULES.adxStrong} with +DI > -DI`, ok: !!adxOk});

  return {ok: checks.every(c=>c.ok), checks};
}

/* ========= Exhaustion helpers ========= */
function exhaustionChecks({closes,price,ema20,ema50,rsi,highs,lows}){
  const last=closes.at(-1);
  const lookbackHigh=Math.max(...closes.slice(-RULES.resistLookback));
  const nearRes = isFinite(lookbackHigh) && (lookbackHigh - last) / lookbackHigh <= RULES.resistNearPct && lookbackHigh >= last;

  // last candle wicks
  const H=highs.at(-1), L=lows.at(-1);
  const upperWick = isFinite(H)&&isFinite(last)&&isFinite(L) ? (H - Math.max(last, closes.at(-2) ?? last)) : 0;
  const range = isFinite(H)&&isFinite(L)? (H - L) : 1;
  const wickRatio = range>0 ? upperWick / range : 0;
  const bigWick = wickRatio >= RULES.wickWarnRatio;

  const ext20 = isFinite(price)&&isFinite(ema20) && price > ema20*(1+RULES.extPct20);
  const ext50 = isFinite(price)&&isFinite(ema50) && price > ema50*(1+RULES.extPct50);
  const overbought = isFinite(rsi) && rsi >= RULES.rsiOverbought;

  const checks=[
    {name:`Price extended > ${Math.round(RULES.extPct20*100)}% above EMA20`, ok: !ext20},
    {name:`Price extended > ${Math.round(RULES.extPct50*100)}% above EMA50`, ok: !ext50},
    {name:`RSI < ${RULES.rsiOverbought} (not overbought)`, ok: !overbought},
    {name:`Not near recent swing high (≤ ${Math.round(RULES.resistNearPct*100)}%)`, ok: !nearRes},
    {name:`No large upper wick on last candle`, ok: !bigWick}
  ];
  const anyFail = checks.some(c=>!c.ok);
  return {ok: !anyFail, checks, flags:{ext20,ext50,overbought,nearRes,bigWick}};
}

/* ========= Portfolio ========= */
async function renderPortfolio(){
  const rows=loadRows(), tbody=qs('#portfolioTable tbody'); tbody.innerHTML=''; const promises=[];
  rows.forEach((row,i)=>{
    const tr=document.createElement('tr'); tr.innerHTML=`
      <td data-label="Coin"><img class="logo" src="${CG_LOGOS[row.cg]||''}" alt=""> <input data-k="name" value="${row.name}" style="width:160px;"/></td>
      <td data-label="Ticker"><input data-k="ticker" value="${row.ticker}" style="width:90px;text-transform:uppercase;" placeholder="SOL"/></td>
      <td data-label="Qty" class="rightnum"><input data-k="qty" value="${row.qty}" style="width:110px;text-align:right;"/></td>
      <td data-label="Entry" class="rightnum"><input data-k="entry" value="${row.entry}" style="width:110px;text-align:right;"/></td>
      <td data-label="Live" class="rightnum" data-k="live">—</td>
      <td data-label="P&L" class="rightnum" data-k="pnl">—</td>
      <td data-label="P&L %" class="rightnum" data-k="pnlpct">—</td>
      <td data-label="RSI(14)" class="rightnum" data-k="rsi">—</td>
      <td data-label="MACD" class="rightnum" data-k="macd">—</td>
      <td data-label="S/R" class="rightnum" data-k="sr">—</td>
      <td data-label="Chart" data-k="chart"><a class="link" href="#" target="_blank" rel="noreferrer">Chart ↗</a></td>
      <td data-label="Remove" class="rightnum"><button class="xbtn" data-act="del">✕</button></td>`;
    tbody.appendChild(tr);
    qsa('input',tr).forEach(inp=>inp.addEventListener('change',()=>{
      const k=inp.dataset.k; let v=inp.value; if(k==='qty'||k==='entry') v=Number(v);
      const rowsLocal=loadRows(); // re-read to avoid stale refs
      rowsLocal[i][k]=v; if(k==='ticker') rowsLocal[i].symbol=v? (v.toUpperCase()+'USDT').replace(/USDTUSDT$/,'USDT') : '';
      localStorage.setItem(LS_KEY, JSON.stringify(rowsLocal));
      renderPortfolio();
    }));
    qs('[data-act="del"]',tr).addEventListener('click',()=>{ const rowsLocal=loadRows(); rowsLocal.splice(i,1); localStorage.setItem(LS_KEY, JSON.stringify(rowsLocal)); renderPortfolio(); });
    qs('[data-k="chart"] a',tr).href=tvLink(row.ticker||'');
    const p=(async()=>{
      const tf=localStorage.getItem(TF_KEY)||'4h', symbol=row.symbol || (row.ticker? (row.ticker.toUpperCase()+'USDT').replace(/USDTUSDT$/,'USDT') : '');
      if(!symbol) return {cost:0,value:0,pnl:0};
      try{
        const [price,kl]=await Promise.all([fetchPrice(symbol),fetchKlines(symbol,tf,300)]);
        qs('[data-k="live"]',tr).textContent=fmtNum(price);
        const qty=+row.qty||0, entry=+row.entry||0, cost=(qty*entry)||0, value=(qty*price)||0, pnl=value-cost, pnlPct=(entry>0)?((price-entry)/entry*100):NaN;
        const closes=kl.map(k=>k.close);
        const rsi=calcRSI(closes), {macd,signal}=calcMACD(closes);
        qs('[data-k="pnl"]',tr).textContent=isFinite(pnl)?((pnl>=0?'+':'')+fmtNum(pnl)):'—';
        qs('[data-k="pnl"]',tr).classList.toggle('good',pnl>=0&&isFinite(pnl));
        qs('[data-k="pnl"]',tr).classList.toggle('bad',pnl<0&&isFinite(pnl));
        const pctCell=qs('[data-k="pnlpct"]',tr);
        pctCell.textContent=isFinite(pnlPct)?(pnlPct>=0?'+':'')+fmtNum(pnlPct)+'%':'—';
        pctCell.classList.toggle('good',isFinite(pnlPct)&&pnlPct>=0);
        pctCell.classList.toggle('bad',isFinite(pnlPct)&&pnlPct<0);
        qs('[data-k="rsi"]',tr).textContent=fmtNum(rsi);
        qs('[data-k="macd"]',tr).textContent=(isFinite(macd)&&isFinite(signal))?`${fmtNum(macd)} / ${fmtNum(signal)}`:'—';
        return {cost,value,pnl};
      }catch{ qs('[data-k="live"]',tr).textContent='invalid'; qs('[data-k="live"]',tr).classList.add('bad'); return {cost:0,value:0,pnl:0}; }
    })();
    promises.push(p);
  });
  const res=await Promise.all(promises);
  const totCost=res.reduce((a,r)=>a+r.cost,0), totVal=res.reduce((a,r)=>a+r.value,0), tot=res.reduce((a,r)=>a+r.pnl,0);
  const pct=(totCost>0)?((totVal/totCost-1)*100):NaN;
  const tEl=qs('#totalPnL'), pEl=qs('#totalPnLPct');
  tEl.textContent=(tot>=0?'+':'')+fmtNum(tot); tEl.classList.toggle('good',tot>=0); tEl.classList.toggle('bad',tot<0);
  pEl.textContent=isFinite(pct)?((pct>=0?'+':'')+fmtNum(pct)+'%'):'—'; pEl.classList.toggle('good',isFinite(pct)&&pct>=0); pEl.classList.toggle('bad',isFinite(pct)&&pct<0);
  qs('#summary').textContent=`Cost: $${fmtNum(totCost)} · Value: $${fmtNum(totVal)}`;
}
qs('#addRow').addEventListener('click',()=>{const r=loadRows(); r.push({name:'New Coin',ticker:'',qty:0,entry:0,symbol:'',cg:''}); saveRows(r); renderPortfolio();});

/* ========= Gainers (with filters) ========= */
function loadGainerPrefs(){ try{ return Object.assign({minVol:'',minPrice:''}, JSON.parse(localStorage.getItem(GFLT_KEY)||'{}')); }catch{return {minVol:'',minPrice:''}} }
function saveGainerPrefs(p){ localStorage.setItem(GFLT_KEY, JSON.stringify(p)); }
async function loadGainers(){
  try{
    const prefs=loadGainerPrefs();
    qs('#gMinVol').value=prefs.minVol||'';
    qs('#gMinPrice').value=prefs.minPrice||'';
    const r=await fetch('https://api.binance.com/api/v3/ticker/24hr'), data=await r.json();
    const clean=data.filter(d=>d.symbol.endsWith('USDT') && !/(UP|DOWN|BULL|BEAR|[0-9]+L|[0-9]+S)/i.test(d.symbol));
    clean.sort((a,b)=>Number(b.priceChangePercent)-Number(a.priceChangePercent));
    let rows=clean;
    const minVol=Number(prefs.minVol||0), minPrice=Number(prefs.minPrice||0);
    rows=rows.filter(d=>(!minVol || Number(d.quoteVolume||0)>=minVol) && (!minPrice || Number(d.lastPrice)>=minPrice));
    const top=rows.slice(0,30), tbody=qs('#gainersTable tbody'); tbody.innerHTML='';
    top.forEach((d,i)=>{ const sym=d.symbol.replace('USDT',''), pct=Number(d.priceChangePercent);
      const tr=document.createElement('tr');
      tr.innerHTML=`<td class="rightnum">${i+1}</td>
        <td><span style="font-family:var(--font-mono)">${sym}</span></td>
        <td class="rightnum">${fmtNum(Number(d.lastPrice))}</td>
        <td class="rightnum"><span class="${pct>=0?'good':'bad'}">${pct>=0?'+':''}${fmtNum(pct)}%</span></td>
        <td class="rightnum">${fmtNum(Number(d.highPrice))}</td>
        <td class="rightnum">${fmtNum(Number(d.lowPrice))}</td>
        <td class="rightnum">${fmtVol(Number(d.quoteVolume||0))}</td>
        <td><a class="link" href="${tvLink(sym)}" target="_blank" rel="noreferrer">Chart ↗</a></td>`;
      tbody.appendChild(tr);
    });
    qs('#gainersError').textContent='';
  }catch{ const el=qs('#gainersError'); if(el) el.textContent='Failed to load gainers.'; }
}
qs('#gApply').addEventListener('click',()=>{ const p={minVol:qs('#gMinVol').value, minPrice:qs('#gMinPrice').value}; saveGainerPrefs(p); loadGainers(); });

/* ========= Verdict + Confidence + Step-2 + Exhaustion ========= */
function computeVerdictAndReasons({price,closes,ema20,ema50,ema200,rsi,macd,signal,hist,adx,pdi,mdi,quoteVol,highs,lows}){
  const baseReasons=[];
  const volOK = isFinite(quoteVol) && quoteVol >= RULES.minLiquidityUSD;

  const rsiPrev = calcRSI(closes.slice(0,-1),14);
  const rsiUp = isFinite(rsi) && isFinite(rsiPrev) && rsi > rsiPrev;
  const rsiInBuyBand = isFinite(rsi) && rsi >= 45 && rsi <= 65;
  const rsiCrossUp50 = isFinite(rsi) && isFinite(rsiPrev) && rsi >= 50 && rsiPrev < 50;

  const macdPrev = calcMACD(closes.slice(0,-1),12,26,9);
  const histRising = isFinite(hist) && isFinite(macdPrev.hist) && hist > macdPrev.hist;
  const macdBull = isFinite(macd) && isFinite(signal) && macd > signal && isFinite(hist) && hist > 0;

  const emaBull = isFinite(ema20)&&isFinite(ema50)&&isFinite(ema200) && (ema20>ema50&&ema50>ema200);
  const adxStrong = isFinite(adx) && adx >= RULES.adxStrong;
  const diBull = isFinite(pdi)&&isFinite(mdi) && pdi > mdi;

  const priceBelowAll = isFinite(price)&&isFinite(ema20)&&isFinite(ema50)&&isFinite(ema200) && (price<ema20&&price<ema50&&price<ema200);

  // Buy pillars (5)
  const buyChecks = [
    (rsiInBuyBand && rsiUp) || rsiCrossUp50,
    macdBull && histRising,
    emaBull,
    (adxStrong && diBull),
    volOK
  ];
  const confirmations = buyChecks.filter(Boolean).length;
  let buyConf = Math.round((confirmations/5)*100);

  // Bearish set (5)
  const rsiBear = isFinite(rsi) && (rsi < 45 || (rsi >= 70 && !rsiUp));
  const macdBear = isFinite(macd)&&isFinite(signal)&& macd < signal && isFinite(hist) && hist < 0 && isFinite(macdPrev.hist) && hist <= macdPrev.hist;
  const emaBear = isFinite(ema20)&&isFinite(ema50)&&isFinite(ema200) && (ema20<ema50&&ema50<ema200);
  const diBear = adxStrong && isFinite(pdi)&&isFinite(mdi) && mdi > pdi;

  const bearChecks = [rsiBear, macdBear, emaBear, diBear, priceBelowAll];
  const bearCount = bearChecks.filter(Boolean).length;
  let sellConf = Math.round((bearCount/5)*100);

  if(volOK) baseReasons.push(`Liquidity OK: $${fmtVol(quoteVol)} ≥ $${fmtVol(RULES.minLiquidityUSD)}`); else baseReasons.push(`Low liquidity: $${fmtVol(quoteVol)} < $${fmtVol(RULES.minLiquidityUSD)}`);
  if(rsiInBuyBand && rsiUp) baseReasons.push(`RSI ${fmtNum(rsi)} in 45–65 and rising`);
  if(rsiCrossUp50) baseReasons.push(`RSI crossed ↑ 50`);
  if(macdBull) baseReasons.push(`MACD > Signal & Hist > 0`);
  if(histRising) baseReasons.push(`MACD histogram rising`);
  if(emaBull) baseReasons.push(`EMA20 > EMA50 > EMA200`);
  if(adxStrong && diBull) baseReasons.push(`ADX ${fmtNum(adx)} strong; +DI > −DI`);
  if(priceBelowAll) baseReasons.push(`Price below all EMAs`);

  // Step-2 validation
  const s2 = step2Checks({closes,rsi,macd,signal,hist,ema20,ema50,ema200,adx,pdi,mdi});

  // Exhaustion layer (entry quality)
  const ex = exhaustionChecks({closes,price,ema20,ema50,rsi,highs,lows});
  const exReasons = ['— Exhaustion checks —', ...ex.checks.map(c=> (c.ok? '✅ ' : '⚠️ ') + c.name)];
  if(!ex.ok){
    // penalize bullish confidence if extended/late
    buyConf = Math.max(0, buyConf - 20);
  }

  // Confidence tier → rating (symmetric)
  let rating, conf;
  if (buyConf >= 85) { rating='Strong Buy'; conf=buyConf; }
  else if (sellConf >= 85) { rating='Strong Sell'; conf=sellConf; }
  else if (buyConf >= 70) { rating='Buy'; conf=buyConf; }
  else if (sellConf >= 70) { rating='Sell'; conf=sellConf; }
  else { rating='Neutral'; conf=Math.max(buyConf,sellConf); }

  // Step-2 gate
  if (rating==='Strong Buy' && !s2.ok) rating='Buy';
  if (rating==='Buy' && s2.ok && buyConf>=70) rating='Strong Buy';

  const reasons = [
    ...baseReasons,
    '— Step-2 checks —',
    ...s2.checks.map(c=> (c.ok? '✅ ' : '⚠️ ') + c.name),
    ...exReasons
  ];

  return {rating, confidence:conf, reasons, step2:s2.ok, exhaustion:ex};
}

function evaluateRowsForPills({price,ema20,ema50,ema200,rsi,macd,signal,hist,adx,pdi,mdi}){
  const cfg=getCfg();
  return [
    { id:'RSI', metric:'RSI(14)', value:fmtNum(rsi), note:`Buy ≥ ${cfg.rsiBuy}, Sell < ${cfg.rsiSell}`, status:statusRSI(rsi,cfg) },
    { id:'MACD', metric:'MACD(12,26,9)', value:(isFinite(macd)&&isFinite(signal))?`${fmtNum(macd)} / ${fmtNum(signal)}`:'—', note:'MACD > Signal bullish', status:statusMACD(macd,signal,hist) },
    { id:'EMA', metric:'EMA20 / EMA50 / EMA200', value:[ema20,ema50,ema200].map(fmtNum).join(' / '), note:`Price above = bullish; Align weight ${fmtNum(getCfg().alignWeight)}`, status:statusEMA(price,ema20,ema50,ema200) },
    { id:'DI', metric:'+DI / −DI', value:(isFinite(pdi)&&isFinite(mdi))?`${fmtNum(pdi)} / ${fmtNum(mdi)}`:'—', note:`Uses ADX strong ≥ ${getCfg().adxStrong}`, status:statusDI(adx,pdi,mdi,getCfg().adxStrong) },
    { id:'ADX', metric:'ADX(14)', value:fmtNum(adx), note:'Higher = stronger trend', status:statusADX(adx,getCfg().adxStrong) },
    { id:'Price', metric:'Price', value:fmtNum(price), note:'Binance last close', status:S.NEU },
  ];
}

/* ========= Technicals core ========= */
async function runTechnicals(){
  const tf=(qs('#techTf').value)||'1d';
  const tk=(qs('#techTicker').value||'BTC').toUpperCase().replace(/USDT$/,'');
  localStorage.setItem(TECH_TF_KEY,tf); localStorage.setItem(TECH_TICKER_KEY,tk);
  const symbol=tk+'USDT';

  try{
    const [kl,t24]=await Promise.all([fetchKlines(symbol,tf,500),fetch24h(symbol)]);
    if(!kl||!kl.length) throw new Error('No candles');

    const closes=kl.map(k=>k.close), highs=kl.map(k=>k.high), lows=kl.map(k=>k.low), last=kl.at(-1);
    const price=closes.at(-1);
    const quoteVol=Number(t24.quoteVolume||0);

    qs('#techStats').textContent=`Last: ${fmtNum(price)} · 24h High: ${fmtNum(Number(t24.highPrice))} · 24h Low: ${fmtNum(Number(t24.lowPrice))}`;

    const rsi=calcRSI(closes,14), {macd,signal,hist}=calcMACD(closes,12,26,9);
    const ema20=emaLast(closes,20), ema50=emaLast(closes,50), ema200=emaLast(closes,200);
    const {adx,pdi,mdi}=calcADX(highs,lows,closes,14);

    // Late-entry analysis (returns { level, parts, metrics })
    const le = checkLateEntry({ closes, highs, lows, price, ema20, ema50, rsi });

    const verdict = computeVerdictAndReasons({price,closes,ema20,ema50,ema200,rsi,macd,signal,hist,adx,pdi,mdi,quoteVol,highs,lows});

    // === Apply Late-Entry Caution effects to verdict/confidence ===
    if (le && le.level) {
      const downgradeOne = r =>
        (r==='Strong Buy') ? 'Buy' :
        (r==='Buy')       ? 'Neutral' :
        (r==='Neutral')   ? 'Sell' :
        (r==='Sell')      ? 'Strong Sell' : r;

      if (le.level === 'HIGH') {
        verdict.rating = 'Cautious — wait for pullback';
        verdict.confidence = Math.min(verdict.confidence ?? 0, 60);
      } else if (le.level === 'MEDIUM') {
        verdict.rating = downgradeOne(verdict.rating);
        verdict.confidence = Math.min(verdict.confidence ?? 0, 75);
      }
    }

    const card=qs('#verdictCard'); card.className='card verdict';
    if (verdict.rating==='Strong Buy') card.classList.add('strongbuy');
    else if (verdict.rating==='Buy') card.classList.add('buy');
    else if (verdict.rating==='Strong Sell') card.classList.add('strongsell');
    else if (verdict.rating==='Sell') card.classList.add('sell');
    else card.classList.add('neutral');

    qs('#techSummary').textContent=`${tk} · ${tf.toUpperCase()} · ${verdict.rating}`;
    qs('#techCounts').textContent = `Confidence: ${verdict.confidence}% • Step-2: ${verdict.step2?'Confirmed':'Failed'}`;
    qs('#techMeta').textContent=`Candles: ${kl.length} · Last close: ${fmtTime(last.t)} · 24h Vol(quote): $${fmtVol(quoteVol)} · Source: Binance ${symbol}`;
    qs('#techTV').innerHTML=`<a class="link" href="${tvLink(tk)}" target="_blank" rel="noreferrer">Open ${tk}USDT on TradingView ↗</a>`;
    drawSparkline(qs('#sparkClose'), closes);

    const tbody=qs('#techTable'); tbody.innerHTML='';
    const keyBase=`${tk}_${tf}`;
    evaluateRowsForPills({price,ema20,ema50,ema200,rsi,macd,signal,hist,adx,pdi,mdi}).forEach(r=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td class="sig"><span class="pill pill-${r.status}" data-pkey="${keyBase}_${r.id}"></span></td>
        <td>${r.metric}</td>
        <td class="rightnum">${r.value}</td>
        <td>${r.note}</td>`;
      tbody.appendChild(tr);
      const pill=tr.querySelector('.pill'); flashIfChanged(pill.dataset.pkey, pill, r.status);
    });

    const ul=qs('#techReasons'); ul.innerHTML='';
    verdict.reasons.forEach(t=>{const li=document.createElement('li'); li.textContent=t; ul.appendChild(li);});
  }catch(e){
    qs('#techSummary').textContent='Failed to compute technicals';
    qs('#techCounts').textContent=(e && e.message) ? e.message : '—';
    qs('#techMeta').textContent='Try a different ticker/timeframe and check network.';
    qs('#techTable').innerHTML='';
    qs('#techReasons').innerHTML='';
    qs('#techTV').innerHTML='';
    drawSparkline(qs('#sparkClose'), []);
    qs('#verdictCard').className='card verdict';
  }
}

/* ========= Scan helpers ========= */
function getPortfolioTickers(){ try{const rows=loadRows(); return [...new Set(rows.map(r=>r.ticker).filter(Boolean))]; }catch{return []} }
async function computeForTicker(tk, tf){
  const symbol=tk+'USDT';
  try{
    const [kl,t24]=await Promise.all([fetchKlines(symbol,tf,500),fetch24h(symbol)]);
    if(!kl||!kl.length) throw new Error('No candles');
    const closes=kl.map(k=>k.close), highs=kl.map(k=>k.high), lows=kl.map(k=>k.low);
    const price=closes.at(-1);
    const rsi=calcRSI(closes,14), {macd,signal,hist}=calcMACD(closes,12,26,9);
    const ema20=emaLast(closes,20), ema50=emaLast(closes,50), ema200=emaLast(closes,200);
    const {adx,pdi,mdi}=calcADX(highs,lows,closes,14);
    const quoteVol=Number(t24.quoteVolume||0);
    const verdict=computeVerdictAndReasons({price,closes,ema20,ema50,ema200,rsi,macd,signal,hist,adx,pdi,mdi,quoteVol,highs,lows});
    return {ok:true, tk, tf, verdict, price,rsi,macd,signal,hist,ema20,ema50,ema200,adx,pdi,mdi};
  }catch(err){ return {ok:false, tk, tf, error: (err && err.message) ? err.message : 'Error'}; }
}
function ratingBadge(r){ 
  const m=r==='Strong Buy'?'strongbuy':r==='Buy'?'buy':r==='Strong Sell'?'strongsell':r==='Sell'?'sell':'neutral'; 
  return `<span class="badge ${m}">${r}</span>`;
}
function pillsFor(o){ return evaluateRowsForPills(o).map(r=>`<span class="pill pill-${r.status}"></span>`).join(' '); }
async function scanPortfolio(){
  const tickers=getPortfolioTickers();
  const tf=(qs('#techTf').value)||'1d';
  const prog=qs('#scanProgress'); const list=qs('#scanResults');
  if(!tickers.length){ prog.textContent='No tickers in portfolio.'; list.innerHTML=''; return; }
  prog.textContent=`Scanning ${tickers.length} symbols…`; list.innerHTML='';
  qs('#scanPortfolio').setAttribute('disabled','true');
  let done=0;
  for(const tk of tickers){
    const res=await computeForTicker(tk.toUpperCase().replace(/USDT$/,''), tf);
    done++; prog.textContent=`${done}/${tickers.length} done`;
    const card=document.createElement('div'); card.className='mini';
    if(!res.ok){ card.innerHTML=`<div class="hdr"><span>${tk}</span><span class="badge neutral">Error</span></div><div class="muted">${res.error||'Failed'}</div>`; list.appendChild(card); continue; }
    card.innerHTML=`
      <div class="hdr">
        <span>${res.tk} · ${tf.toUpperCase()}</span>
        ${ratingBadge(res.verdict.rating)}
      </div>
      <div class="muted">Confidence: ${res.verdict.confidence}% • Step-2: ${res.verdict.step2?'Confirmed':'Failed'}</div>
      <div class="pillrow">${pillsFor(res)}</div>
      <a class="link" href="${tvLink(res.tk)}" target="_blank" rel="noreferrer" style="font-size:.92rem;">Open ${res.tk}USDT ↗</a>
    `;
    list.appendChild(card);
  }
  prog.textContent=`Scan complete. ${done}/${tickers.length}`;
  qs('#scanPortfolio').removeAttribute('disabled');
}

/* ========= Auto & init ========= */
let techTimer=null;
function scheduleTechAuto(){ try{ if(techTimer){ clearInterval(techTimer); techTimer=null; } }catch{} const sel=qs('#techAuto'); const mins=Number(sel?sel.value:0)||0; localStorage.setItem(TECH_AUTO_KEY,String(mins)); if(mins>0){ techTimer=setInterval(()=>{ if(location.hash==='#technicals'){ runTechnicals(); } }, mins*60000); } }
const tfSel=qs('#tfSelect'); tfSel.value=localStorage.getItem(TF_KEY)||'4h'; tfSel.addEventListener('change',()=>{ localStorage.setItem(TF_KEY,tfSel.value); renderPortfolio(); });
let refreshLock=false; qs('#refresh').addEventListener('click',()=>{ if(refreshLock) return; refreshLock=true; qs('#refresh').setAttribute('disabled','true'); renderPortfolio(); loadGainers(); setTimeout(()=>{ refreshLock=false; qs('#refresh').removeAttribute('disabled'); },2000); });
setInterval(()=>{ try{ loadGainers(); }catch{} }, 300000);

setActive(location.hash||'#portfolio'); renderPortfolio(); loadGainers();

// Technicals defaults + controls
const defTk=localStorage.getItem(TECH_TICKER_KEY)||(getPortfolioTickers()[0]||'BTC');
const defTf=localStorage.getItem(TECH_TF_KEY)||'1d';
const defAuto=localStorage.getItem(TECH_AUTO_KEY)||'30';
qs('#techTicker').value=defTk; qs('#techTf').value=defTf; qs('#techAuto').value=defAuto;
(function(){ const cfg=getCfg(); qs('#cfgRsiBuy').value=cfg.rsiBuy; qs('#cfgRsiSell').value=cfg.rsiSell; qs('#cfgAdx').value=cfg.adxStrong; qs('#cfgAlign').value=cfg.alignWeight; })();
qs('#saveCfg').addEventListener('click',()=>{ const cfg={ rsiBuy:+qs('#cfgRsiBuy').value||55, rsiSell:+qs('#cfgRsiSell').value||45, adxStrong:+qs('#cfgAdx').value||25, alignWeight:+qs('#cfgAlign').value||1.2 }; setCfg(cfg); runTechnicals(); });
qs('#resetCfg').addEventListener('click',()=>{ const cfg=defaultCfg(); setCfg(cfg); qs('#cfgRsiBuy').value=cfg.rsiBuy; qs('#cfgRsiSell').value=cfg.rsiSell; qs('#cfgAdx').value=cfg.adxStrong; qs('#cfgAlign').value=cfg.alignWeight; runTechnicals(); });
const applyPreset=(rsiBuy,rsiSell,adx,align)=>{ const cfg={rsiBuy,rsiSell,adxStrong:adx,alignWeight:align}; setCfg(cfg); qs('#cfgRsiBuy').value=rsiBuy; qs('#cfgRsiSell').value=rsiSell; qs('#cfgAdx').value=adx; qs('#cfgAlign').value=align; runTechnicals(); };
qs('#presetCon').addEventListener('click',()=>applyPreset(60,40,30,1.0));
qs('#presetBal').addEventListener('click',()=>applyPreset(55,45,25,1.2));
qs('#presetAgg').addEventListener('click',()=>applyPreset(50,40,20,1.4));
qs('#techAuto').addEventListener('change',scheduleTechAuto); scheduleTechAuto();
qs('#runTech').addEventListener('click',runTechnicals);
qs('#scanPortfolio').addEventListener('click',scanPortfolio);
qs('#toggleHelp').addEventListener('click',()=>qs('#helpPanel').classList.toggle('show'));

// === Late-Entry Caution (detailed) ===
// Rules: HIGH if any 2 buckets true; MEDIUM if exactly 1; else LOW.
// Buckets: (1) RSI stretch, (2) Overextension vs EMA/ATR, (3) MACD cooling, (4) R:R to S/R
function checkLateEntry({ closes, highs, lows, price, ema20, ema50, rsi }) {
  const el = document.getElementById('lateEntryMessage');
  if (!el) return;

  const fmt = v => (isFinite(v) ? Number(v).toFixed(2) : '—');

  // --- RSI rising 3 bars?
  const rsiM1 = calcRSI(closes.slice(0, -1), 14);
  const rsiM2 = calcRSI(closes.slice(0, -2), 14);
  const rsiM3 = calcRSI(closes.slice(0, -3), 14);
  const rising3 = [rsiM3, rsiM2, rsiM1, rsi].every(isFinite) && (rsiM2>rsiM3) && (rsiM1>rsiM2) && (rsi>rsiM1);

  // --- MACD histogram shrinking 2 bars, and bearish cross ≤3?
  const macd0 = calcMACD(closes, 12, 26, 9);
  const macd1 = calcMACD(closes.slice(0, -1), 12, 26, 9);
  const macd2 = calcMACD(closes.slice(0, -2), 12, 26, 9);
  const histShrinking2 = [macd0.hist, macd1.hist, macd2.hist].every(isFinite) && (macd0.hist<macd1.hist) && (macd1.hist<macd2.hist);
  const crossNow = [macd1.macd, macd1.signal, macd0.macd, macd0.signal].every(isFinite) && (macd1.macd>=macd1.signal) && (macd0.macd<macd0.signal);
  const crossPrev1 = [macd2.macd, macd2.signal, macd1.macd, macd1.signal].every(isFinite) && (macd2.macd>=macd2.signal) && (macd1.macd<macd1.signal);
  const bearishCross3 = crossNow || crossPrev1;

  // --- Overextension vs EMA/ATR
  const pctAbove50 = (isFinite(price)&&isFinite(ema50)&&ema50>0) ? ((price/ema50 - 1)*100) : NaN;
  const atr14 = calcATR(highs, lows, closes, 14);
  const above20xATR = (isFinite(price)&&isFinite(ema20)&&isFinite(atr14)) ? ((price-ema20) >= 2*atr14) : false;
  const ext50 = isFinite(pctAbove50) && pctAbove50 >= 10;

  // --- Nearest S/R (lookback 60)
  const look = 60;
  const recentRes = Math.max(...highs.slice(-look));
  const recentSup = Math.min(...lows.slice(-look));
  const distR = (isFinite(recentRes)&&isFinite(price)) ? ((recentRes-price)/price*100) : NaN;
  const distS = (isFinite(recentSup)&&isFinite(price)) ? ((price-recentSup)/price*100) : NaN;

  // --- 4 buckets
  const cond1 = (isFinite(rsi) && rsi>=70) || (isFinite(rsi) && rsi>=65 && rising3);      // RSI stretch
  const cond2 = !!(ext50 || above20xATR);                                               // Overextension
  const cond3 = !!(histShrinking2 || bearishCross3);                                    // Cooling
  const cond4 = (isFinite(distR)&&isFinite(distS) && distR<=2 && distS>=5);             // R:R bad

  let count=0; if(cond1)count++; if(cond2)count++; if(cond3)count++; if(cond4)count++;
  let level='LOW'; if(count>=2) level='HIGH'; else if(count===1) level='MEDIUM';

  // message
  const parts=[];
  if(cond1) parts.push(`RSI ${fmt(rsi)}${(rsi>=65 && rising3)?' (rising 3)':''}`);
  if(cond2) parts.push(`${isFinite(pctAbove50)?fmt(pctAbove50)+'% vs 50EMA':''}${above20xATR? (parts.length?', ':'')+'≥2×ATR over 20EMA':''}`);
  if(cond3) parts.push(`MACD hist shrinking${bearishCross3?' & bearish cross≤3':''}`);
  if(cond4) parts.push(`R ${fmt(distR)}% / S ${fmt(distS)}%`);

  if(level==='HIGH'){
    el.style.color = '#f6c74f';
    el.textContent = `Late-entry risk: HIGH — ${parts.join('; ')}`;
  }else if(level==='MEDIUM'){
    el.style.color = '#f6c74f';
    el.textContent = `Late-entry risk: MEDIUM — ${parts.join('; ') || 'one trigger'}`;
  }else{
    el.style.color = 'var(--good)';
    el.textContent = 'Late-entry risk: LOW — no stretch/cooling signals';
  }

  return { level, parts, metrics:{ pctAbove50, distR, distS, atr14 } };
}
async function getBinancePrice(symbol) {
  try {
    const res = await fetch(`/api/binance?endpoint=price&symbol=${symbol}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    console.log(`Price for ${symbol}:`, data.price);
    return data.price;
  } catch (err) {
    console.error("Error fetching Binance price:", err);
  }
}

// Example usage:
getBinancePrice("BTCUSDT");
/* ============================================================
   Trade Decision Panel: glue logic for live, plain-English UI
   Paste at the very bottom of script.js
   ============================================================ */

// --- small helpers ---
const TDP = {
  el(id){ return document.getElementById(id); },
  text(id, v){ const e = this.el(id); if (e) e.textContent = v; },
  fmt(n, d=2){ return (n==null || isNaN(n)) ? "—" : Number(n).toLocaleString(undefined,{maximumFractionDigits:d}); },
  pct(n){ return (n==null || isNaN(n)) ? "—" : `${Math.round(n)}%`; },
  clamp(n, lo=0, hi=100){ return Math.max(lo, Math.min(hi, n)); },
  diffPct(a,b){ return (a==null||b==null||b===0) ? null : ((a-b)/b)*100; }
};

// --- main entrypoint (preferred): call this with your computed analysis ---
/*
analysis = {
  symbol: "INJUSDT",
  timeframe: "1d",
  updatedAt: new Date().toISOString(),
  price: 14.42,

  // base confidence from your Step-1/Step-2 logic
  confidence: 78,

  indicators: {
    rsi14: 58.4,
    macd: { macd: 0.27, signal: 0.18, hist: 0.09, rising: true }, // rising = hist increasing
    ema20: 14.1, ema50: 13.4, ema200: 11.2,
    adx14: 23.6, plusDI: 26.2, minusDI: 20.7,
    volume24h: 13200000, volumeTrend: "steady" // "rising" | "falling" | "steady"
  },

  // Multi-timeframe flags (true=bullish, false=bearish, null=unknown)
  multiTF: { d1: true, h4: false, w1: true },

  // Trade map
  entry: { low: 14.3, high: 14.5 },
  targets: [15.2, 16.0],
  stop: 13.4,

  // Optional nearby levels
  resistance: [15.2, 16.0],
  support: [13.4]
};
*/
window.updateTradeDecisionPanel = function updateTradeDecisionPanel(d){
  // safety: if panel not present, skip
  if (!TDP.el("trade-decision")) return;

  // header bits
  TDP.text("tdp-title", `${d.symbol} — Technicals (${d.timeframe || "—"})`);
  TDP.text("tdp-updated", `Updated: ${d.updatedAt ? new Date(d.updatedAt).toLocaleString() : "—"}`);

  // compute adjusted readiness with clear reasons
  const reasons = [];
  let adjusted = Number(d.confidence ?? 0);

  // proximity to nearest resistance
  let nearResPct = null;
  if (Array.isArray(d.resistance) && d.resistance.length && d.price){
    nearResPct = d.resistance
      .map(r => Math.abs(TDP.diffPct(r, d.price)))
      .filter(v => v!=null)
      .sort((a,b)=>a-b)[0];
  }

  const rsi = d.indicators?.rsi14;
  const adx = d.indicators?.adx14;
  const plusDI = d.indicators?.plusDI;
  const minusDI = d.indicators?.minusDI;
  const macd = d.indicators?.macd;

  if (d.multiTF?.h4 === false){ adjusted -= 10; reasons.push("4H momentum weakening"); }
  if (nearResPct != null && nearResPct < 3){ adjusted -= 10; reasons.push("resistance is close"); }
  if (adx != null && adx < 20){ adjusted -= 10; reasons.push("trend strength is weak (ADX < 20)"); }
  if (rsi != null && rsi > 65){ adjusted -= 5; reasons.push("RSI is elevated (risk of pullback)"); }
  if (d.indicators?.volumeTrend === "rising"){ adjusted += 5; reasons.push("volume is improving"); }

  adjusted = TDP.clamp(Math.round(adjusted), 0, 100);

  // verdict tone
  let verdict = { label: "NO TRADE", tone: "tdp--avoid" };
  if (adjusted >= 75) verdict = { label: "BUY", tone: "tdp--buy" };
  else if (adjusted >= 55) verdict = { label: "HOLD / WAIT", tone: "tdp--wait" };
  else if (adjusted >= 35) verdict = { label: "AVOID FOR NOW", tone: "tdp--avoid" };

  // set badge + container tone
  const badge = TDP.el("tdp-verdict");
  if (badge){ badge.textContent = verdict.label; }
  const container = TDP.el("trade-decision");
  if (container){
    container.classList.remove("tdp--buy","tdp--wait","tdp--avoid");
    container.classList.add(verdict.tone);
  }

  // base confidence + reasons
  const readCard = TDP.el("tdp-readiness");
  if (readCard){
    readCard.querySelector("p").textContent = `Base confidence: ${TDP.pct(d.confidence)}`;
    const ul = TDP.el("tdp-readiness-reasons");
    if (ul){
      ul.innerHTML = "";
      reasons.forEach(r => {
        const li = document.createElement("li");
        li.textContent = `Adjustment: ${r}`;
        ul.appendChild(li);
      });
    }
  }

  // multi-timeframe flags
  TDP.text("tdp-alignment-flags",
    `1D: ${flag(d.multiTF?.d1)}  •  4H: ${flag(d.multiTF?.h4)}  •  1W: ${flag(d.multiTF?.w1)}`
  );
  TDP.text("tdp-alignment-context", contextLine());

  // RSI explanation
  TDP.text("tdp-rsi-text", rsiExplain(rsi));

  // MACD explanation
  TDP.text("tdp-macd-text", macdExplain(macd));

  // EMA structure
  TDP.text("tdp-ema-text", emaExplain(d.indicators?.ema20, d.indicators?.ema50, d.indicators?.ema200));

  // ADX/DI explanation
  TDP.text("tdp-adx-text", adxExplain(adx, plusDI, minusDI));

  // Trade map
  TDP.text("tdp-price", `$${TDP.fmt(d.price)}`);
  TDP.text("tdp-entry", (d.entry && d.entry.low!=null && d.entry.high!=null) ? `$${TDP.fmt(d.entry.low)} - $${TDP.fmt(d.entry.high)}` : "—");
  const t1 = d.targets?.[0];
  TDP.text("tdp-t1", t1!=null ? `$${TDP.fmt(t1)}` : "—");
  TDP.text("tdp-stop", d.stop!=null ? `$${TDP.fmt(d.stop)}` : "—");
  const rr = (t1!=null && d.stop!=null && d.price!=null) ? ((t1 - d.price) / Math.max(0.0000001,(d.price - d.stop))) : null;
  TDP.text("tdp-rr", rr!=null && isFinite(rr) ? `R:R (to T1): ${rr.toFixed(2)}x` : "R:R (to T1): —");

  // Risks
  const risks = [];
  if (rsi != null && rsi > 65) risks.push("RSI is high; momentum may be extended.");
  if (nearResPct != null && nearResPct < 3) risks.push("Nearest resistance is very close; initial breakout attempts can fail.");
  if (adx != null && adx < 20) risks.push("ADX is low; trend strength is weak.");
  if (macd && macd.rising === false) risks.push("MACD momentum is flattening; short-term follow-through may be limited.");
  const riskUL = TDP.el("tdp-risks-list");
  if (riskUL){
    riskUL.innerHTML = "";
    risks.forEach(r => { const li = document.createElement("li"); li.textContent = r; riskUL.appendChild(li); });
    if (risks.length === 0){ const li = document.createElement("li"); li.textContent = "No immediate red flags."; riskUL.appendChild(li); }
  }

  // Context Snapshot
  const inZone = d.entry && d.price!=null && d.entry.low!=null && d.entry.high!=null && d.price >= d.entry.low && d.price <= d.entry.high;
  const parts = [];
  parts.push(d.multiTF?.d1 ? "Daily trend is supportive" : "Daily trend is mixed");
  parts.push(d.multiTF?.w1 ? "weekly backdrop is constructive" : "weekly backdrop is mixed");
  if (d.multiTF?.h4 === false) parts.push("but 4H momentum is soft");
  if (nearResPct != null) parts.push(`nearest resistance ~${nearResPct.toFixed(1)}% away`);
  parts.push(inZone ? "price is inside entry zone" : "price is outside entry zone");
  TDP.text("tdp-context-text", parts.join(", ") + (d.stop!=null ? `. Consider a stop near $${TDP.fmt(d.stop)}.` : "."));

  // --- local helpers for text blocks ---
  function flag(v){ return v===true ? "OK" : v===false ? "X" : "—"; }
  function contextLine(){ 
    const s = [];
    if (d.multiTF?.d1 === true) s.push("1D supportive"); else if (d.multiTF?.d1 === false) s.push("1D weak");
    if (d.multiTF?.h4 === true) s.push("4H supportive"); else if (d.multiTF?.h4 === false) s.push("4H soft");
    if (d.multiTF?.w1 === true) s.push("1W constructive"); else if (d.multiTF?.w1 === false) s.push("1W weak");
    if (nearResPct != null) s.push(`resistance ~${nearResPct.toFixed(1)}%`);
    return s.length ? s.join(" · ") : "—";
  }
  function rsiExplain(v){
    if (v==null) return "RSI data missing.";
    if (v < 40) return `RSI ${TDP.fmt(v)} - in a weaker zone; buyers not in control yet.`;
    if (v < 55) return `RSI ${TDP.fmt(v)} - neutral to mildly bullish; momentum building, not stretched.`;
    if (v <= 65) return `RSI ${TDP.fmt(v)} - comfortably bullish with room before overbought.`;
    return `RSI ${TDP.fmt(v)} - elevated; risk of short-term pullback above 65.`;
    }
  function macdExplain(m){
    if (!m) return "MACD data missing.";
    const side = m.macd >= m.signal ? "positive" : "negative";
    const trend = m.rising ? "rising" : "cooling";
    return `MACD is ${side} and ${trend}; this reflects ${side==="positive"?"buying":"selling"} pressure ${m.rising?"improving":"fading"}.`;
  }
  function emaExplain(e20, e50, e200){
    if (e20==null || e50==null || e200==null) return "EMA data missing.";
    return (e20>e50 && e50>e200)
      ? "EMA stack 20 > 50 > 200 confirms an established uptrend structure."
      : "EMA stack is not aligned; trend structure is mixed, expect choppier moves.";
  }
  function adxExplain(a, p, m){
    if (a==null || p==null || m==null) return "ADX/DI data missing.";
    const lead = p > m ? "buyers" : "sellers";
    const strength = a < 20 ? "weak" : a < 25 ? "borderline" : a < 30 ? "moderate" : "strong";
    return `ADX ${TDP.fmt(a)} with +DI ${TDP.fmt(p)} vs -DI ${TDP.fmt(m)}: ${lead} in control; trend strength is ${strength}.`;
  }
};

// --- optional: if your pipeline dispatches a DOM event with the analysis, we update automatically ---
// somewhere in your code after computing analysis, you can do:
//   document.dispatchEvent(new CustomEvent("tech:analysis", { detail: analysis }));
document.addEventListener("tech:analysis", (e) => {
  if (e?.detail) window.updateTradeDecisionPanel(e.detail);
});

// --- fallback: try to SCRAPE current Technicals UI to build a minimal analysis object ---
function scrapeAndUpdateTDP(){
  if (!document.getElementById("trade-decision")) return;

  // symbol/timeframe
  const symbol = (document.getElementById("techTicker")?.value || "").toUpperCase() || "—";
  const timeframe = document.getElementById("techTf")?.value || "—";

  // last price from header "Last: X · 24h High: ..."
  const stats = document.getElementById("techStats")?.textContent || "";
const lastMatch = /Last:\s*([0-9.]+)/i.exec(stats);
  const price = lastMatch ? Number(lastMatch[1]) : null;

  // parse tech table
  // we expect <tbody id="techTable"><tr>...<td>Metric</td><td class="rightnum">Value</td><td>Note</td>
  // rows under the technicals table
const rows = Array.from(document.querySelectorAll("#techTable tr"));

// normalize label text so "EMA 20", "ema20", "EMA20 / EMA50" all match
const norm = s => (s || "").toLowerCase().replace(/[^a-z0-9+\-\/()]/g, "");

// pull all numbers from a text (as Numbers)
const nums = t => (t.match(/[0-9.]+/g) || []).map(Number);

// find a row by fuzzy label include
const findRow = (needle) => {
  const n = norm(needle);
  return rows.find(r => norm(r.children?.[1]?.textContent).includes(n)) || null;
};

// simple cell helpers
const cellText = (r, i) => (r?.children?.[i]?.textContent || "").trim();


// --- pull individual indicators from the table ---
const rsiRow  = findRow("rsi");
const macdRow = findRow("macd");

// EMA row is combined in your UI: "EMA20 / EMA50 / EMA200   13.73 / 13.13 / 13.72   1.20"
const emaRow  = findRow("ema20/ema50/ema200");

// +DI / -DI is combined
const diRow   = findRow("+di/-di");

// ADX(14) row
const adxRow  = findRow("adx(14)");

// parse values safely
const rsi14   = rsiRow  ? nums(cellText(rsiRow, 2))[0]  : undefined;

// MACD: we’ll infer “rising” from the note if present, and read numbers if available
let macd = undefined, signal = undefined, hist = undefined, macdRising = undefined;
if (macdRow) {
  const arr = nums(cellText(macdRow, 2));  // e.g. "0.27 / 0.18" or "0.01 / 0.01"
  macd    = arr[0];
  signal  = arr[1];
  hist    = (macd !== undefined && signal !== undefined) ? (macd - signal) : undefined;
  macdRising = /rising|bull/i.test(cellText(macdRow, 3));
}

// EMAs: first 3 numbers are 20/50/200, a 4th number (if present) is your align weight
let ema20 = undefined, ema50 = undefined, ema200 = undefined, maAlign = undefined;
if (emaRow) {
  const arr = nums(cellText(emaRow, 2));
  [ema20, ema50, ema200, maAlign] = [arr[0], arr[1], arr[2], arr[3]];
}

// DI pair
let plusDI = undefined, minusDI = undefined;
if (diRow) {
  const arr = nums(cellText(diRow, 2));
  [plusDI, minusDI] = [arr[0], arr[1]];
}

// ADX
const adx14 = adxRow ? nums(cellText(adxRow, 2))[0] : undefined;

  const analysis = {
  symbol, timeframe,
  updatedAt: new Date().toISOString(),
  price,
  confidence: inferBaseConfidence() ?? 60,  // default if we can’t find it
  indicators: {
    rsi14,
    macd: macd !== undefined ? { macd, signal, hist, rising: macdRising ?? null } : undefined,
    ema20, ema50, ema200, maAlign,
    adx14, plusDI, minusDI,
    volumeTrend: "steady"
  },
  // multi-timeframe placeholders (until you wire 4h/1w fetch)
  multiTF: { d1: null, h4: null, w1: null },

  // Trade map defaults (safe, based on current price if we have it)
  entry:  (price != null) ? { low: price * 0.98, high: price * 1.01 } : { low: null, high: null },
  targets:(price != null) ? [price * 1.05] : [],
  stop:   (price != null) ? price * 0.96 : null,
  resistance: [], support: []
};


  window.updateTradeDecisionPanel(analysis);
stopTDPLoaders(); // hide skeletons once content is filled

  function inferBaseConfidence() {
  // search specific spots first
  const parts = [
    document.getElementById("techMeta")?.textContent || "",
    document.getElementById("techSummary")?.textContent || "",
    document.getElementById("verdictCard")?.textContent || ""
  ].join(" ");

  // fallback to page text if needed
  const hay = (parts.trim() ? parts : document.body.textContent || "");

  const m = hay.match(/confidence[:\s]+(\d{1,3})/i);
  return m ? parseInt(m[1]) : null;
}

}
// --- trigger the Trade Decision Panel update whenever Analyze runs ---
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('runTech');
  if (!btn) return;

  btn.addEventListener('click', () => {
    // wait for the table/ui to render, then scrape it
    setTimeout(() => {
      if (typeof window.scrapeAndUpdateTDP === 'function') {
        window.scrapeAndUpdateTDP();
      }
    }, 50);
  });
});
/* ------------------------------
   Extra wiring + console summary
   ------------------------------ */

// Helper: pretty console line so we can verify quickly after deploy
function logTradeSummaryFromPanel() {
  const $ = (id) => document.getElementById(id);
  const title = $('tdp-title')?.textContent?.trim() || '—';
  const badge = $('tdp-verdict')?.textContent?.trim() || '—';

  // Read cards (they all exist in the panel shell)
  const rsiTxt   = $('tdp-rsi')?.textContent?.replace(/\s+/g,' ') || '—';
  const macdTxt  = $('tdp-macd')?.textContent?.replace(/\s+/g,' ') || '—';
  const emaTxt   = $('tdp-ema')?.textContent?.replace(/\s+/g,' ') || '—';
  const adxTxt   = $('tdp-adxdi')?.textContent?.replace(/\s+/g,' ') || '—';
  const mapPrice = $('tdp-price')?.textContent?.trim() || '—';
  const mapEntry = $('tdp-entry')?.textContent?.trim() || '—';
  const mapT1    = $('tdp-t1')?.textContent?.trim() || '—';
  const mapStop  = $('tdp-stop')?.textContent?.trim() || '—';

  // Short, human line
  const line = `[TDP] ${title} → ${badge} | RSI: ${rsiTxt} | MACD: ${macdTxt} | EMA: ${emaTxt} | ADX/DI: ${adxTxt} | Map: P=${mapPrice}, Entry=${mapEntry}, T1=${mapT1}, Stop=${mapStop}`;
  console.log(line);
}

// Safe wrapper: run the scraper if present, then log
function runTDPNow() {
  if (typeof window.scrapeAndUpdateTDP === 'function') {
    try {
      window.scrapeAndUpdateTDP();
      // give the panel a tick to render
      setTimeout(logTradeSummaryFromPanel, 30);
    } catch (e) {
      console.warn('scrapeAndUpdateTDP() failed:', e);
    }
  }
}

/* A) After Analyze — you already wired this, but keeping as guard */
document.getElementById('runTech')?.addEventListener('click', () => {
  // run after UI finishes
  startTDPLoaders();
  setTimeout(runTDPNow, 50);
  setTimeout(loadTechChart, 60);
});

/* B) Also run when timeframe changes */
document.getElementById('techTf')?.addEventListener('change', () => {
  // if your code re-renders on change, wait a moment then scrape
  startTDPLoaders();
  setTimeout(runTDPNow, 150);
  setTimeout(loadTechChart, 120);
});

/* C) Run when user hits Enter in ticker box */
document.getElementById('techTicker')?.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') {
    // allow your existing Analyze handler to do its work first
    startTDPLoaders();
    setTimeout(runTDPNow, 150);
    if (ev.key === 'Enter') setTimeout(loadTechChart, 120);
  }
});

/* D) Failsafe: if the tech table body changes, scrape once */
(() => {
  const tbody = document.getElementById('techTable');
  if (!tbody || !('MutationObserver' in window)) return;
  const obs = new MutationObserver((muts) => {
    // debounce a bit in case multiple rows update
    clearTimeout(tbody.__tdpDebounce);
    startTDPLoaders();
    tbody.__tdpDebounce = setTimeout(runTDPNow, 120);
  });
  obs.observe(tbody, { childList: true, subtree: true, characterData: true });
})();
/* ================================
   TDP quick fix: retry + fallbacks
   ================================ */

// 1) tiny helpers (global-ish via window so we don’t collide)
(function () {
  if (!('MutationObserver' in window)) return; // old browsers: skip (safe)
  window.__tdpRetries = 0;
  window.__tdpMaxRetries = 5;
  window.__tdpBackoffMs = 250;

  window.__tdpFirstNum = function __tdpFirstNum(s) {
    const m = String(s ?? '').match(/-?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : undefined;
  };

  window.__tdpSchedule = function __tdpSchedule() {
    const n = Math.min(window.__tdpMaxRetries, Math.max(1, window.__tdpRetries));
    const delay = window.__tdpBackoffMs * n; // 250ms, 500ms, 750ms…
    setTimeout(() => {
      if (typeof window.scrapeAndUpdateTDP === 'function') {
        window.scrapeAndUpdateTDP(true); // “retry” flag
      }
    }, delay);
  };
})();

// 2) wrap the existing scraper with a “ready” check.
//    add this guard at the TOP of your scrapeAndUpdateTDP() body if you can.
//    if you’re not comfortable editing inside, this outer monkey-patch works.
(function () {
  if (typeof window.scrapeAndUpdateTDP !== 'function') return;

  const __orig = window.scrapeAndUpdateTDP;
  window.scrapeAndUpdateTDP = function (fromRetry = false) {
    // run original once to ensure it builds the table if that’s what it does
    // (no-op if your original already expects DOM to be ready)
    try { /* don’t block on errors */ } catch {}

    // check the 5 key rows; if missing, retry quietly
    const tbody = document.getElementById('techTable');
    const rows = Array.from(tbody ? tbody.querySelectorAll('tr') : []);
    const get = (needle) => rows.find(r =>
      (r.children?.[1]?.textContent || '').toLowerCase().replace(/[^a-z0-9+\-\/()]/g,'')
        .includes(needle)
    );

    const rsiRow = get('rsi');
    const macdRow = get('macd');
    const emaRow  = get('ema20/ema50/ema200');
    const diRow   = get('+di/-di');
    const adxRow  = get('adx(14)');

    const ready = !!(rsiRow && macdRow && emaRow && diRow && adxRow);

    if (!ready) {
      if (window.__tdpRetries < window.__tdpMaxRetries) {
        window.__tdpRetries++;
        // light debug only (won’t spam red)
        console.debug(`[TDP] waiting for indicators… retry ${window.__tdpRetries}/${window.__tdpMaxRetries}`);
        window.__tdpSchedule();
        return;
      } else {
        console.debug('[TDP] rendering with partial data (indicators incomplete after retries)');
      }
    } else {
      if (window.__tdpRetries) window.__tdpRetries = 0;
    }

    // run your original scraper (it will parse whatever exists; use safe defaults inside)
    try {
      __orig.apply(this, arguments);
    } catch (e) {
      console.warn('[TDP] scrape failed but continuing:', e?.message || e);
    }
  };
})();

// 3) auto-trigger after Analyze (you already added this; keeping as guard)
document.getElementById('runTech')?.addEventListener('click', () => {
  setTimeout(() => {
    if (typeof window.scrapeAndUpdateTDP === 'function') window.scrapeAndUpdateTDP();
  }, 60);
});

// 4) also refresh TDP when timeframe changes or user hits Enter in ticker
document.getElementById('techTf')?.addEventListener('change', () => {
  setTimeout(() => window.scrapeAndUpdateTDP && window.scrapeAndUpdateTDP(), 150);
});
document.getElementById('techTicker')?.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') setTimeout(() => window.scrapeAndUpdateTDP && window.scrapeAndUpdateTDP(), 150);
});
/* ========= Simple section loader for Technicals ========= */
// Where we’ll show the loader (the new Trade Decision panel). If it’s missing,
// we fall back to the big “verdictCard”.
function getTechnicalsContainer() {
  return document.getElementById('trade-decision') ||
         document.getElementById('verdictCard');
}

function showTechnicalsLoader(on = true) {
  const host = getTechnicalsContainer();
  if (!host) return;

  // mark busy for a11y
  host.setAttribute('aria-busy', on ? 'true' : 'false');

  // add/remove loader spinner
  let spinner = host.querySelector('.tdp-loader');
  if (on) {
    if (!spinner) {
      spinner = document.createElement('div');
      spinner.className = 'tdp-loader';
      host.appendChild(spinner);
    }
    // also visually dim immediate cards in the grid to signal “loading”
    const cards = host.closest('.card')?.parentElement?.querySelectorAll('.card');
    cards?.forEach(c => c.classList.add('is-loading'));
  } else {
    spinner?.remove();
    const cards = host.closest('.card')?.parentElement?.querySelectorAll('.card');
    cards?.forEach(c => c.classList.remove('is-loading'));
  }
}
// ===== TradingView chart helpers =====
function tvInterval(tf) {
  // map your TF selector to TV intervals
  switch ((tf || '1d')) {
    case '1h': return '60';
    case '4h': return '240';
    case '1d': default: return 'D';
  }
}
function tvSymbolFromTicker(t) {
  if (!t) return null;
  const sym = t.trim().toUpperCase();
  // default to Binance USDT pair: INJ -> BINANCE:INJUSDT
  if (sym.includes(':')) return sym;              // already a TV symbol
  return `BINANCE:${sym}USDT`;
}

function loadTechChart() {
  const container = document.getElementById('tv_chart_container');
  if (!container || typeof TradingView === 'undefined') return;

  const t  = document.getElementById('techTicker')?.value?.trim().toUpperCase() || '';
  const tf = document.getElementById('techTf')?.value || '1d';
  const symbol = tvSymbolFromTicker(t);
  if (!symbol) return;

  // tiny label like “INJUSDT · 1d”
  const pair = symbol.replace('BINANCE:','');
  const lbl = document.getElementById('chartPairLabel');
  if (lbl) lbl.textContent = `${pair} · ${tf}`;

  // rebuild widget each time (simple + robust)
  container.innerHTML = '';
  new TradingView.widget({
    container_id: "tv_chart_container",
    symbol: symbol,
    interval: tvInterval(tf),
    width: "100%",
    height: 320,
    theme: "dark",
    style: "1",
    timezone: "Etc/UTC",
    locale: "en",
    hide_top_toolbar: true,
    hide_legend: true,
    allow_symbol_change: false,
    save_image: false,
  });
}
