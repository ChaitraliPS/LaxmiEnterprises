// Adjust these two lines to match how your other API calls work.
const API_BASE = "/api";
const getToken = () => localStorage.getItem("token");

const buildHeaders = (json = true) => {
  const h = {};
  if (json) h["Content-Type"] = "application/json";
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
};

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}/expo${path}`, options);
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* empty response */
  }
  if (!res.ok) throw new Error(body?.message || `Request failed (${res.status})`);
  return body && body.data !== undefined ? body.data : body;
}

export const createExpoLead = (data) =>
  request("", { method: "POST", headers: buildHeaders(), body: JSON.stringify(data) });

export const updateExpoLead = (id, data) =>
  request(`/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: buildHeaders(),
    body: JSON.stringify(data),
  });

// Manual mode logging
export const markBroadcastSent = (ids) =>
  request("/broadcast", { method: "POST", headers: buildHeaders(), body: JSON.stringify({ ids }) });

// Automatic mode (WhatsApp Cloud API)
export const getBroadcastConfig = () =>
  request("/broadcast/config", { headers: buildHeaders(false) });

export const sendBroadcast = (payload) =>
  request("/broadcast/send", { method: "POST", headers: buildHeaders(), body: JSON.stringify(payload) });

export const uploadExpoImage = (file) => {
  const fd = new FormData();
  fd.append("image", file);
  return request("/media", { method: "POST", headers: buildHeaders(false), body: fd });
};