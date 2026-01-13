import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authAPI } from '../services/api'

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
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.email || !formData.password || !formData.name) {
      setError('필수 항목을 입력해주세요.')
      return
    }

    if (formData.password !== formData.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    if (formData.password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }

    try {
      setLoading(true)
      const response = await authAPI.register(formData)
      onLogin(response.data.user, response.data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || '회원가입 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container" style={{ maxWidth: '450px', paddingTop: '2rem' }}>
      <div className="card">
        <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>회원가입</h1>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              이메일 <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="email"
              name="email"
              className="input"
              value={formData.email}
              onChange={handleChange}
              placeholder="example@email.com"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              비밀번호 <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="password"
              name="password"
              className="input"
              value={formData.password}
              onChange={handleChange}
              placeholder="8자 이상"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              비밀번호 확인 <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="password"
              name="passwordConfirm"
              className="input"
              value={formData.passwordConfirm}
              onChange={handleChange}
              placeholder="비밀번호 재입력"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              이름 <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              name="name"
              className="input"
              value={formData.name}
              onChange={handleChange}
              placeholder="홍길동"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              연락처
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

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              회사/병원명
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

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              추천인 코드
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

          {error && (
            <p style={{ color: 'var(--danger)', marginBottom: '1rem', textAlign: 'center' }}>
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
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
