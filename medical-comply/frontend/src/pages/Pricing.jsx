import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { paymentsAPI } from '../services/api'

function Pricing({ user }) {
  const [selectedPlan, setSelectedPlan] = useState(1)
  const [couponCode, setCouponCode] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const plans = [
    { months: 1, price: 99000, label: '1개월', discount: 0 },
    { months: 3, price: 267000, label: '3개월', discount: 10 },
    { months: 12, price: 950000, label: '1년', discount: 20 }
  ]

  const handleSubscribe = async () => {
    if (!user) {
      navigate('/register')
      return
    }

    try {
      setLoading(true)
      const response = await paymentsAPI.request({
        months: selectedPlan,
        couponCode: couponCode || undefined
      })

      // 토스페이먼츠 결제 위젯 호출 (실제 구현 시 SDK 사용)
      alert(`결제 페이지로 이동합니다.\n주문번호: ${response.data.orderId}\n금액: ${response.data.amount.toLocaleString()}원`)

      // 실제로는 TossPayments SDK를 사용하여 결제 진행
      // window.location.href = tossPaymentsWidget.requestPayment(...)
    } catch (err) {
      alert(err.response?.data?.error || '결제 요청 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container" style={{ maxWidth: '900px' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ marginBottom: '1rem' }}>요금제</h1>
        <p style={{ color: 'var(--gray-500)' }}>
          구독하시면 무제한 검사와 상세 리포트를 이용하실 수 있습니다.
        </p>
      </div>

      {/* 무료 vs 프리미엄 비교 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        {/* 무료 플랜 */}
        <div className="card" style={{ border: '2px solid var(--gray-200)' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>무료</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '1rem' }}>
            0<span style={{ fontSize: '1rem', fontWeight: '400' }}>원</span>
          </p>
          <ul style={{ listStyle: 'none', marginBottom: '1.5rem' }}>
            <li style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--gray-100)' }}>
              ✓ 하루 1회 검사
            </li>
            <li style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--gray-100)' }}>
              ✓ 기본 위반 탐지
            </li>
            <li style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--gray-100)', color: 'var(--gray-400)' }}>
              ✗ AI 정밀 분석
            </li>
            <li style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--gray-100)', color: 'var(--gray-400)' }}>
              ✗ PDF 리포트
            </li>
            <li style={{ padding: '0.5rem 0', color: 'var(--gray-400)' }}>
              ✗ 이메일 알림
            </li>
          </ul>
          <button className="btn btn-secondary" style={{ width: '100%' }} disabled>
            현재 플랜
          </button>
        </div>

        {/* 프리미엄 플랜 */}
        <div className="card" style={{ border: '2px solid var(--primary)', position: 'relative' }}>
          <div style={{
            position: 'absolute',
            top: '-12px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--primary)',
            color: 'white',
            padding: '0.25rem 1rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: '600'
          }}>
            추천
          </div>
          <h3 style={{ marginBottom: '0.5rem' }}>프리미엄</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '1rem' }}>
            99,000<span style={{ fontSize: '1rem', fontWeight: '400' }}>원/월</span>
          </p>
          <ul style={{ listStyle: 'none', marginBottom: '1.5rem' }}>
            <li style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--gray-100)' }}>
              ✓ <strong>무제한</strong> 검사
            </li>
            <li style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--gray-100)' }}>
              ✓ 모든 위반 탐지
            </li>
            <li style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--gray-100)' }}>
              ✓ <strong>AI 정밀 분석</strong>
            </li>
            <li style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--gray-100)' }}>
              ✓ PDF 리포트 다운로드
            </li>
            <li style={{ padding: '0.5rem 0' }}>
              ✓ 이메일 알림
            </li>
          </ul>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSubscribe} disabled={loading}>
            {loading ? '처리중...' : '구독하기'}
          </button>
        </div>
      </div>

      {/* 기간 선택 */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>구독 기간 선택</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {plans.map((plan) => (
            <button
              key={plan.months}
              className={`btn ${selectedPlan === plan.months ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedPlan(plan.months)}
              style={{ flex: 1, minWidth: '120px', position: 'relative' }}
            >
              {plan.label}
              {plan.discount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  background: 'var(--danger)',
                  color: 'white',
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  borderRadius: '9999px'
                }}>
                  -{plan.discount}%
                </span>
              )}
              <br />
              <span style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                {plan.price.toLocaleString()}원
              </span>
            </button>
          ))}
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
            추천인 코드 (선택)
          </label>
          <input
            type="text"
            className="input"
            placeholder="추천인 코드가 있으면 입력하세요"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            style={{ maxWidth: '300px' }}
          />
        </div>

        <button className="btn btn-primary" onClick={handleSubscribe} disabled={loading}>
          {loading ? '처리중...' : `${plans.find(p => p.months === selectedPlan)?.price.toLocaleString()}원 결제하기`}
        </button>
      </div>
    </div>
  )
}

export default Pricing
