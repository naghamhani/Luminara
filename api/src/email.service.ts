import nodemailer from 'nodemailer';
import { config, Locale } from './config';

type Message = { subject: string; text: string; html: string };

/**
 * Builds and sends the welcome/confirmation email.
 * Provider selection: Resend (if RESEND_API_KEY is set) → SMTP fallback → console log (dev).
 * A send failure never blocks the signup — callers log the error and move on.
 */
export class EmailService {
  buildConfirmation(name: string | null, locale: Locale): Message {
    const first = (name || '').trim().split(/\s+/)[0];

    if (locale === 'ar') {
      const hello = first ? `أهلًا ${first}،` : 'أهلًا فيكِ،';
      const subject = 'صرتي على قائمة انتظار لومينارا ✨';
      const text = [
        hello,
        '',
        'سجّلناكِ على قائمة انتظار لومينارا — تطبيق صحة المرأة الخاص، من الدورة الى الاكتئاب حول الولادة.',
        'أول ما يجهز التطبيق، بنبعثلك إيميل واحد بس. بلا إزعاج وبلا مشاركة بيانات.',
        '',
        'ضوّ بيضلّ إلكِ.',
        `فريق لومينارا · ${config.siteUrl}`,
      ].join('\n');
      const html = this.htmlShell(
        'rtl',
        `
        <h1 style="margin:0 0 12px;font-size:22px;color:#2B2438">${hello}</h1>
        <p style="margin:0 0 10px">سجّلناكِ على قائمة انتظار <b>لومينارا</b> — تطبيق صحة المرأة الخاص، من الدورة الى الاكتئاب حول الولادة.</p>
        <p style="margin:0 0 10px">أول ما يجهز التطبيق، بنبعثلك إيميل واحد بس. بلا إزعاج وبلا مشاركة بيانات.</p>
        <p style="margin:18px 0 0;font-weight:700;color:#6E52A0">ضوّ بيضلّ إلكِ.</p>
        <p style="margin:4px 0 0;color:#6E6480">فريق لومينارا</p>
        `,
      );
      return { subject, text, html };
    }

    const hello = first ? `Hi ${first},` : 'Hi there,';
    const subject = "You're on the Luminara waitlist ✨";
    const text = [
      hello,
      '',
      "You're on the waitlist for Luminara — the private, whole-person women's health app.",
      "We'll send you a single email the moment it's ready. No spam, no data sharing.",
      '',
      'Light you can keep.',
      `The Luminara team · ${config.siteUrl}`,
    ].join('\n');
    const html = this.htmlShell(
      'ltr',
      `
      <h1 style="margin:0 0 12px;font-size:22px;color:#2B2438">${hello}</h1>
      <p style="margin:0 0 10px">You're on the waitlist for <b>Luminara</b> — the private, whole-person women's health app.</p>
      <p style="margin:0 0 10px">We'll send you a single email the moment it's ready. No spam, no data sharing.</p>
      <p style="margin:18px 0 0;font-weight:700;color:#6E52A0">Light you can keep.</p>
      <p style="margin:4px 0 0;color:#6E6480">The Luminara team</p>
      `,
    );
    return { subject, text, html };
  }

  private htmlShell(dir: 'ltr' | 'rtl', body: string): string {
    return `<!DOCTYPE html>
<html dir="${dir}">
<body style="margin:0;padding:0;background:#FBF7F9;font-family:Tahoma,Arial,sans-serif;color:#2B2438">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F9;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0"
             style="background:#FFFFFF;border:1px solid #EDE2EC;border-radius:22px;padding:32px;text-align:${dir === 'rtl' ? 'right' : 'left'}">
        <tr><td style="font-size:15px;line-height:1.7">${body}</td></tr>
        <tr><td style="padding-top:20px;padding-bottom:12px">
          <img src="${config.ogImageUrl}" alt="Luminara" style="display:block;width:100%;height:auto;max-width:100%;border-radius:12px;border:1px solid #EDE2EC">
        </td></tr>
        <tr><td style="padding-top:24px;border-top:1px solid #EDE2EC;margin-top:20px">
          <p style="font-size:12px;color:#6E6480;margin:16px 0 0">
            © ${new Date().getFullYear()} Luminara Health &middot; <a href="${config.siteUrl}" style="color:#8C6FBF">${config.siteUrl.replace('https://', '')}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  async sendConfirmation(email: string, name: string | null, locale: Locale): Promise<void> {
    const msg = this.buildConfirmation(name, locale);

    // 1) Resend has priority
    if (config.resendApiKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: config.resendFrom,
          to: [email],
          subject: msg.subject,
          text: msg.text,
          html: msg.html,
        }),
      });
      if (!res.ok) {
        throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
      }
      return;
    }

    // 2) SMTP fallback
    if (config.smtp.host) {
      const transport = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
      });
      await transport.sendMail({
        from: config.resendFrom,
        to: email,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      });
      return;
    }

    // 3) No provider configured (local dev) — log instead of failing
    console.log(`[email] no provider configured — would send "${msg.subject}" to ${email}`);
  }
}

export const emailService = new EmailService();
