// src/services/api.js
const API_BASE = '/api';

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
    throw new Error(errorData.detail || errorData.error || `Prediction failed with HTTP ${res.status}`);
  }
  return res.json();
}

export async function runBatchPrediction(items) {
  const res = await fetch(`${API_BASE}/predict/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error(`Batch prediction failed: ${res.statusText}`);
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
    throw new Error(errorData.detail || `CSV processing failed: ${res.statusText}`);
  }
  return res.json();
}
