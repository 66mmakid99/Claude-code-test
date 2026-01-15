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
  applyDealer: () => api.post('/auth/apply-dealer'),
  // OAuth 소셜 로그인
  getOAuthProviders: () => api.get('/auth/oauth/providers'),
  googleLogin: (data) => api.post('/auth/oauth/google', data),
  naverLogin: (data) => api.post('/auth/oauth/naver', data),
  kakaoLogin: (data) => api.post('/auth/oauth/kakao', data)
}

// OAuth 설정 (환경변수에서 가져오거나 기본값 사용)
export const OAUTH_CONFIG = {
  google: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    redirectUri: `${window.location.origin}/oauth/callback/google`,
    scope: 'email profile',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth'
  },
  naver: {
    clientId: import.meta.env.VITE_NAVER_CLIENT_ID || '',
    redirectUri: `${window.location.origin}/oauth/callback/naver`,
    authUrl: 'https://nid.naver.com/oauth2.0/authorize'
  },
  kakao: {
    clientId: import.meta.env.VITE_KAKAO_CLIENT_ID || '',
    redirectUri: `${window.location.origin}/oauth/callback/kakao`,
    authUrl: 'https://kauth.kakao.com/oauth/authorize'
  }
}

// OAuth 인증 URL 생성 헬퍼
export const getOAuthUrl = (provider) => {
  const config = OAUTH_CONFIG[provider]
  if (!config || !config.clientId) return null

  const state = Math.random().toString(36).substring(7)
  sessionStorage.setItem('oauth_state', state)

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    state
  })

  if (provider === 'google') {
    params.append('scope', config.scope)
  }

  return `${config.authUrl}?${params.toString()}`
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
