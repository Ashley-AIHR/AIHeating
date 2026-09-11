import { spawn } from 'node:child_process';

const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1'], {
  cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk; });
server.stderr.on('data', (chunk) => { serverOutput += chunk; });

try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:5173');
      if (response.ok) { ready = true; break; }
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error(`Vite did not start:\n${serverOutput}`);
  const browser = spawn(process.execPath, ['scripts/p7-browser.mjs'], { cwd: process.cwd(), stdio: 'inherit' });
  const exitCode = await new Promise((resolve) => browser.on('exit', resolve));
  if (exitCode !== 0) process.exitCode = exitCode ?? 1;
} finally {
  server.kill('SIGTERM');
}
