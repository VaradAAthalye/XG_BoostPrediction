// src/services/api.js
const API_BASE = '/api';

function extractErrorMessage(errorData, statusText, status) {
  if (!errorData) return statusText || `Request failed (${status})`;
  if (typeof errorData === 'string') return errorData;
  if (typeof errorData.detail === 'string') return errorData.detail;
  if (Array.isArray(errorData.detail)) {
    return errorData.detail
      .map(d => {
        const field = d.loc && d.loc.length > 1 ? `${d.loc.slice(1).join('.')}: ` : '';
        return `${field}${d.msg || 'Invalid value'}`;
      })
      .join(' | ');
  }
  if (errorData.error) {
    return typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error);
  }
  if (errorData.detail && typeof errorData.detail === 'object') {
    return JSON.stringify(errorData.detail);
  }
  return statusText || `Request failed with HTTP ${status}`;
}

export async function fetchStatus() {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) throw new Error(`Status check failed: ${res.statusText}`);
  return res.json();
}

export async function fetchModelInsights() {
  const res = await fetch(`${API_BASE}/model/insights`);
  if (!res.ok) throw new Error(`Model insights fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchPresets() {
  const res = await fetch(`${API_BASE}/presets`);
  if (!res.ok) throw new Error(`Presets fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchBenchmarkDataset() {
  const res = await fetch(`${API_BASE}/benchmark/dataset`);
  if (!res.ok) throw new Error(`Benchmark dataset fetch failed: ${res.statusText}`);
  return res.json();
}

export async function runPrediction(inputs) {
  const res = await fetch(`${API_BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inputs),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMsg = extractErrorMessage(errorData, res.statusText, res.status);
    throw new Error(errorMsg);
  }
  return res.json();
}

export async function runBatchPrediction(items) {
  const res = await fetch(`${API_BASE}/predict/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMsg = extractErrorMessage(errorData, res.statusText, res.status);
    throw new Error(errorMsg);
  }
  return res.json();
}

export async function uploadCsvFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/upload/csv`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMsg = extractErrorMessage(errorData, res.statusText, res.status);
    throw new Error(errorMsg);
  }
  return res.json();
}
