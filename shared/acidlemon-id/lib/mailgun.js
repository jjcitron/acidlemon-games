// Send transactional email via Mailgun's HTTP API. Plain fetch, no SDK.
// Lifted from Sumi's api/_lib/mailgun.js; the only change is that the copy and accent colour come
// from the app registry instead of being hardcoded to Sumi, so one Mailgun domain serves all
// titles. Works with a sandbox domain (authorized recipients only) or a verified custom domain.
import { APPS } from './apps.js';

// Sender: the title's own `from` in the registry, else MAILGUN_FROM, else postmaster@<domain>.
export function fromFor(app, env = process.env) {
  return APPS[app]?.from
    || env.MAILGUN_FROM
    || `Acidlemon Games <postmaster@${env.MAILGUN_DOMAIN}>`;
}

async function mailgunSend({ from, to, subject, text, html }) {
  const domain = process.env.MAILGUN_DOMAIN;
  const apiKey = process.env.MAILGUN_API_KEY;
  if (!domain || !apiKey) throw new Error('Mailgun env not configured');

  const form = new URLSearchParams({ from, to, subject, text, html });

  // Default to the US region; set MAILGUN_API_BASE=https://api.eu.mailgun.net for EU accounts.
  const base = process.env.MAILGUN_API_BASE || 'https://api.mailgun.net';
  const res = await fetch(`${base}/v3/${domain}/messages`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Mailgun send failed (${res.status}): ${detail}`);
  }
  return true;
}

export async function sendMagicLink(email, link, app) {
  const meta = APPS[app];
  const label = meta?.label || 'Acidlemon Games';
  const accent = meta?.accent || '#7a1f18';
  const onAccent = meta?.onAccent || '#f3e9d2';

  const text = [
    `Tap the link below to sign in to ${label}.`,
    '',
    link,
    '',
    'This link expires in 15 minutes. If you did not request it, ignore this email.',
  ].join('\n');

  const html = `
    <div style="font-family:Georgia,serif;color:#241006;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:${accent};margin:0 0 12px">${label}</h2>
      <p>Tap to sign in:</p>
      <p><a href="${link}" style="display:inline-block;background:${accent};color:${onAccent};
        padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Sign in</a></p>
      <p style="font-size:13px;color:#6b5b48">One Acidlemon sign-in covers every title. This link
        expires in 15 minutes. If you didn't request it, you can ignore this email.</p>
    </div>`;

  return mailgunSend({
    from: fromFor(app),
    to: email,
    subject: `Your ${label} sign-in link`,
    text,
    html,
  });
}

// The receipt copy, built without any I/O so it can be checked offline. Carries no link, token or
// credential — just the confirmation.
export function accountDeletedMessage(app, env = process.env) {
  const meta = APPS[app];
  const label = meta?.label || 'Acidlemon Games';
  const accent = meta?.accent || '#7a1f18';

  const text = [
    `Your Acidlemon account has been deleted from ${label}.`,
    '',
    'Your account, your sign-in record and your saved data across every Acidlemon title have been',
    'permanently removed. This cannot be undone. One Acidlemon account covers all our titles, so',
    'this applies to all of them, not just this one.',
    '',
    'If you did not request this, please contact Acidlemon Games support. You can create a new',
    'account any time by signing in with your email again.',
  ].join('\n');

  const html = `
    <div style="font-family:Georgia,serif;color:#241006;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:${accent};margin:0 0 12px">${label}</h2>
      <p>Your Acidlemon account has been deleted.</p>
      <p>Your account, your sign-in record and your saved data across every Acidlemon title have
        been permanently removed. This can't be undone.</p>
      <p style="font-size:13px;color:#6b5b48">One Acidlemon account covers all our titles, so this
        applies to all of them, not just ${label}. If you didn't request this, please contact
        Acidlemon Games support. You can create a new account any time by signing in with your
        email again.</p>
    </div>`;

  return { from: fromFor(app, env), subject: `Your ${label} account has been deleted`, text, html };
}

export async function sendAccountDeletedReceipt(email, app) {
  return mailgunSend({ to: email, ...accountDeletedMessage(app) });
}
