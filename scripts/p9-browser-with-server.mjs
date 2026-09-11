import { spawn } from 'node:child_process';

const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1'], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
server.stdout.on('data', (chunk) => { output += chunk; });
server.stderr.on('data', (chunk) => { output += chunk; });
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch('http://127.0.0.1:5173')).ok) { ready = true; break; } } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error(`Vite did not start:\n${output}`);
  const test = spawn(process.execPath, ['scripts/p9-browser.mjs'], { cwd: process.cwd(), stdio: 'inherit' });
  const code = await new Promise((resolve) => test.on('exit', resolve));
  if (code !== 0) process.exitCode = code ?? 1;
} finally { server.kill('SIGTERM'); }
