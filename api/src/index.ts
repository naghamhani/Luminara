import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { waitlistController } from './waitlist.controller';
import { openApiSpec } from './swagger';

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/', waitlistController);

// Swagger UI + raw spec
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec as object));
app.get('/openapi.json', (_req, res) => res.json(openApiSpec));

app.listen(config.port, () => {
  console.log(`Luminara waitlist API on http://localhost:${config.port} — docs at /docs`);
});
