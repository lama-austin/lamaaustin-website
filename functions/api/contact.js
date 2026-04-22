export async function onRequestPost(context) {
  const { request, env } = context;

  let first, last, email, phone, bike, message;
  try {
    const data = await request.formData();
    first   = data.get('first')   || '';
    last    = data.get('last')    || '';
    email   = data.get('email')   || '';
    phone   = data.get('phone')   || '';
    bike    = data.get('bike')    || '';
    message = data.get('message') || '';
  } catch {
    return json({ success: false, error: 'Invalid request.' }, 400);
  }

  if (!first || !last || !email) {
    return json({ success: false, error: 'Missing required fields.' }, 400);
  }

  const body = [
    '🏍️ New Membership Interest — LAMA Austin',
    '',
    `Name:  ${first} ${last}`,
    `Email: ${email}`,
    `Phone: ${phone || '—'}`,
    `Bike:  ${bike  || '—'}`,
    '',
    'About:',
    message || '(no message)',
  ].join('\n');

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, TWILIO_WHATSAPP_TO } = env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM || !TWILIO_WHATSAPP_TO) {
    return json({ success: false, error: 'Server not configured.' }, 500);
  }

  const twilioRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: TWILIO_WHATSAPP_FROM,
        To:   TWILIO_WHATSAPP_TO,
        Body: body,
      }),
    }
  );

  if (!twilioRes.ok) {
    const err = await twilioRes.json().catch(() => ({}));
    return json({ success: false, error: err.message || 'Failed to send message.' }, 500);
  }

  return json({ success: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
