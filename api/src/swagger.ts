export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Luminara Waitlist API',
    version: '1.0.0',
    description:
      'Saves waitlist signups and sends a bilingual (EN/AR) welcome email on first signup only. ' +
      'Email goes out via Resend when RESEND_API_KEY is set, otherwise via SMTP. ' +
      'An email failure never blocks the signup.',
  },
  servers: [{ url: '/', description: 'This server' }],
  paths: {
    '/waitlist': {
      post: {
        summary: 'Join the waitlist',
        description:
          'Email is normalised to lowercase (idempotent). An already-active email is rejected with 409 ' +
          'and no duplicate welcome email is ever sent.',
        tags: ['Waitlist'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/JoinRequest' },
              examples: {
                english: { value: { email: 'dana@example.com', name: 'Dana', locale: 'en' } },
                arabic: { value: { email: 'dana@example.com', name: 'دانا', locale: 'ar', source: 'landing-hero' } },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Subscribed (or re-subscribed) — welcome email queued.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/JoinSuccess' },
                example: { ok: true, status: 'created' },
              },
            },
          },
          '400': {
            description: 'Validation error (bad email, name, or locale).',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
                example: { ok: false, error: 'A valid email is required.' },
              },
            },
          },
          '409': {
            description: 'Email is already on the waitlist (active). No email is re-sent.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
                example: { ok: false, error: 'This email is already on the waitlist.' },
              },
            },
          },
          '500': {
            description: 'Unexpected server error.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
                example: { ok: false, error: 'Something went wrong. Please try again.' },
              },
            },
          },
        },
      },
    },
    '/health': {
      get: {
        summary: 'Health check',
        tags: ['Meta'],
        responses: {
          '200': {
            description: 'Service is up.',
            content: { 'application/json': { example: { ok: true } } },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      JoinRequest: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', example: 'dana@example.com' },
          name: { type: 'string', example: 'Dana' },
          locale: { type: 'string', enum: ['en', 'ar'], default: 'en', description: 'Welcome-email language' },
          source: { type: 'string', default: 'waitlist', description: 'Where the signup came from' },
        },
      },
      JoinSuccess: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: true },
          status: { type: 'string', enum: ['created', 'resubscribed'] },
        },
      },
      ApiError: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: false },
          error: { type: 'string' },
        },
      },
    },
  },
} as const;
