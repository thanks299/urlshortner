/**
 * src/app.js
 * Application entry point — bootstraps Express, connects MongoDB, registers routes.
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { fileURLToPath } from 'node:url';

import 'dotenv/config.js';

import { connect } from './config/database.js';
import logger from './config/logger.js';
import rateLimiter from './middlewares/rateLimiter.js';
import errorHandler from './middlewares/errorHandler.js';
import notFound from './middlewares/notFound.js';

import apiRoutes from './routes/api.js';
import redirectRoutes from './routes/redirect.js';

const publicDir = fileURLToPath(new URL('./public', import.meta.url));

async function bootstrap() {
  // Connect to MongoDB
  await connect();

  const app = express();

  app.use(helmet({ contentSecurityPolicy: false })); // CSP off for demo frontend
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(morgan('dev'));

  app.use(express.static(publicDir));

  app.use('/api/', rateLimiter);

  app.use('/api', apiRoutes);
  app.use('/',    redirectRoutes);   // keep last — catches /:code

  app.use(notFound);
  app.use(errorHandler);

  if (process.env.NODE_ENV !== 'test') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      logger.info(`🔗  URL Shortener running → http://localhost:${PORT}`);
      logger.info(`📡  API       → http://localhost:${PORT}/api`);
    });
  }

  return app;
}

try {
  await bootstrap();
} catch (err) {
  console.error('Failed to start:', err);
  process.exit(1);
}

export default bootstrap;
