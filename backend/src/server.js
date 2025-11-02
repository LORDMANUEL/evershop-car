import http from 'http';
import { sendJson, sendError } from './lib/http.js';
import { Router } from './lib/router.js';
import authRouter from './controllers/auth.js';
import usersRouter from './controllers/users.js';
import branchesRouter from './controllers/branches.js';
import inventoryRouter from './controllers/inventory.js';
import billingRouter from './controllers/billing.js';
import accountingRouter from './controllers/accounting.js';
import { readDatabase } from './lib/db.js';

const PORT = process.env.PORT || 3000;

const rootRouter = new Router();
const modules = [authRouter, usersRouter, branchesRouter, inventoryRouter, billingRouter, accountingRouter];
modules.forEach((router) => {
  router.routes.forEach((route) => rootRouter.routes.push(route));
});

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/health') {
    sendJson(res, 200, { status: 'ok', uptime: process.uptime(), dataVersion: (await readDatabase()).meta.version });
    return;
  }

  const handled = await rootRouter.handle(req, res, {});
  if (!handled) {
    sendError(res, 404, `Ruta ${req.method} ${req.url} no encontrada`);
  }
});

server.listen(PORT, () => {
  console.log(`API escuchando en puerto ${PORT}`);
});
