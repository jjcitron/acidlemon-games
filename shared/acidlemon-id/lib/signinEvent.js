// Anonymous magic-link success line for the growth scorecard.
// One JSON object on stdout. Vercel runtime logs are the read path.
// Never include email, user id, token, cookie, IP, or the raw user agent.
// A failure here must not change the redirect or the session cookie.

import { isApp } from './apps.js';

const SCHEMA_V = 1;
const GAME = 'acidlemon-id';
const CANONICAL_HOST = 'id.acidlemon.com';

// Same QA flags as the shared growth kit. Only the key is consulted;
// the value is never copied onto the record (it can be anything).
const TEST_PARAMS = new Set([
  'qa',
  'nosplash',
  'selftest',
  'smoke',
  'e2e',
  'autotest',
  'test',
  'autorun',
  'qaSeconds',
  'skipmenu',
  'fastClear',
  'invulnerable',
  'sandbox',
  'skipIntro',
  'skipOpening',
  'testEditor',
  'editorPreview',
]);

// Stable order shared with the growth kit. Server events use preview_host
// for localhost; there is no separate localhost code on this path.
const REASON_ORDER = [
  'vercel_app',
  'preview_host',
  'test_param',
  'automation_ua',
  'opt_out',
  'non_prod_env',
  'detect_error',
];

const AUTOMATION_UA_RE = /HeadlessChrome|Playwright|Puppeteer|Lighthouse|bot|crawler|spider/i;

const FORBIDDEN_KEYS = new Set([
  'email',
  'token',
  'uid',
  'user_id',
  'userid',
  'cookie',
  'ip',
  'user_agent',
  'useragent',
  'authorization',
]);

function headerValue(headers, name) {
  if (!headers || typeof headers !== 'object') return '';
  const want = name.toLowerCase();
  let value;
  if (typeof headers.get === 'function') {
    value = headers.get(name);
    if (value == null || value === '') value = headers.get(want);
  } else {
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === want) {
        value = headers[key];
        break;
      }
    }
  }
  if (Array.isArray(value)) value = value[0];
  if (value == null) return '';
  return String(value);
}

// Host only: strip a port and a trailing dot. Never reads forwarded-for.
function normalizeHost(raw) {
  let host = String(raw || '').trim().toLowerCase();
  if (!host) return '';
  host = host.split(',')[0].trim();
  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    host = end >= 0 ? host.slice(1, end) : host;
  } else {
    const colon = host.lastIndexOf(':');
    if (colon > 0 && host.indexOf(':') === colon && /^\d+$/.test(host.slice(colon + 1))) {
      host = host.slice(0, colon);
    }
  }
  host = host.replace(/\.$/, '').replace(/[\u0000-\u001f\u007f]/g, '');
  // Host is logged. Keep hostname characters only, so an email or a URL
  // stuffed into the header is dropped instead of copied onto the record.
  if (!/^[a-z0-9._:-]*$/.test(host)) return '';
  return host.slice(0, 253);
}

function safeToken(value, max) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max);
}

function queryHasTestParam(query) {
  if (!query || typeof query !== 'object') return false;
  for (const key of TEST_PARAMS) {
    if (Object.prototype.hasOwnProperty.call(query, key) && query[key] != null) return true;
  }
  return false;
}

function headerIsTest(headers) {
  const raw = headerValue(headers, 'x-test') || headerValue(headers, 'test');
  if (!raw) return false;
  const value = raw.trim().toLowerCase();
  return value !== '0' && value !== 'false' && value !== 'off';
}

function isInternalOptOut(cookieHeader) {
  for (const part of String(cookieHeader || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 'acidlemon_internal' && value === '1') return true;
  }
  return false;
}

function allowedApp(app) {
  return isApp(app) ? String(app) : null;
}

function internalReasons(req) {
  const headers = req?.headers || {};
  const host = normalizeHost(headerValue(headers, 'x-forwarded-host') || headerValue(headers, 'host'));
  const envName = safeToken(process.env.VERCEL_ENV || '', 40);
  const reasons = [];
  if (host.endsWith('.vercel.app')) reasons.push('vercel_app');
  // Anything that is not the production id host is preview traffic, including localhost.
  if (host !== CANONICAL_HOST) reasons.push('preview_host');
  if (envName !== 'production') reasons.push('non_prod_env');
  if (queryHasTestParam(req?.query) || headerIsTest(headers)) reasons.push('test_param');
  const ua = headerValue(headers, 'user-agent');
  if (ua && AUTOMATION_UA_RE.test(ua)) reasons.push('automation_ua');
  if (isInternalOptOut(headerValue(headers, 'cookie'))) reasons.push('opt_out');
  const ordered = REASON_ORDER.filter((code) => reasons.includes(code));
  return { host, envName, reasons: ordered };
}

function minimalRecord(app) {
  return {
    game: GAME,
    name: 'signin_success',
    type: 'signin',
    ts: Date.now(),
    client_id: '',
    session_id: '',
    props: { app: allowedApp(app) },
    internal: true,
    internal_reasons: ['detect_error'],
    host: '',
    env: '',
    build: '',
    schema_v: SCHEMA_V,
  };
}

function buildSigninSuccessRecord(req, app) {
  try {
    const { host, envName, reasons } = internalReasons(req);
    return {
      game: GAME,
      name: 'signin_success',
      type: 'signin',
      ts: Date.now(),
      client_id: '',
      session_id: '',
      props: { app: allowedApp(app) },
      internal: reasons.length > 0,
      internal_reasons: reasons,
      host,
      env: envName,
      build: safeToken(process.env.VERCEL_GIT_COMMIT_SHA || '', 40).slice(0, 7),
      schema_v: SCHEMA_V,
    };
  } catch {
    return minimalRecord(app);
  }
}

function stringifyRecord(record) {
  return JSON.stringify(record, (key, value) => {
    if (key && FORBIDDEN_KEYS.has(String(key).toLowerCase())) return undefined;
    return value;
  });
}

// Synchronous. Caller wraps this so a throw cannot escape the verify handler.
export function logSigninSuccess(req, app) {
  console.log(stringifyRecord(buildSigninSuccessRecord(req, app)));
}
