import { useState, useEffect } from 'react'
import { authAPI, getOAuthUrl, OAUTH_CONFIG } from '../services/api'

// 소셜 로그인 아이콘 SVG
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

const NaverIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path fill="#03C75A" d="M16.273 12.845L7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727v12.845z"/>
  </svg>
)

const KakaoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path fill="#000000" d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 0 1-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.866C1.5 6.665 6.201 3 12 3z"/>
  </svg>
)

function SocialLoginButtons({ onLogin, disabled = false }) {
  const [providers, setProviders] = useState({
    google: false,
    naver: false,
    kakao: false
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 서버에서 활성화된 OAuth 프로바이더 확인
    const checkProviders = async () => {
      try {
        const response = await authAPI.getOAuthProviders()
        setProviders(response.data)
      } catch (error) {
        console.error('OAuth providers 확인 실패:', error)
        // 클라이언트 설정으로 폴백
        setProviders({
          google: !!OAUTH_CONFIG.google.clientId,
          naver: !!OAUTH_CONFIG.naver.clientId,
          kakao: !!OAUTH_CONFIG.kakao.clientId
        })
      } finally {
        setLoading(false)
      }
    }
    checkProviders()
  }, [])

  const handleSocialLogin = (provider) => {
    const url = getOAuthUrl(provider)
    if (url) {
      // 현재 페이지 정보 저장 (콜백 후 리다이렉트용)
      sessionStorage.setItem('oauth_redirect', window.location.pathname)
      window.location.href = url
    } else {
      alert(`${provider} 로그인이 현재 설정되지 않았습니다.`)
    }
  }

  // 사용 가능한 프로바이더가 없으면 렌더링하지 않음
  const hasAnyProvider = providers.google || providers.naver || providers.kakao
  if (loading || !hasAnyProvider) return null

  const buttonStyle = (bgColor, textColor = '#fff') => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '0.5rem',
    border: bgColor === '#fff' ? '1px solid #ddd' : 'none',
    background: bgColor,
    color: textColor,
    fontWeight: '500',
    fontSize: '0.9rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'all 0.2s ease'
  })

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1rem'
      }}>
        <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
        <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>간편 로그인</span>
        <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {providers.google && (
          <button
            type="button"
            onClick={() => handleSocialLogin('google')}
            disabled={disabled}
            style={buttonStyle('#fff', '#333')}
          >
            <GoogleIcon />
            Google로 계속하기
          </button>
        )}

        {providers.naver && (
          <button
            type="button"
            onClick={() => handleSocialLogin('naver')}
            disabled={disabled}
            style={buttonStyle('#03C75A')}
          >
            <NaverIcon />
            네이버로 계속하기
          </button>
        )}

        {providers.kakao && (
          <button
            type="button"
            onClick={() => handleSocialLogin('kakao')}
            disabled={disabled}
            style={buttonStyle('#FEE500', '#000')}
          >
            <KakaoIcon />
            카카오로 계속하기
          </button>
        )}
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        margin: '1.5rem 0 0 0'
      }}>
        <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
        <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>또는</span>
        <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
      </div>
    </div>
  )
}

export default SocialLoginButtons
