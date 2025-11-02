const API_BASE = (window.localStorage.getItem('apiBase') || window.location.origin).replace(/\/$/, '');

async function fetchJson(url, options) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    return { error: error.message };
  }
}

async function refreshHealth() {
  const statusElement = document.getElementById('api-status');
  statusElement.textContent = 'Consultando...';
  const data = await fetchJson(`${API_BASE}/health`);
  if (data.error) {
    statusElement.textContent = `Error: ${data.error}`;
    statusElement.classList.add('error');
  } else {
    statusElement.textContent = `OK · Uptime ${(data.uptime || 0).toFixed(0)}s · v${data.dataVersion ?? 'n/a'}`;
    statusElement.classList.remove('error');
  }
}

async function loadInventory() {
  const list = document.getElementById('inventory-list');
  list.innerHTML = '<li>Cargando inventario...</li>';
  const auth = await loginAdmin();
  if (auth.error) {
    list.innerHTML = `<li>${auth.error}</li>`;
    return;
  }
  const data = await fetchJson(`${API_BASE}/api/v1/inventory/items`, {
    headers: { Authorization: `Bearer ${auth.token}` }
  });
  if (data.error) {
    list.innerHTML = `<li>Error: ${data.error}</li>`;
    return;
  }
  list.innerHTML = '';
  data.slice(0, 5).forEach((item) => {
    const total = item.stocks.reduce((acc, stock) => acc + stock.quantity, 0);
    const branchSummary = item.stocks
      .map((stock) => `${stock.branchId.split('-')[1]}: ${stock.quantity}`)
      .join(' · ');
    const li = document.createElement('li');
    li.textContent = `${item.sku} · ${item.name} · Total ${total} (${branchSummary})`;
    list.appendChild(li);
  });
}

async function loadBilling() {
  const list = document.getElementById('billing-list');
  list.innerHTML = '<li>Cargando series...</li>';
  const auth = await loginAdmin();
  if (auth.error) {
    list.innerHTML = `<li>${auth.error}</li>`;
    return;
  }
  const data = await fetchJson(`${API_BASE}/api/v1/billing/fiscal-series`, {
    headers: { Authorization: `Bearer ${auth.token}` }
  });
  if (data.error) {
    list.innerHTML = `<li>Error: ${data.error}</li>`;
    return;
  }
  list.innerHTML = '';
  data.forEach((serie) => {
    const li = document.createElement('li');
    li.textContent = `${serie.prefix} · CAI ${serie.cai} · Próximo #${serie.nextNumber} / ${serie.endNumber}`;
    list.appendChild(li);
  });
}

async function loadAccounting() {
  const list = document.getElementById('accounting-list');
  list.innerHTML = '<li>Cargando conciliaciones...</li>';
  const auth = await loginAdmin();
  if (auth.error) {
    list.innerHTML = `<li>${auth.error}</li>`;
    return;
  }
  const data = await fetchJson(`${API_BASE}/api/v1/accounting/reconciliations`, {
    headers: { Authorization: `Bearer ${auth.token}` }
  });
  if (data.error) {
    list.innerHTML = `<li>Error: ${data.error}</li>`;
    return;
  }
  if (data.length === 0) {
    list.innerHTML = '<li>No hay conciliaciones registradas. Ejecute una desde la API.</li>';
    return;
  }
  list.innerHTML = '';
  data.slice(-3).forEach((rec) => {
    const li = document.createElement('li');
    li.textContent = `${rec.branchId.split('-')[1]} · ${rec.periodStart} → ${rec.periodEnd} · Δ ${rec.totals.difference.toFixed(2)} HNL`;
    list.appendChild(li);
  });
}

let cachedAuth = null;
async function loginAdmin() {
  if (cachedAuth && cachedAuth.expiresAt > Date.now()) {
    return cachedAuth;
  }
  const credentials = { email: 'admin@taller.local', password: 'admin123' };
  const response = await fetchJson(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  if (response.error) {
    return { error: response.error };
  }
  cachedAuth = { token: response.token, expiresAt: Date.now() + 45 * 60 * 1000 };
  return cachedAuth;
}

async function bootstrap() {
  await refreshHealth();
  await Promise.all([loadInventory(), loadBilling(), loadAccounting()]);
}

document.getElementById('refresh-health').addEventListener('click', refreshHealth);

bootstrap().catch((error) => {
  console.error('Error inicializando panel', error);
});
