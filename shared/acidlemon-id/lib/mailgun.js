// Send the magic-link email via Mailgun's HTTP API. Plain fetch, no SDK.
// Lifted from Sumi's api/_lib/mailgun.js; the only change is that the copy and accent colour come
// from the app registry instead of being hardcoded to Sumi, so one Mailgun domain serves all four
// titles. Works with a sandbox domain (authorized recipients only) or a verified custom domain.
import { APPS } from './apps.js';

export async function sendMagicLink(email, link, app) {
  const domain = process.env.MAILGUN_DOMAIN;
  const apiKey = process.env.MAILGUN_API_KEY;
  const from = process.env.MAILGUN_FROM || `Acidlemon Games <postmaster@${domain}>`;
  if (!domain || !apiKey) throw new Error('Mailgun env not configured');

  const meta = APPS[app];
  const label = meta?.label || 'Acidlemon Games';
  const accent = meta?.accent || '#7a1f18';

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
      <p><a href="${link}" style="display:inline-block;background:${accent};color:#f3e9d2;
        padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Sign in</a></p>
      <p style="font-size:13px;color:#6b5b48">One Acidlemon sign-in covers every title. This link
        expires in 15 minutes. If you didn't request it, you can ignore this email.</p>
    </div>`;

  const form = new URLSearchParams({
    from,
    to: email,
    subject: `Your ${label} sign-in link`,
    text,
    html,
  });

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
