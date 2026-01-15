import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { authAPI, OAUTH_CONFIG } from '../services/api'

function OAuthCallback({ onLogin }) {
  const { provider } = useParams()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('processing')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const errorParam = searchParams.get('error')

      // 에러 파라미터 확인
      if (errorParam) {
        setStatus('error')
        setError(`OAuth 인증 실패: ${searchParams.get('error_description') || errorParam}`)
        return
      }

      // 코드 확인
      if (!code) {
        setStatus('error')
        setError('인증 코드가 없습니다.')
        return
      }

      // state 검증 (CSRF 방지)
      const savedState = sessionStorage.getItem('oauth_state')
      if (state !== savedState) {
        setStatus('error')
        setError('보안 검증에 실패했습니다. 다시 시도해주세요.')
        return
      }

      try {
        const config = OAUTH_CONFIG[provider]
        if (!config) {
          throw new Error('지원하지 않는 로그인 방식입니다.')
        }

        // 프로바이더별 API 호출
        let response
        const redirectUri = config.redirectUri

        switch (provider) {
          case 'google':
            response = await authAPI.googleLogin({ code, redirectUri })
            break
          case 'naver':
            response = await authAPI.naverLogin({ code, state, redirectUri })
            break
          case 'kakao':
            response = await authAPI.kakaoLogin({ code, redirectUri })
            break
          default:
            throw new Error('지원하지 않는 로그인 방식입니다.')
        }

        // 로그인 성공
        const { user, token, isNew } = response.data
        onLogin(user, token)

        // 저장된 리다이렉트 경로로 이동 또는 대시보드
        const redirectPath = sessionStorage.getItem('oauth_redirect') || '/dashboard'
        sessionStorage.removeItem('oauth_redirect')
        sessionStorage.removeItem('oauth_state')

        setStatus('success')

        // 잠시 후 리다이렉트
        setTimeout(() => {
          navigate(redirectPath)
        }, 1000)

      } catch (err) {
        console.error('OAuth 처리 실패:', err)
        setStatus('error')
        setError(err.response?.data?.error || err.message || '로그인 처리 중 오류가 발생했습니다.')
      }
    }

    handleCallback()
  }, [provider, searchParams, navigate, onLogin])

  const getProviderName = () => {
    switch (provider) {
      case 'google': return 'Google'
      case 'naver': return '네이버'
      case 'kakao': return '카카오'
      default: return '소셜'
    }
  }

  const getProviderColor = () => {
    switch (provider) {
      case 'google': return '#4285F4'
      case 'naver': return '#03C75A'
      case 'kakao': return '#FEE500'
      default: return '#333'
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#f9fafb'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '3rem',
        background: 'white',
        borderRadius: '1rem',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        maxWidth: '400px',
        width: '90%'
      }}>
        {status === 'processing' && (
          <>
            <div style={{
              width: '60px',
              height: '60px',
              margin: '0 auto 1.5rem',
              border: `4px solid ${getProviderColor()}`,
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <h2 style={{ marginBottom: '0.5rem', color: '#333' }}>
              {getProviderName()} 로그인 중...
            </h2>
            <p style={{ color: '#666' }}>잠시만 기다려주세요.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{
              width: '60px',
              height: '60px',
              margin: '0 auto 1.5rem',
              background: '#10B981',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
            </div>
            <h2 style={{ marginBottom: '0.5rem', color: '#333' }}>
              로그인 성공!
            </h2>
            <p style={{ color: '#666' }}>대시보드로 이동합니다...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{
              width: '60px',
              height: '60px',
              margin: '0 auto 1.5rem',
              background: '#EF4444',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </div>
            <h2 style={{ marginBottom: '0.5rem', color: '#333' }}>
              로그인 실패
            </h2>
            <p style={{ color: '#EF4444', marginBottom: '1.5rem' }}>{error}</p>
            <button
              onClick={() => navigate('/login')}
              style={{
                padding: '0.75rem 2rem',
                background: '#3B82F6',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              다시 시도하기
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default OAuthCallback
