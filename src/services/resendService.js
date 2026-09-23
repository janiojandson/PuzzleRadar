const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

function formatFromAddress(name = process.env.EMAIL_FROM_NAME || 'PuzzleRadar', email = process.env.RESEND_FROM_EMAIL) {
  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim();

  if (!cleanName || /[<>]/.test(cleanName)) {
    throw new Error('EMAIL_FROM_NAME must be a display name without angle brackets.');
  }

  if (!cleanEmail || /[<>]/.test(cleanEmail)) {
    throw new Error('RESEND_FROM_EMAIL must be a bare verified address without angle brackets.');
  }

  return `${cleanName} <${cleanEmail}>`;
}

async function sendEmailVerificationPin({ to, pin, fetchImpl = global.fetch, apiKey = process.env.RESEND_API_KEY, from = formatFromAddress() }) {
  if (!apiKey) {
    return { success: false, error: 'Email delivery is not configured.' };
  }

  if (typeof fetchImpl !== 'function') {
    return { success: false, error: 'Email delivery is unavailable.' };
  }

  try {
    const response = await fetchImpl(RESEND_EMAILS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'Confirme seu e-mail no PuzzleRadar',
        text: `Seu código de confirmação é ${pin}. Ele expira em 10 minutos.`
      })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.error) {
      return { success: false, error: payload.error?.message || payload.message || 'Unable to deliver verification email.' };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message || 'Unable to deliver verification email.' };
  }
}

module.exports = { formatFromAddress, sendEmailVerificationPin };
