import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { config } from './config';
import router from './routes';
import authRoutes from './routes/authRoutes';
import billingRoutes from './routes/billingRoutes';

export const createApp = () => {
  const app = express();

  app.use(
    cors({
      origin: config.frontendUrl
    })
  );
  app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json({ limit: '10mb' }));
  const staticOptions = {
    acceptRanges: true,
    setHeaders: (res: express.Response) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  };

  app.use('/storage/uploads', express.static(path.join(config.rootDir, 'storage/uploads'), staticOptions));
  app.use('/storage/work', express.static(config.workingDir, staticOptions));
  app.use('/storage', express.static(path.join(config.rootDir, 'storage/exports'), staticOptions));

  app.get('/', (_req, res) => {
    res.json({
      name: 'AI Marketing Studio MVP API',
      status: 'ok',
      health: `${config.appUrl}/api/health`,
      frontend: config.frontendUrl
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/billing', billingRoutes);
  app.use('/api', router);

  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = error.statusCode || 500;
    res.status(status).json({
      message: error.message || 'Unexpected server error.'
    });
  });

  return app;
};
