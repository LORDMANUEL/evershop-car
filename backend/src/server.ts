import app, { env } from './app';
import prisma from './config/prisma';

const server = app.listen(env.port, () => {
  console.log(`API listening on port ${env.port}`);
});

const shutdown = async () => {
  console.log('Shutting down server');
  await prisma.$disconnect();
  server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
