import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

export const api = axios.create({ baseURL: API_BASE })

// Inyectar token automáticamente
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Si el token expira → logout automático
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  getUsers:  ()              => api.get('/auth/users'),
  login:     (user_id, pin)  => api.post('/auth/login', { user_id, pin }),
  me:        ()              => api.get('/auth/me'),
  changePin: (current_pin, new_pin) => api.put('/auth/change-pin', { current_pin, new_pin }),
}

export const productsApi = {
  list:        (params)           => api.get('/products', { params }),
  get:         (id)               => api.get(`/products/${id}`),
  create:      (data)             => api.post('/products', data),
  update:      (id, data)         => api.put(`/products/${id}`, data),
  adjustStock: (id, quantity, note) => api.post(`/products/${id}/stock`, { quantity, note }),
  deactivate:  (id)               => api.delete(`/products/${id}`),
  categories:  ()                 => api.get('/products/categories'),
  lowStock:    ()                 => api.get('/products/low-stock'),
}

export const clientsApi = {
  list:       (params) => api.get('/clients', { params }),
  search:     (q)      => api.get('/clients/search', { params: { q } }),
  get:        (id)     => api.get(`/clients/${id}`),
  history:    (id)     => api.get(`/clients/${id}/history`),
  create:     (data)   => api.post('/clients', data),
  update:     (id, data) => api.put(`/clients/${id}`, data),
  deactivate: (id)     => api.delete(`/clients/${id}`),
}

export const salesApi = {
  list:        (params) => api.get('/sales', { params }),
  get:         (id)     => api.get(`/sales/${id}`),
  create:      (data)   => api.post('/sales', data),
  cancel:      (id)     => api.put(`/sales/${id}/cancel`),
  sendInvoice: (id)     => api.post(`/sales/${id}/send-invoice`),
}

export const cashApi = {
  open:        (data) => api.post('/cash/open', data),
  active:      ()     => api.get('/cash/active'),
  addMovement: (data) => api.post('/cash/movement', data),
  close:       (data) => api.post('/cash/close', data),
  history:     ()     => api.get('/cash/history'),
}

export const reportsApi = {
  summary:      (params) => api.get('/reports/summary', { params }),
  topProducts:  (params) => api.get('/reports/top-products', { params }),
  topClients:   (params) => api.get('/reports/top-clients', { params }),
  byCategory:   (params) => api.get('/reports/by-category', { params }),
  daily:        (params) => api.get('/reports/daily', { params }),
  lowStockAlert: ()      => api.get('/reports/low-stock-alert'),
}
