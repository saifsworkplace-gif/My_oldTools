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

    const verdict = computeVerdictAndReasons({price,closes,ema20,ema50,ema200,rsi,macd,signal,hist,adx,pdi,mdi,quoteVol,highs,lows});

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
