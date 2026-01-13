import { useState, useEffect } from 'react'
import { dealerAPI } from '../services/api'

function DealerDashboard() {
  const [dashboard, setDashboard] = useState(null)
  const [customers, setCustomers] = useState([])
  const [commissions, setCommissions] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  useEffect(() => {
    if (activeTab === 'customers') {
      loadCustomers()
    } else if (activeTab === 'commissions') {
      loadCommissions()
    }
  }, [activeTab])

  const loadDashboard = async () => {
    try {
      const response = await dealerAPI.getDashboard()
      setDashboard(response.data)
    } catch (err) {
      console.error('대시보드 로드 실패:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadCustomers = async () => {
    try {
      const response = await dealerAPI.getCustomers()
      setCustomers(response.data.customers)
    } catch (err) {
      console.error('고객 목록 로드 실패:', err)
    }
  }

  const loadCommissions = async () => {
    try {
      const response = await dealerAPI.getCommissions()
      setCommissions(response.data.commissions)
    } catch (err) {
      console.error('수수료 내역 로드 실패:', err)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    alert('복사되었습니다!')
  }

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
      </div>
    )
  }

  return (
    <div className="container">
      <h1 style={{ marginBottom: '2rem' }}>딜러 대시보드</h1>

      {/* 추천 코드 */}
      <div className="card" style={{ marginBottom: '2rem', background: 'linear-gradient(135deg, var(--primary), #4f46e5)', color: 'white' }}>
        <p style={{ marginBottom: '0.5rem', opacity: 0.9 }}>나의 추천 코드</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: '700', letterSpacing: '2px' }}>
            {dashboard?.couponCode}
          </span>
          <button
            onClick={() => copyToClipboard(dashboard?.couponCode)}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '0.25rem',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            복사
          </button>
        </div>
        <p style={{ marginTop: '1rem', fontSize: '0.875rem', opacity: 0.8 }}>
          추천 링크: {window.location.origin}/register?ref={dashboard?.couponCode}
        </p>
      </div>

      {/* 통계 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--gray-500)', marginBottom: '0.5rem' }}>추천 고객</p>
          <p style={{ fontSize: '2rem', fontWeight: '700' }}>{dashboard?.totalCustomers || 0}</p>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>명</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--gray-500)', marginBottom: '0.5rem' }}>총 수수료</p>
          <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--secondary)' }}>
            {(dashboard?.totalCommission || 0).toLocaleString()}
          </p>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>원</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--gray-500)', marginBottom: '0.5rem' }}>이번 달</p>
          <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary)' }}>
            {(dashboard?.monthlyCommission || 0).toLocaleString()}
          </p>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>원</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--gray-500)', marginBottom: '0.5rem' }}>대기 수수료</p>
          <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--warning)' }}>
            {(dashboard?.pendingCommission || 0).toLocaleString()}
          </p>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>원</p>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', borderBottom: '2px solid var(--gray-200)' }}>
        {[
          { id: 'overview', label: '개요' },
          { id: 'customers', label: '추천 고객' },
          { id: 'commissions', label: '수수료 내역' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.75rem 1rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? '600' : '400',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--gray-500)',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-2px'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 내용 */}
      <div className="card">
        {activeTab === 'overview' && (
          <div>
            <h3 style={{ marginBottom: '1rem' }}>수수료 안내</h3>
            <ul style={{ color: 'var(--gray-500)', lineHeight: 2 }}>
              <li>추천 고객이 구독 결제 시 <strong style={{ color: 'var(--primary)' }}>50% 수수료</strong>가 적립됩니다.</li>
              <li>월 99,000원 구독 → 49,500원 수수료</li>
              <li>수수료는 매월 15일에 정산됩니다.</li>
              <li>정산 요청은 50,000원 이상부터 가능합니다.</li>
            </ul>
          </div>
        )}

        {activeTab === 'customers' && (
          <div>
            <h3 style={{ marginBottom: '1rem' }}>추천 고객 목록</h3>
            {customers.length === 0 ? (
              <p style={{ color: 'var(--gray-500)', textAlign: 'center', padding: '2rem' }}>
                아직 추천 고객이 없습니다.
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--gray-200)' }}>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>이름</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>회사</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem' }}>구독상태</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem' }}>발생 수수료</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem' }}>가입일</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                      <td style={{ padding: '0.75rem' }}>{customer.name}</td>
                      <td style={{ padding: '0.75rem' }}>{customer.company_name || '-'}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <span className={`badge ${customer.subscription_status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                          {customer.subscription_status === 'active' ? '구독중' : '무료'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {parseInt(customer.total_commission || 0).toLocaleString()}원
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--gray-500)' }}>
                        {new Date(customer.created_at).toLocaleDateString('ko-KR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'commissions' && (
          <div>
            <h3 style={{ marginBottom: '1rem' }}>수수료 내역</h3>
            {commissions.length === 0 ? (
              <p style={{ color: 'var(--gray-500)', textAlign: 'center', padding: '2rem' }}>
                아직 수수료 내역이 없습니다.
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--gray-200)' }}>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>고객</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem' }}>주문번호</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem' }}>수수료</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem' }}>상태</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem' }}>날짜</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((comm) => (
                    <tr key={comm.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                      <td style={{ padding: '0.75rem' }}>{comm.customer_name}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', fontFamily: 'monospace' }}>
                        {comm.order_id}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>
                        {comm.amount.toLocaleString()}원
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <span className={`badge ${
                          comm.status === 'paid' ? 'badge-success' :
                          comm.status === 'approved' ? 'badge-warning' : 'badge-critical'
                        }`}>
                          {comm.status === 'paid' ? '지급완료' :
                           comm.status === 'approved' ? '승인' : '대기'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--gray-500)' }}>
                        {new Date(comm.created_at).toLocaleDateString('ko-KR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default DealerDashboard
