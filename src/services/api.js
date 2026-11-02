import axios from "axios";

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return "http://localhost:5000/api/v1";
  const clean = envUrl.trim().replace(/\/+$/, "");
  if (clean.endsWith("/api/v1") || clean.endsWith("/api")) {
    return clean;
  }
  return `${clean}/api/v1`;
};

const API_BASE_URL = getBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor: Attach JWT Bearer Token to all requests
apiClient.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem("le_jwt_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // Ignore
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor: Standardize API responses & handle 401 unauthenticated
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // If unauthorized, clean invalid token
      localStorage.removeItem("le_jwt_token");
      localStorage.removeItem("le_auth_user");
    }
    const errorMsg =
      error.response?.data?.message ||
      error.message ||
      "An unexpected error occurred while communicating with the backend.";
    return Promise.reject(new Error(errorMsg));
  }
);

// ERP API Modules
export const erpApi = {
  // Health Check
  checkHealth: () => {
    const rootUrl = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
    return axios.get(`${rootUrl}/api/health`);
  },

  // Master Synchronization (MySQL Database <-> Frontend)
  getAllData: () => apiClient.get("/sync/all"),
  syncClients: (clients) => apiClient.post("/sync/clients", clients),
  syncVendors: (vendors) => apiClient.post("/sync/vendors", vendors),
  syncProducts: (products) => apiClient.post("/sync/products", products),
  syncInventory: (inventory) => apiClient.post("/sync/inventory", inventory),
  syncExpoLeads: (expoLeads) => apiClient.post("/sync/expo", expoLeads),
  syncCompany: (company) => apiClient.post("/sync/company", company),

  // Auth & Profile Management (MySQL backed with JWT & Bcrypt)
  login: (credentials) => apiClient.post("/auth/login", credentials),
  register: (userData) => apiClient.post("/auth/register", userData),
  getMe: () => apiClient.get("/auth/me"),
  updateProfile: (profileData) => apiClient.put("/auth/profile", profileData),
  updatePassword: (passwords) => apiClient.put("/auth/password", passwords),
  getUsers: () => apiClient.get("/auth/users"),
  createUser: (userData) => apiClient.post("/auth/users", userData),
  deleteUser: (id) => apiClient.delete(`/auth/users/${id}`),

  // Direct CRUD
  getClients: (params) => apiClient.get("/clients", { params }),
  getClient: (id) => apiClient.get(`/clients/${id}`),
  createClient: (data) => apiClient.post("/clients", data),
  updateClient: (id, data) => apiClient.put(`/clients/${id}`, data),
  deleteClient: (id) => apiClient.delete(`/clients/${id}`),

  getVendors: (params) => apiClient.get("/vendors", { params }),
  getVendor: (id) => apiClient.get(`/vendors/${id}`),
  createVendor: (data) => apiClient.post("/vendors", data),
  updateVendor: (id, data) => apiClient.put(`/vendors/${id}`, data),
  deleteVendor: (id) => apiClient.delete(`/vendors/${id}`),

  getProducts: () => apiClient.get("/products"),
  createProduct: (data) => apiClient.post("/products", data),
  updateProduct: (id, data) => apiClient.put(`/products/${id}`, data),
  deleteProduct: (id) => apiClient.delete(`/products/${id}`),

  getInventory: () => apiClient.get("/inventory"),
  getStockMovements: (params) => apiClient.get("/inventory/movements", { params }),
  updateStock: (productId, data) => apiClient.put(`/inventory/${productId}`, data),
  adjustStock: (productId, adjustment, warehouseLocation, reason) =>
    apiClient.post(`/inventory/${productId}/adjust`, { adjustment, warehouseLocation, reason }),

  getPurchases: () => apiClient.get("/purchases"),
  createPurchase: (data) => apiClient.post("/purchases", data),
  recordVendorPayment: (id, data) => apiClient.post(`/purchases/${id}/payment`, data),
  updatePurchase: (id, data) => apiClient.put(`/purchases/${id}`, data),
  deletePurchase: (id) => apiClient.delete(`/purchases/${id}`),

  getInvoices: () => apiClient.get("/invoices"),
  createInvoice: (data) => apiClient.post("/invoices", data),
  updateInvoice: (id, data) => apiClient.put(`/invoices/${id}`, data),
  recordPayment: (id, data) => apiClient.post(`/invoices/${id}/payment`, data),
  deleteInvoice: (id) => apiClient.delete(`/invoices/${id}`),

  getLeads: () => apiClient.get("/expo"),
  createLead: (data) => apiClient.post("/expo", data),
  updateLead: (id, data) => apiClient.put(`/expo/${id}`, data),
  markBroadcast: (ids) => apiClient.post("/expo/broadcast", { ids }),

  getCompany: () => apiClient.get("/company"),
  updateCompany: (data) => apiClient.put("/company", data),

  getDashboardStats: (params) => apiClient.get("/dashboard/stats", { params }),
  getRevenueSummary: (params) => apiClient.get("/revenue/summary", { params }),
  getQuarterlyBreakdown: (params) => apiClient.get("/revenue/quarterly", { params }),
  get12MonthCashFlow: (params) => apiClient.get("/revenue/cash-flow", { params }),
  getCategoryTurnover: (params) => apiClient.get("/revenue/categories", { params }),

  // Consistency Check (Admin Workspace)
  getConsistencyReport: (params) => apiClient.get("/admin/consistency-check", { params }),

  // Fiscal Targets (MySQL backed)
  getTargets: (params) => apiClient.get("/targets", { params }),
  updateTarget: (data) => apiClient.put("/targets", data),
  saveBulkTargets: (targets) => apiClient.post("/targets/bulk", { targets }),
};

export default erpApi;
