import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 3001),
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Email providers — Resend has priority, SMTP is the fallback
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFrom: process.env.RESEND_FROM || 'Luminara <no-reply@luminarahealth.site>',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },

  // Branding assets are referenced by public URL (not a hard-coded local path)
  // so the same code works in any environment.
  logoUrl: process.env.LOGO_URL || 'https://luminarahealth.site/pablic/logo.png',
  ogImageUrl: process.env.OG_IMAGE_URL || 'https://luminarahealth.site/pablic/og-image.png',
  siteUrl: process.env.SITE_URL || 'https://luminarahealth.site',
};

export type Locale = 'en' | 'ar';
