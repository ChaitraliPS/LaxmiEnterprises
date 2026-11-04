import { apiClient } from "./api.js";

/**
 * Expo API service integrated with backend database via apiClient
 */

export const getExpoLeads = async () => {
  const res = await apiClient.get("/expo");
  return res && res.data !== undefined ? res.data : res;
};

export const createExpoLead = async (data) => {
  const res = await apiClient.post("/expo", data);
  return res && res.data !== undefined ? res.data : res;
};

export const updateExpoLead = async (id, data) => {
  const res = await apiClient.put(`/expo/${encodeURIComponent(id)}`, data);
  return res && res.data !== undefined ? res.data : res;
};

// Manual mode logging
export const markBroadcastSent = async (ids) => {
  const res = await apiClient.post("/expo/broadcast", { ids });
  return res && res.data !== undefined ? res.data : res;
};

// Automatic mode (WhatsApp Cloud API)
export const getBroadcastConfig = async () => {
  const res = await apiClient.get("/expo/broadcast/config");
  return res && res.data !== undefined ? res.data : res;
};

export const sendBroadcast = async (payload) => {
  const res = await apiClient.post("/expo/broadcast/send", payload);
  return res && res.data !== undefined ? res.data : res;
};

export const uploadExpoImage = async (file) => {
  const fd = new FormData();
  fd.append("image", file);
  const res = await apiClient.post("/expo/media", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res && res.data !== undefined ? res.data : res;
};
