import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { get } from 'node:http';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('.');
const args = parseArgs(process.argv.slice(2));
const profile = String(args.profile || process.env.HARRIER_QA_PROFILE_NAME || 'quick').toLowerCase() === 'signoff' ? 'signoff' : 'quick';
const serverPort = Number(process.env.HARRIER_QA_PORT || args.port || args.positionals[0] || 8830);
const debugPort = Number(process.env.HARRIER_QA_DEBUG_PORT || args.debugPort || args.positionals[1] || 9330);
const timeoutMs = Number(process.env.HARRIER_QA_TIMEOUT_MS || args.timeout || (profile === 'signoff' ? 1500000 : 180000));
const reportPath = process.env.HARRIER_QA_REPORT || 'C:\\tmp\\harrier-browser-qa-report.json';
const browserPath = process.env.HARRIER_QA_BROWSER || findBrowser();
const userDataDir = process.env.HARRIER_QA_PROFILE || `C:\\tmp\\harrier-browser-qa-${Date.now()}`;

if (!browserPath) {
  console.error('No Chrome/Edge executable found. Set HARRIER_QA_BROWSER to a browser path.');
  process.exit(1);
}

mkdirSync('C:\\tmp', { recursive: true });

const server = spawn(process.execPath, ['dev-server.cjs', String(serverPort)], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe']
});

const browser = spawn(browserPath, [
  '--headless=new',
  '--disable-background-networking',
  '--disable-default-apps',
  '--disable-extensions',
  '--disable-popup-blocking',
  '--disable-sync',
  '--hide-scrollbars',
  '--mute-audio',
  '--no-first-run',
  '--remote-allow-origins=*',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${userDataDir}`,
  `http://127.0.0.1:${serverPort}/qa-runner.html?autorun=1&profile=${profile}`
], {
  stdio: ['ignore', 'pipe', 'pipe']
});

try {
  await waitForHttp(`http://127.0.0.1:${serverPort}/`, 10000);
  const page = await waitForPage(debugPort, 15000);
  const cdp = await connectCdp(page.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  const report = await waitForReport(cdp, timeoutMs);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const acceptance = report.acceptance;
  const visual = report.visual;
  console.log(`BROWSER_QA_REPORT=${reportPath}`);
  console.log(`BROWSER_QA_OK=${!!report.ok}`);
  console.log(`PROFILE=${report.profile || profile}`);
  console.log(`ACCEPTANCE=${acceptance?.ok ? 'PASS' : 'FAIL'} ${acceptance?.passed ?? 0}/${acceptance?.total ?? 0}`);
  console.log(`VISUAL=${visual?.ok ? 'PASS' : 'FAIL'} nonBlack=${visual?.nonBlackSamples ?? 0} varied=${visual?.variedSamples ?? 0}`);
  console.log(`RUNTIME_ERRORS=${report.runtimeErrors?.length ?? 0}`);
  process.exitCode = report.ok && acceptance?.ok ? 0 : 1;
} catch (error) {
  console.error(`BROWSER_QA_ERROR=${error?.message || error}`);
  process.exitCode = 1;
} finally {
  browser.kill();
  server.kill();
}

function findBrowser() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  return candidates.find(path => existsSync(path)) || '';
}

function parseArgs(rawArgs) {
  const out = { positionals: [] };
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === '--profile') out.profile = rawArgs[++i];
    else if (arg.startsWith('--profile=')) out.profile = arg.slice('--profile='.length);
    else if (arg === '--port') out.port = rawArgs[++i];
    else if (arg.startsWith('--port=')) out.port = arg.slice('--port='.length);
    else if (arg === '--debug-port') out.debugPort = rawArgs[++i];
    else if (arg.startsWith('--debug-port=')) out.debugPort = arg.slice('--debug-port='.length);
    else if (arg === '--timeout') out.timeout = rawArgs[++i];
    else if (arg.startsWith('--timeout=')) out.timeout = arg.slice('--timeout='.length);
    else out.positionals.push(arg);
  }
  return out;
}

function waitForHttp(url, timeout) {
  const started = Date.now();
  return new Promise((resolvePromise, rejectPromise) => {
    const tick = () => {
      requestJsonOrText(url)
        .then(() => resolvePromise())
        .catch(error => {
          if (Date.now() - started > timeout) rejectPromise(error);
          else setTimeout(tick, 150);
        });
    };
    tick();
  });
}

async function waitForPage(port, timeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const pages = JSON.parse(await requestJsonOrText(`http://127.0.0.1:${port}/json/list`));
      const page = pages.find(entry => entry.type === 'page' && entry.url.includes('qa-runner.html'));
      if (page?.webSocketDebuggerUrl) return page;
    } catch {}
    await delay(150);
  }
  throw new Error('Timed out waiting for browser DevTools page');
}

function connectCdp(url) {
  const socket = new WebSocket(url);
  let nextId = 1;
  const pending = new Map();

  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve: ok, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message || JSON.stringify(message.error)));
    else ok(message.result);
  });

  return new Promise((resolvePromise, rejectPromise) => {
    socket.addEventListener('open', () => {
      resolvePromise({
        send(method, params = {}) {
          const id = nextId++;
          socket.send(JSON.stringify({ id, method, params }));
          return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
        }
      });
    });
    socket.addEventListener('error', rejectPromise);
  });
}

async function waitForReport(cdp, timeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const result = await cdp.send('Runtime.evaluate', {
      expression: "JSON.parse(localStorage.getItem('harrierQaLastReport') || 'null')",
      returnByValue: true,
      awaitPromise: true
    });
    const value = result.result?.value;
    if (value?.capturedAt && value?.acceptance) return value;
    await delay(500);
  }
  throw new Error('Timed out waiting for harrierQaLastReport');
}

function requestJsonOrText(url) {
  return new Promise((resolvePromise, rejectPromise) => {
    const req = get(url, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode >= 200 && response.statusCode < 300) resolvePromise(body);
        else rejectPromise(new Error(`${url} returned ${response.statusCode}`));
      });
    });
    req.on('error', rejectPromise);
    req.setTimeout(5000, () => req.destroy(new Error(`${url} timed out`)));
  });
}
