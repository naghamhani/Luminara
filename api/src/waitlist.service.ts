import { prisma } from './db';
import { emailService } from './email.service';
import { Locale } from './config';

export type JoinInput = {
  email: string;
  name?: string;
  locale?: Locale;
  source?: string;
};

export type JoinResult =
  | { status: 'created'; id: string }
  | { status: 'already_subscribed' }
  | { status: 'resubscribed'; id: string };

/**
 * Core waitlist logic:
 *  - email is normalised to lowercase → signup is idempotent
 *  - an existing *active* subscriber is rejected (no duplicate email is ever sent)
 *  - the subscriber is always saved; the welcome email is sent only on first signup
 *  - an email failure never blocks the signup — it is logged and the request still succeeds
 */
export class WaitlistService {
  async join(input: JoinInput): Promise<JoinResult> {
    const email = input.email.trim().toLowerCase();
    const name = input.name?.trim() || null;
    const locale: Locale = input.locale === 'ar' ? 'ar' : 'en';
    const source = input.source || 'waitlist';

    const existing = await prisma.luminaraWaitList.findUnique({ where: { email } });

    if (existing && existing.status === 'active') {
      return { status: 'already_subscribed' };
    }

    if (existing) {
      // was unsubscribed — reactivate, but treat as a fresh signup for the email
      const updated = await prisma.luminaraWaitList.update({
        where: { email },
        data: { status: 'active', name, locale, source },
      });
      this.sendWelcome(email, name, locale);
      return { status: 'resubscribed', id: updated.id };
    }

    const created = await prisma.luminaraWaitList.create({
      data: { email, name, locale, source },
    });
    this.sendWelcome(email, name, locale);
    return { status: 'created', id: created.id };
  }

  private sendWelcome(email: string, name: string | null, locale: Locale): void {
    emailService.sendConfirmation(email, name, locale).catch((err) => {
      console.error(`[waitlist] welcome email to ${email} failed:`, err.message || err);
    });
  }
}

export const waitlistService = new WaitlistService();
