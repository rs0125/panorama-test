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
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const msg = data?.error || `${method} ${url} failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

export const api = {
  // Tours
  listTours: () => request('/api/tours'),
  createTour: (body) => request('/api/tours', { method: 'POST', body }),
  getTour: (id) => request(`/api/tours/${id}`),
  updateTour: (id, body) => request(`/api/tours/${id}`, { method: 'PATCH', body }),
  deleteTour: (id) => request(`/api/tours/${id}`, { method: 'DELETE' }),

  // Scenes
  createScene: (tourId, body) =>
    request(`/api/tours/${tourId}/scenes`, { method: 'POST', body }),
  reorderScenes: (tourId, order) =>
    request(`/api/tours/${tourId}/scenes/reorder`, { method: 'POST', body: { order } }),
  updateScenePositions: (tourId, positions) =>
    request(`/api/tours/${tourId}/scenes/positions`, { method: 'POST', body: { positions } }),
  getScene: (id) => request(`/api/scenes/${id}`),
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

  // Overlays (admin UI coming later)
  createOverlay: (sceneId, body) =>
    request(`/api/scenes/${sceneId}/overlays`, { method: 'POST', body }),
  updateOverlay: (id, body) =>
    request(`/api/overlays/${id}`, { method: 'PATCH', body }),
  deleteOverlay: (id) => request(`/api/overlays/${id}`, { method: 'DELETE' }),
};
