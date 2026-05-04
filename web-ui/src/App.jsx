import { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

/* ─── helpers ────────────────────────────────────────────── */
function clsx(...c) { return c.filter(Boolean).join(' '); }

const PHASES = ['Initializing…', 'Map Phase', 'Reduce Phase', 'Collecting Results', 'Cleaning up'];

const BAR_COLORS = ['#00FF41','#FF00FF','#FFD700','#00CFFF','#FF3A3A','#FF8C00','#39FF14','#FF69B4'];

/* ─── Pixel spinner (blinking blocks) ───────────────────── */
function PixelSpinner() {
  const [frame, setFrame] = useState(0);
  const frames = ['█░░░','░█░░','░░█░','░░░█'];
  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f + 1) % frames.length), 150);
    return () => clearInterval(t);
  }, []);
  return <span className="text-primary text-glow-green font-pixel text-xs">{frames[frame]}</span>;
}

/* ─── Custom tooltip for recharts ───────────────────────── */
function PixelTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="pixel-box px-3 py-2">
      <p className="font-pixel text-[9px] text-accent">{payload[0].payload.word}</p>
      <p className="font-pixel text-[9px] text-primary mt-1">COUNT: {payload[0].value}</p>
    </div>
  );
}

/* ─── Main App ───────────────────────────────────────────── */
export default function App() {
  const [file, setFile]           = useState(null);
  const [mappers, setMappers]     = useState(6);
  const [reducers, setReducers]   = useState(2);
  const [jobId, setJobId]         = useState(null);
  const [jobState, setJobState]   = useState('idle');
  const [logs, setLogs]           = useState([]);
  const [phase, setPhase]         = useState('');
  const [results, setResults]     = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [score, setScore]         = useState(0);
  const logsEndRef                = useRef(null);

  // auto-scroll logs
  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  // bump score on each log
  useEffect(() => { if (logs.length) setScore(s => s + 10); }, [logs.length]);

  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
  };

  const handleRunJob = async () => {
    if (!file) return;
    setJobState('running');
    setLogs([]);
    setPhase('Uploading file…');
    setResults([]);
    setScore(0);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('mappers', mappers);
    fd.append('reducers', reducers);

    try {
      const res  = await fetch('http://localhost:3001/api/run-job', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setJobId(data.jobId);
    } catch (err) {
      setJobState('error');
      setPhase(err.message);
    }
  };

  useEffect(() => {
    if (!jobId || jobState === 'error') return;
    const src = new EventSource(`http://localhost:3001/api/job-stream/${jobId}`);
    src.onmessage = (e) => {
      const log = JSON.parse(e.data);
      setLogs(prev => [...prev, log]);
      if (log.type === 'phase')   { setPhase(log.message); }
      else if (log.type === 'success') {
        setJobState('success');
        setPhase('JOB COMPLETE');
        setResults(log.data || []);
        setScore(s => s + 5000);
        src.close();
      } else if (log.type === 'error') {
        setJobState('error');
        setPhase('ERROR');
        src.close();
      }
    };
    src.onerror = () => { setJobState('error'); setPhase('CONNECTION LOST'); src.close(); };
    return () => src.close();
  }, [jobId]);

  const filtered = searchQuery
    ? results.filter(r => r.word.includes(searchQuery.toLowerCase()))
    : results;

  const progressWidth = phase.includes('Map') ? '33%'
    : phase.includes('Reduce') ? '60%'
    : phase.includes('Collect') ? '85%'
    : phase.includes('Clean') ? '95%'
    : jobState === 'running' ? '8%' : '100%';

  return (
    <div className="crt min-h-screen bg-background flex flex-col items-center py-8 px-4">

      {/* CRT scanline beam */}
      <div className="scanline-beam" />

      {/* Ticker tape */}
      <div className="ticker-wrap w-full mb-6">
        <span className="ticker-content">
          ★ MAPREDUCE VISUALIZER v1.0 ★ INSERT FILE TO PLAY ★ HIGH SCORE: {score.toString().padStart(6,'0')} ★ POWERED BY DOCKER + JAVA ★ &nbsp;&nbsp;&nbsp;
          ★ MAPREDUCE VISUALIZER v1.0 ★ INSERT FILE TO PLAY ★ HIGH SCORE: {score.toString().padStart(6,'0')} ★ POWERED BY DOCKER + JAVA ★
        </span>
      </div>

      <div className="max-w-3xl w-full space-y-6">

        {/* ── Header ── */}
        <div className="pixel-box p-5 text-center space-y-2">
          <div className="font-pixel text-[10px] text-secondary text-glow-pink tracking-widest">* STAGE 01 *</div>
          <h1 className="font-pixel text-primary text-glow-green leading-loose text-sm md:text-xl">
            MAP<span className="text-secondary">REDUCE</span><br/>
            <span className="text-accent text-glow-gold">WORD COUNT</span>
          </h1>
          <div className="font-pixel text-[9px] text-info">
            SCORE: <span className="text-accent">{score.toString().padStart(6,'0')}</span>
            &nbsp;|&nbsp;
            MAPPERS: <span className="text-primary">{mappers}</span>
            &nbsp;|&nbsp;
            REDUCERS: <span className="text-secondary">{reducers}</span>
          </div>
        </div>

        {/* ── IDLE: upload panel ── */}
        {jobState === 'idle' && (
          <div className="space-y-4 animate-in fade-in duration-300">

            {/* Drop zone */}
            <div
              className={clsx(
                'pixel-box p-8 text-center cursor-pointer transition-all duration-150',
                file ? 'border-accent shadow-pixel-glow-gold' : 'hover:border-info'
              )}
              onDragOver={e => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => document.getElementById('file-upload').click()}
            >
              <input type="file" id="file-upload" className="hidden" accept=".txt"
                onChange={e => setFile(e.target.files[0])} />

              <div className="font-pixel text-4xl mb-3 leading-none">
                {file ? '📄' : '💾'}
              </div>
              <p className="font-pixel text-[9px] text-primary">
                {file ? `▶ ${file.name}` : '[ INSERT FILE ]'}
              </p>
              {!file && <p className="font-pixel text-[8px] text-secondary mt-2">DRAG & DROP OR CLICK</p>}
              {file  && <p className="font-pixel text-[8px] text-accent mt-2">FILE LOADED ✓</p>}
            </div>

            {/* Config */}
            <div className="grid grid-cols-2 gap-4">
              <div className="pixel-box-pink p-4 space-y-2">
                <label className="font-pixel text-[8px] text-secondary block">◀ MAPPERS ▶</label>
                <div className="flex items-center gap-2">
                  <button className="btn-pixel-pink px-3 py-1 text-base" onClick={() => setMappers(m => Math.max(1, m-1))}>-</button>
                  <span className="font-pixel text-primary text-sm flex-1 text-center">{mappers}</span>
                  <button className="btn-pixel-pink px-3 py-1 text-base" onClick={() => setMappers(m => Math.min(20, m+1))}>+</button>
                </div>
              </div>
              <div className="pixel-box-gold p-4 space-y-2">
                <label className="font-pixel text-[8px] text-accent block">◀ REDUCERS ▶</label>
                <div className="flex items-center gap-2">
                  <button className="btn-pixel-gold px-3 py-1 text-base" onClick={() => setReducers(r => Math.max(1, r-1))}>-</button>
                  <span className="font-pixel text-primary text-sm flex-1 text-center">{reducers}</span>
                  <button className="btn-pixel-gold px-3 py-1 text-base" onClick={() => setReducers(r => Math.min(20, r+1))}>+</button>
                </div>
              </div>
            </div>

            {/* Start button */}
            <button
              id="start-job-btn"
              onClick={handleRunJob}
              disabled={!file}
              className="btn-pixel w-full py-4 text-sm tracking-widest"
            >
              ▶ START GAME
            </button>
          </div>
        )}

        {/* ── RUNNING / ERROR ── */}
        {(jobState === 'running' || jobState === 'error') && (
          <div className={clsx('p-6 space-y-5 animate-in fade-in duration-300',
            jobState === 'error' ? 'pixel-box-red' : 'pixel-box'
          )}>

            {/* Status bar */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                {jobState === 'running' ? <PixelSpinner /> : <span className="text-danger text-glow-green font-pixel text-xs">✖</span>}
                <span className={clsx('font-pixel text-xs', jobState === 'error' ? 'text-danger' : 'text-primary text-glow-green')}>
                  {jobState === 'running' ? 'PROCESSING…' : 'GAME OVER'}
                </span>
              </div>
              <span className="font-pixel text-[9px] text-accent">{phase}</span>
            </div>

            {/* Progress bar */}
            <div className="progress-pixel">
              {jobState === 'error'
                ? <div className="progress-pixel-fill-red" />
                : <div className="progress-pixel-fill" style={{ width: progressWidth }} />
              }
            </div>

            {/* Phase breadcrumbs */}
            <div className="flex gap-1 flex-wrap">
              {PHASES.map((p, i) => (
                <span key={i} className={clsx(
                  'font-pixel text-[7px] px-2 py-1 border-2',
                  phase.includes(p.split(' ')[0])
                    ? 'border-primary text-primary bg-primary/10'
                    : 'border-white/10 text-white/20'
                )}>{p}</span>
              ))}
            </div>

            {/* Log terminal */}
            <div className="bg-dark border-2 border-primary/40 p-3 h-56 overflow-y-auto space-y-1 font-mono text-[10px]">
              <div className="text-primary/50 mb-2">{'>'} SYSTEM LOG ────────────────────────</div>
              {logs.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-white/30 shrink-0">[{new Date(log.timestamp).toLocaleTimeString([], {hour12:false})}]</span>
                  <span className={clsx(
                    'break-all',
                    log.type === 'error' || log.type === 'stderr' ? 'text-danger' :
                    log.type === 'phase' ? 'text-secondary font-bold' :
                    log.type === 'success' ? 'text-accent' : 'text-primary/80'
                  )}>{log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>

            {jobState === 'error' && (
              <button className="btn-pixel-pink w-full py-3 tracking-widest"
                onClick={() => setJobState('idle')}>
                ↩ RETRY
              </button>
            )}
          </div>
        )}

        {/* ── SUCCESS ── */}
        {jobState === 'success' && (
          <div className="space-y-5 animate-in fade-in duration-500">

            {/* Win banner */}
            <div className="pixel-box-gold p-6 text-center space-y-3">
              <div className="font-pixel text-3xl">🏆</div>
              <h2 className="font-pixel text-accent text-glow-gold text-sm">ANALYSIS COMPLETE!</h2>
              <p className="font-pixel text-[9px] text-primary">
                {mappers} MAPPERS × {reducers} REDUCERS → {results.length} UNIQUE WORDS
              </p>
              <div className="font-pixel text-[11px] text-secondary text-glow-pink">
                SCORE: {score.toString().padStart(6,'0')} PTS
              </div>
              <button className="btn-pixel mt-2 px-8 py-3 tracking-widest"
                onClick={() => { setJobState('idle'); setSearchQuery(''); }}>
                ↩ PLAY AGAIN
              </button>
            </div>

            {/* Results chart */}
            <div className="pixel-box p-5 space-y-4">
              {/* Header + search */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-pixel text-[10px] text-primary text-glow-green">▶ WORD FREQUENCIES</h3>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      id="word-search"
                      type="text"
                      placeholder="SEARCH…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="input-pixel pr-3 w-40 text-[9px]"
                    />
                  </div>
                  {searchQuery && (
                    <span className="font-pixel text-[8px] text-accent whitespace-nowrap">
                      {filtered.length} HIT{filtered.length !== 1 ? 'S' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Chart */}
              <div className="overflow-y-auto" style={{ maxHeight: '600px' }}>
                {filtered.length > 0 ? (
                  <div style={{ height: Math.max(300, filtered.length * 32), width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={filtered} layout="vertical"
                        margin={{ top: 4, right: 24, left: 70, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="rgba(0,255,65,0.08)"
                          horizontal={false} vertical={true} />
                        <XAxis type="number" stroke="#00FF41" tick={{ fontFamily: '"Press Start 2P"', fontSize: 8, fill: '#00FF41' }} />
                        <YAxis dataKey="word" type="category" stroke="#00FF41"
                          tick={{ fontFamily: '"Press Start 2P"', fontSize: 8, fill: '#00FF41' }}
                          width={65} interval={0} />
                        <Tooltip content={<PixelTooltip />} cursor={{ fill: 'rgba(0,255,65,0.05)' }} />
                        <Bar dataKey="count" radius={0} barSize={16}>
                          {filtered.map((_, i) => (
                            <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center">
                    <p className="font-pixel text-[9px] text-danger">
                      {searchQuery ? `NO MATCH FOR "${searchQuery.toUpperCase()}"` : 'NO DATA'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="font-pixel text-[7px] text-primary/30 text-center pb-4">
          © 1983 MAPREDUCE CORP. ALL RIGHTS RESERVED. INSERT COIN TO CONTINUE.
        </div>
      </div>
    </div>
  );
}
