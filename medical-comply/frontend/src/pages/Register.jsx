import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authAPI } from '../services/api'
import SocialLoginButtons from '../components/SocialLoginButtons'

function Register({ onLogin }) {
  const [searchParams] = useSearchParams()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    name: '',
    phone: '',
    companyName: '',
    couponCode: searchParams.get('ref') || ''
  })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // 실시간 유효성 검사
  useEffect(() => {
    const newErrors = {}

    // 이메일 검증
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '올바른 이메일 형식이 아닙니다.'
    }

    // 비밀번호 검증
    if (formData.password) {
      if (formData.password.length < 8) {
        newErrors.password = '비밀번호는 8자 이상이어야 합니다.'
      } else if (!/(?=.*[a-zA-Z])/.test(formData.password)) {
        newErrors.password = '영문자를 포함해야 합니다.'
      } else if (!/(?=.*[0-9])/.test(formData.password)) {
        newErrors.password = '숫자를 포함해야 합니다.'
      }
    }

    // 비밀번호 확인 검증
    if (formData.passwordConfirm && formData.password !== formData.passwordConfirm) {
      newErrors.passwordConfirm = '비밀번호가 일치하지 않습니다.'
    }

    // 이름 검증
    if (formData.name && formData.name.length < 2) {
      newErrors.name = '이름은 2자 이상이어야 합니다.'
    }

    setErrors(newErrors)
  }, [formData])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setServerError('')
  }

  const isFormValid = () => {
    return (
      formData.email &&
      formData.password &&
      formData.passwordConfirm &&
      formData.name &&
      Object.keys(errors).length === 0
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError('')

    if (!formData.email || !formData.password || !formData.name) {
      setServerError('필수 항목을 모두 입력해주세요.')
      return
    }

    if (Object.keys(errors).length > 0) {
      setServerError('입력 내용을 확인해주세요.')
      return
    }

    try {
      setLoading(true)
      const response = await authAPI.register(formData)
      onLogin(response.data.user, response.data.token)
      navigate('/dashboard')
    } catch (err) {
      const errorMessage = err.response?.data?.error || '회원가입 중 오류가 발생했습니다.'
      const errorDetail = err.response?.data?.detail
      setServerError(errorDetail ? `${errorMessage} (${errorDetail})` : errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = (fieldName) => ({
    borderColor: errors[fieldName] ? 'var(--danger)' : undefined
  })

  return (
    <div className="container" style={{ maxWidth: '450px', paddingTop: '2rem' }}>
      <div className="card">
        <h1 style={{ textAlign: 'center', marginBottom: '1rem' }}>회원가입</h1>

        {/* 소셜 로그인 버튼 */}
        <SocialLoginButtons onLogin={onLogin} disabled={loading} />

        {/* 가입 규정 안내 */}
        <div style={{
          background: 'var(--gray-100)',
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '1.5rem',
          fontSize: '0.875rem'
        }}>
          <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>가입 조건</p>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--gray-600)', lineHeight: 1.8 }}>
            <li>이메일: 유효한 이메일 주소</li>
            <li>비밀번호: 8자 이상, 영문+숫자 포함</li>
            <li>이름: 2자 이상 실명</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit}>
          {/* 이메일 */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              이메일 <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="email"
              name="email"
              className="input"
              style={inputStyle('email')}
              value={formData.email}
              onChange={handleChange}
              placeholder="example@email.com"
            />
            {errors.email && (
              <p style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {errors.email}
              </p>
            )}
          </div>

          {/* 비밀번호 */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              비밀번호 <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="password"
              name="password"
              className="input"
              style={inputStyle('password')}
              value={formData.password}
              onChange={handleChange}
              placeholder="8자 이상 (영문+숫자)"
            />
            {formData.password && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
                <span style={{ color: formData.password.length >= 8 ? 'var(--secondary)' : 'var(--gray-400)' }}>
                  ✓ 8자 이상
                </span>
                {' '}
                <span style={{ color: /[a-zA-Z]/.test(formData.password) ? 'var(--secondary)' : 'var(--gray-400)' }}>
                  ✓ 영문 포함
                </span>
                {' '}
                <span style={{ color: /[0-9]/.test(formData.password) ? 'var(--secondary)' : 'var(--gray-400)' }}>
                  ✓ 숫자 포함
                </span>
              </div>
            )}
            {errors.password && (
              <p style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {errors.password}
              </p>
            )}
          </div>

          {/* 비밀번호 확인 */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              비밀번호 확인 <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="password"
              name="passwordConfirm"
              className="input"
              style={inputStyle('passwordConfirm')}
              value={formData.passwordConfirm}
              onChange={handleChange}
              placeholder="비밀번호 재입력"
            />
            {formData.passwordConfirm && !errors.passwordConfirm && formData.password === formData.passwordConfirm && (
              <p style={{ color: 'var(--secondary)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                ✓ 비밀번호가 일치합니다.
              </p>
            )}
            {errors.passwordConfirm && (
              <p style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {errors.passwordConfirm}
              </p>
            )}
          </div>

          {/* 이름 */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              이름 <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              name="name"
              className="input"
              style={inputStyle('name')}
              value={formData.name}
              onChange={handleChange}
              placeholder="실명 입력"
            />
            {errors.name && (
              <p style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {errors.name}
              </p>
            )}
          </div>

          {/* 연락처 */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              연락처 <span style={{ color: 'var(--gray-400)', fontWeight: '400' }}>(선택)</span>
            </label>
            <input
              type="tel"
              name="phone"
              className="input"
              value={formData.phone}
              onChange={handleChange}
              placeholder="010-1234-5678"
            />
          </div>

          {/* 회사/병원명 */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              회사/병원명 <span style={{ color: 'var(--gray-400)', fontWeight: '400' }}>(선택)</span>
            </label>
            <input
              type="text"
              name="companyName"
              className="input"
              value={formData.companyName}
              onChange={handleChange}
              placeholder="병원명 또는 마케팅 회사명"
            />
          </div>

          {/* 추천인 코드 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              추천인 코드 <span style={{ color: 'var(--gray-400)', fontWeight: '400' }}>(선택)</span>
            </label>
            <input
              type="text"
              name="couponCode"
              className="input"
              value={formData.couponCode}
              onChange={handleChange}
              placeholder="추천인 코드가 있으면 입력"
            />
          </div>

          {/* 서버 에러 메시지 */}
          {serverError && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: 'var(--danger)',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              textAlign: 'center',
              fontSize: '0.875rem'
            }}>
              {serverError}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', opacity: isFormValid() ? 1 : 0.7 }}
            disabled={loading || !isFormValid()}
          >
            {loading ? '가입 중...' : '무료 회원가입'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--gray-500)' }}>
          이미 계정이 있으신가요? <Link to="/login">로그인</Link>
        </p>
      </div>
    </div>
  )
}

export default Register
