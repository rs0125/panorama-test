// Thin browser-side wrapper around the /api routes. Each helper returns the
// parsed JSON body (or null on 204) and throws an Error with the server's
// message on non-2xx responses, so admin forms can just try/catch.

async function request(url, { method = 'GET', body } = {}) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  if (res.status === 204) return null;
  const text = await res.text();
  const looksJson = (res.headers.get('content-type') || '').includes('application/json');
  let data = null;
  let parseFailed = false;
  if (text) {
    try { data = JSON.parse(text); } catch { parseFailed = true; }
  }
  if (!res.ok) {
    const msg = data?.error || `${method} ${url} failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  // 2xx but the body is non-JSON (proxy HTML, etc.) is a server-side bug —
  // surface it instead of letting the caller destructure `null`.
  if (parseFailed || (looksJson === false && text)) {
    const err = new Error(`${method} ${url} returned a non-JSON 2xx response`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  // Tours
  createTour: (body) => request('/api/tours', { method: 'POST', body }),
  updateTour: (id, body) => request(`/api/tours/${id}`, { method: 'PATCH', body }),
  deleteTour: (id) => request(`/api/tours/${id}`, { method: 'DELETE' }),

  // Scenes
  createScene: (tourId, body) =>
    request(`/api/tours/${tourId}/scenes`, { method: 'POST', body }),
  reorderScenes: (tourId, order) =>
    request(`/api/tours/${tourId}/scenes/reorder`, { method: 'POST', body: { order } }),
  updateScenePositions: (tourId, positions) =>
    request(`/api/tours/${tourId}/scenes/positions`, { method: 'POST', body: { positions } }),
  updateScene: (id, body) => request(`/api/scenes/${id}`, { method: 'PATCH', body }),
  deleteScene: (id) => request(`/api/scenes/${id}`, { method: 'DELETE' }),

  // Annotations
  createAnnotation: (sceneId, body) =>
    request(`/api/scenes/${sceneId}/annotations`, { method: 'POST', body }),
  updateAnnotation: (id, body) =>
    request(`/api/annotations/${id}`, { method: 'PATCH', body }),
  deleteAnnotation: (id) => request(`/api/annotations/${id}`, { method: 'DELETE' }),

  // Hotspots
  createHotspot: (sceneId, body) =>
    request(`/api/scenes/${sceneId}/hotspots`, { method: 'POST', body }),
  updateHotspot: (id, body) =>
    request(`/api/hotspots/${id}`, { method: 'PATCH', body }),
  deleteHotspot: (id) => request(`/api/hotspots/${id}`, { method: 'DELETE' }),
  // Bulk apply hotspot edits for a scene (used by the admin's HotspotEditor).
  bulkHotspots: (sceneId, body) =>
    request(`/api/scenes/${sceneId}/hotspots/bulk`, { method: 'POST', body }),

  // ElevenLabs TTS (admin only)
  ttsVoices: () => request('/api/tts/voices'),
  ttsModels: () => request('/api/tts/models'),
  ttsGenerate: (body) => request('/api/tts/generate', { method: 'POST', body }),

  // Overlays (admin UI coming later)
  createOverlay: (sceneId, body) =>
    request(`/api/scenes/${sceneId}/overlays`, { method: 'POST', body }),
  updateOverlay: (id, body) =>
    request(`/api/overlays/${id}`, { method: 'PATCH', body }),
  deleteOverlay: (id) => request(`/api/overlays/${id}`, { method: 'DELETE' }),
};
