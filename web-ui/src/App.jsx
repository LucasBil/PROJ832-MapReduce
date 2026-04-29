import { useState, useRef, useEffect } from 'react';
import { Upload, Play, CheckCircle2, Server, Hash, FileText, AlertCircle, BarChart3, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function clsx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function App() {
  const [file, setFile] = useState(null);
  const [mappers, setMappers] = useState(3);
  const [reducers, setReducers] = useState(1);
  const [jobId, setJobId] = useState(null);
  const [jobState, setJobState] = useState('idle'); // idle, running, success, error
  const [logs, setLogs] = useState([]);
  const [phase, setPhase] = useState('');
  const [results, setResults] = useState([]);

  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleRunJob = async () => {
    if (!file) return;

    setJobState('running');
    setLogs([]);
    setPhase('Uploading file...');
    setResults([]);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mappers', mappers);
    formData.append('reducers', reducers);

    try {
      const res = await fetch('http://localhost:3001/api/run-job', {
        method: 'POST',
        body: formData,
      });
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

    const evtSource = new EventSource(`http://localhost:3001/api/job-stream/${jobId}`);

    evtSource.onmessage = (event) => {
      const log = JSON.parse(event.data);
      setLogs((prev) => [...prev, log]);

      if (log.type === 'phase') {
        setPhase(log.message);
      } else if (log.type === 'success') {
        setJobState('success');
        setPhase('Job Completed');
        setResults(log.data || []);
        evtSource.close();
      } else if (log.type === 'error') {
        setJobState('error');
        setPhase('Error during execution');
        evtSource.close();
      }
    };

    evtSource.onerror = () => {
      setJobState('error');
      setPhase('Connection to server lost.');
      evtSource.close();
    };

    return () => evtSource.close();
  }, [jobId]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col items-center py-12 px-4 sm:px-6">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl w-full space-y-8 z-10 relative">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-surface/50 rounded-2xl border border-white/5 mb-2 shadow-lg backdrop-blur-sm">
            <Server className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
            MapReduce Visualizer
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto text-lg">
            A dynamic, high-performance web interface for orchestrating your Docker-based Java MapReduce cluster.
          </p>
        </div>

        {jobState === 'idle' && (
          <div className="glass rounded-3xl p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Upload Zone */}
            <div 
              className={clsx(
                "border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300",
                file ? "border-primary bg-primary/5" : "border-white/10 hover:border-primary/50 hover:bg-white/5"
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
            >
              <input 
                type="file" 
                id="file-upload" 
                className="hidden" 
                accept=".txt" 
                onChange={(e) => setFile(e.target.files[0])} 
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center space-y-4">
                <div className={clsx("p-4 rounded-full", file ? "bg-primary/20 text-primary" : "bg-surface text-slate-400")}>
                  {file ? <FileText className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
                </div>
                <div>
                  <p className="text-lg font-medium text-slate-200">
                    {file ? file.name : "Drag & drop your input file here"}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    or click to browse (.txt only)
                  </p>
                </div>
              </label>
            </div>

            {/* Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <Hash className="w-4 h-4 text-primary" /> Number of Mappers
                </label>
                <input 
                  type="number" 
                  min="1" 
                  max="10" 
                  value={mappers} 
                  onChange={(e) => setMappers(parseInt(e.target.value) || 1)}
                  className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <Hash className="w-4 h-4 text-secondary" /> Number of Reducers
                </label>
                <input 
                  type="number" 
                  min="1" 
                  max="10" 
                  value={reducers} 
                  onChange={(e) => setReducers(parseInt(e.target.value) || 1)}
                  className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
                />
              </div>
            </div>

            <button 
              onClick={handleRunJob}
              disabled={!file}
              className="w-full relative group overflow-hidden rounded-xl p-[1px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-xl opacity-80 group-hover:opacity-100 transition-opacity"></span>
              <div className="relative bg-surface flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-lg hover:bg-surface/50 transition-colors">
                <Play className="w-5 h-5" /> Start MapReduce Job
              </div>
            </button>
          </div>
        )}

        {(jobState === 'running' || jobState === 'error') && (
          <div className="glass rounded-3xl p-8 space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {jobState === 'running' ? (
                  <div className="relative">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <div className="absolute inset-0 border-t-2 border-primary rounded-full animate-ping opacity-20"></div>
                  </div>
                ) : (
                  <AlertCircle className="w-8 h-8 text-red-500" />
                )}
                <div>
                  <h3 className="text-xl font-bold text-slate-200">
                    {jobState === 'running' ? 'Processing Job...' : 'Job Failed'}
                  </h3>
                  <p className="text-sm text-slate-400">{phase}</p>
                </div>
              </div>
            </div>

            {/* Progress Visualization */}
            <div className="h-2 bg-surface rounded-full overflow-hidden">
              <div 
                className={clsx(
                  "h-full transition-all duration-1000 ease-out",
                  jobState === 'error' ? 'bg-red-500 w-full' : 'bg-gradient-to-r from-primary to-secondary'
                )}
                style={{ 
                  width: phase.includes('Map') ? '33%' : 
                         phase.includes('Reduce') ? '66%' : 
                         phase.includes('Collect') ? '90%' : 
                         jobState === 'running' ? '10%' : '100%' 
                }}
              />
            </div>

            {/* Logs Terminal */}
            <div className="bg-[#0A0F1A] border border-white/5 rounded-xl p-4 font-mono text-sm h-64 overflow-y-auto space-y-2">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-slate-500 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
                  </span>
                  <span className={clsx(
                    "whitespace-pre-wrap break-all",
                    log.type === 'error' || log.type === 'stderr' ? 'text-red-400' :
                    log.type === 'phase' ? 'text-secondary font-bold' :
                    log.type === 'success' ? 'text-accent' :
                    'text-slate-300'
                  )}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>

            {jobState === 'error' && (
              <button 
                onClick={() => setJobState('idle')}
                className="w-full bg-surface border border-white/10 hover:bg-white/5 text-white py-3 rounded-xl font-medium transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        )}

        {jobState === 'success' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
            {/* Success Header */}
            <div className="glass rounded-3xl p-8 flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center text-accent mb-2">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-bold text-slate-200">Analysis Complete</h2>
              <p className="text-slate-400 max-w-md">
                Your MapReduce job processed successfully across {mappers} mappers and {reducers} reducers.
              </p>
              <button 
                onClick={() => setJobState('idle')}
                className="mt-4 px-6 py-2 bg-surface border border-white/10 hover:bg-white/5 rounded-full text-sm font-medium transition-colors"
              >
                Run Another Job
              </button>
            </div>

            {/* Results Visualization */}
            <div className="glass rounded-3xl p-8 space-y-6">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-bold text-slate-200">Word Count Frequencies</h3>
              </div>
              
              <div className="w-full overflow-y-auto pr-2 custom-scrollbar" style={{ maxHeight: '800px' }}>
                {results.length > 0 ? (
                  <div style={{ height: Math.max(400, results.length * 35), width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={results} // Show all words
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={true} vertical={false} />
                        <XAxis type="number" stroke="rgba(255,255,255,0.4)" />
                        <YAxis dataKey="word" type="category" stroke="rgba(255,255,255,0.8)" width={100} tick={{ fontSize: 12 }} interval={0} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                          itemStyle={{ color: '#3B82F6' }}
                        />
                        <Bar dataKey="count" fill="url(#colorUv)" radius={[0, 4, 4, 0]} barSize={20}>
                        </Bar>
                        <defs>
                          <linearGradient id="colorUv" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500">
                    No results found
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
