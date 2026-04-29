import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// Store active jobs to allow clients to connect via SSE
const activeJobs = new Map();

app.post('/api/run-job', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { mappers = 3, reducers = 1 } = req.body;
    const jobId = Date.now().toString();
    const inputFilePath = path.resolve(req.file.path);

    // Provide a way for the client to listen to this job
    activeJobs.set(jobId, {
      status: 'starting',
      logs: [],
      clients: new Set(),
      inputPath: inputFilePath,
      mappers,
      reducers
    });

    // We don't block the request, we return the jobId immediately
    res.json({ jobId });

    // Start the process in the background
    runJavaProcess(jobId);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/job-stream/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = activeJobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Add this client
  job.clients.add(res);

  // Send initial logs
  job.logs.forEach(log => res.write(`data: ${JSON.stringify(log)}\n\n`));

  // Handle client disconnect
  req.on('close', () => {
    job.clients.delete(res);
  });
});

function broadcastLog(jobId, type, message, data = null) {
  const job = activeJobs.get(jobId);
  if (!job) return;

  const logEntry = { type, message, data, timestamp: Date.now() };
  job.logs.push(logEntry);

  const payload = `data: ${JSON.stringify(logEntry)}\n\n`;
  job.clients.forEach(client => client.write(payload));
}

function runJavaProcess(jobId) {
  const job = activeJobs.get(jobId);
  
  // Construct the command
  // The Java project is one level up from web-ui
  const projectDir = path.resolve(__dirname, '../../');
  
  // Try to use a classpath that includes the target folder.
  // Note: On Windows it's typically ';', on Unix it's ':'
  const cpSeparator = process.platform === 'win32' ? ';' : ':';
  const classPath = `target/classes${cpSeparator}target/dependency/*`;

  const args = [
    '-cp', classPath,
    'org.example.MasterNode',
    '--mappers', job.mappers,
    '--reducers', job.reducers,
    '--input', job.inputPath
  ];

  broadcastLog(jobId, 'info', `Starting Java Process: java ${args.join(' ')}`);
  broadcastLog(jobId, 'phase', 'Initializing MapReduce...');

  const javaProcess = spawn('java', args, { cwd: projectDir });

  let resultsMode = false;
  let finalResults = [];

  let stdoutBuffer = '';

  javaProcess.stdout.on('data', (data) => {
    stdoutBuffer += data.toString();
    const lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop(); // Keep the last incomplete line for the next chunk

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      broadcastLog(jobId, 'stdout', line);

      // Parse phases
      if (line.includes('--- Phase MAP ---')) {
        broadcastLog(jobId, 'phase', 'Map Phase');
      } else if (line.includes('--- Phase REDUCE ---')) {
        broadcastLog(jobId, 'phase', 'Reduce Phase');
      } else if (line.includes('--- Collecte des résultats ---')) {
        broadcastLog(jobId, 'phase', 'Collecting Results');
      } else if (line.includes('--- Nettoyage des conteneurs ---')) {
        broadcastLog(jobId, 'phase', 'Cleaning up');
      } else if (line.includes('SULTAT FINAL')) {
        resultsMode = true;
      } else if (resultsMode) {
        // Parse "  word            : 5"
        const match = line.match(/^\s*(.+?)\s*:\s*(\d+)\s*$/);
        if (match) {
          finalResults.push({ word: match[1].trim(), count: parseInt(match[2], 10) });
        }
      }
    }
  });

  javaProcess.stderr.on('data', (data) => {
    broadcastLog(jobId, 'stderr', data.toString().trim());
  });

  javaProcess.on('close', (code) => {
    if (code === 0) {
      broadcastLog(jobId, 'success', 'Job Completed Successfully', finalResults);
    } else {
      broadcastLog(jobId, 'error', `Process exited with code ${code}`);
    }
    
    // Clean up file
    fs.unlink(job.inputPath, (err) => {
      if (err) console.error('Error deleting uploaded file:', err);
    });
    
    // Optional: close all client connections after a short delay
    setTimeout(() => {
      job.clients.forEach(client => client.end());
      activeJobs.delete(jobId);
    }, 5000);
  });
}

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
