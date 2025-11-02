import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data');
const DB_FILE = join(DATA_DIR, 'database.json');

import { hashPassword } from './security.js';

const baseState = () => ({
  meta: {
    version: 1,
    createdAt: new Date().toISOString()
  },
  branches: [
    { id: 'branch-sanpedro', code: 'SPS', name: 'Sucursal San Pedro', address: 'Blvd. del Sur, San Pedro Sula', phone: '+504-555-0101' },
    { id: 'branch-tegucigalpa', code: 'TGU', name: 'Sucursal Tegucigalpa', address: 'Col. Palmira, Tegucigalpa', phone: '+504-555-0202' }
  ],
  users: (() => {
    const admin = hashPassword('admin123');
    const manager = hashPassword('sps12345');
    return [
      {
        id: 'user-admin',
        email: 'admin@taller.local',
        role: 'SUPER_ADMIN',
        passwordSalt: admin.salt,
        passwordHash: admin.hash,
        firstName: 'Admin',
        lastName: 'General',
        branchId: null,
        phone: '+504-555-0000',
        createdAt: new Date().toISOString()
      },
      {
        id: 'user-sanpedro-manager',
        email: 'sps.manager@taller.local',
        role: 'BRANCH_MANAGER',
        passwordSalt: manager.salt,
        passwordHash: manager.hash,
        firstName: 'Carla',
        lastName: 'Hernández',
        branchId: 'branch-sanpedro',
        phone: '+504-555-1010',
        createdAt: new Date().toISOString()
      }
    ];
  })(),
  sessions: [],
  inventoryItems: [
    {
      id: 'item-aceite-5w30',
      sku: 'OIL-5W30',
      name: 'Aceite Sintético 5W30',
      brand: 'Total',
      compatibleModels: ['VIN-COROLLA-2018', 'VIN-CIVIC-2019'],
      cost: 250,
      price: 425,
      unit: 'LTS',
      minStock: 10,
      createdAt: new Date().toISOString()
    },
    {
      id: 'item-filtro-aire',
      sku: 'FLT-AIRE',
      name: 'Filtro de Aire Universal',
      brand: 'Bosch',
      compatibleModels: ['VIN-COROLLA-2018', 'VIN-HILUX-2020'],
      cost: 180,
      price: 320,
      unit: 'UND',
      minStock: 8,
      createdAt: new Date().toISOString()
    }
  ],
  inventoryStocks: [
    { id: randomUUID(), itemId: 'item-aceite-5w30', branchId: 'branch-sanpedro', quantity: 35 },
    { id: randomUUID(), itemId: 'item-aceite-5w30', branchId: 'branch-tegucigalpa', quantity: 22 },
    { id: randomUUID(), itemId: 'item-filtro-aire', branchId: 'branch-sanpedro', quantity: 18 },
    { id: randomUUID(), itemId: 'item-filtro-aire', branchId: 'branch-tegucigalpa', quantity: 11 }
  ],
  inventoryTransfers: [],
  inventoryAudits: [],
  inventoryAuditRecords: [],
  fiscalSeries: [
    {
      id: 'serie-sps-2025',
      branchId: 'branch-sanpedro',
      cai: 'A1B2C3-SPS-2025',
      prefix: '000-001-01',
      startNumber: 1,
      endNumber: 500,
      nextNumber: 1,
      expiresAt: '2026-01-31',
      status: 'ACTIVE'
    },
    {
      id: 'serie-tgu-2025',
      branchId: 'branch-tegucigalpa',
      cai: 'A1B2C3-TGU-2025',
      prefix: '000-002-01',
      startNumber: 1,
      endNumber: 500,
      nextNumber: 1,
      expiresAt: '2026-01-31',
      status: 'ACTIVE'
    }
  ],
  invoices: [],
  creditNotes: [],
  reconciliations: [],
  workOrders: [],
  accountingEntries: [],
  qaIncidents: []
});

async function ensureDatabase() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(DB_FILE);
  } catch {
    const seed = baseState();
    await fs.writeFile(DB_FILE, JSON.stringify(seed, null, 2), 'utf8');
  }
}

async function readRaw() {
  await ensureDatabase();
  const content = await fs.readFile(DB_FILE, 'utf8');
  return JSON.parse(content);
}

async function writeRaw(db) {
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

let queue = Promise.resolve();

export async function readDatabase() {
  return structuredClone(await readRaw());
}

export function withDatabase(mutator) {
  queue = queue.then(async () => {
    const db = await readRaw();
    const result = await mutator(db);
    await writeRaw(db);
    return result;
  });
  return queue;
}

export function generateId(prefix) {
  return `${prefix}-${randomUUID()}`;
}

export async function resetDatabase() {
  const seed = baseState();
  await fs.writeFile(DB_FILE, JSON.stringify(seed, null, 2), 'utf8');
  queue = Promise.resolve();
}
