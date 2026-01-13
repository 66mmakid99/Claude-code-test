import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

// 요청 인터셉터 - 토큰 추가
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 응답 인터셉터 - 에러 처리
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  applyDealer: () => api.post('/auth/apply-dealer')
}

// Reports API
export const reportsAPI = {
  scan: (url) => api.post('/reports/scan', { url }),
  getAll: (page = 1, limit = 10) => api.get(`/reports?page=${page}&limit=${limit}`),
  getById: (id) => api.get(`/reports/${id}`)
}

// Payments API
export const paymentsAPI = {
  request: (data) => api.post('/payments/request', data),
  confirm: (data) => api.post('/payments/confirm', data),
  getHistory: () => api.get('/payments/history')
}

// Dealer API
export const dealerAPI = {
  getDashboard: () => api.get('/dealers/dashboard'),
  getCustomers: (page = 1) => api.get(`/dealers/customers?page=${page}`),
  getCommissions: (page = 1, status = '') =>
    api.get(`/dealers/commissions?page=${page}${status ? `&status=${status}` : ''}`)
}

export default api
