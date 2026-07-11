import { Router, Request, Response } from 'express';
import { waitlistService } from './waitlist.service';

export const waitlistController = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

waitlistController.post('/waitlist', async (req: Request, res: Response) => {
  const { email, name, locale, source } = req.body ?? {};

  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim()) || email.trim().length > 254) {
    return res.status(400).json({ ok: false, error: 'A valid email is required (max 254 characters).' });
  }
  if (name != null && (typeof name !== 'string' || name.trim().length > 70)) {
    return res.status(400).json({ ok: false, error: 'Name must be a valid string (max 70 characters).' });
  }
  if (locale != null && locale !== 'en' && locale !== 'ar') {
    return res.status(400).json({ ok: false, error: 'Locale must be "en" or "ar".' });
  }

  // Strip basic HTML/Script tags to prevent XSS storage injection
  const sanitizedName = name ? name.replace(/<[^>]*>?/gm, '').trim() : undefined;

  try {
    const result = await waitlistService.join({ email, name: sanitizedName, locale, source });

    if (result.status === 'already_subscribed') {
      return res.status(409).json({ ok: false, error: 'This email is already on the waitlist.' });
    }
    return res.status(201).json({ ok: true, status: result.status });
  } catch (err: any) {
    console.error('[waitlist] join failed:', err.message || err);
    return res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' });
  }
});
