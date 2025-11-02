import cors from 'cors';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';

import env from './config/env';
import modulesRouter from './modules';

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use('/api/v1', modulesRouter);

app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Internal server error' });
});

export { env };
export default app;
