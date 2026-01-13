import { Link } from 'react-router-dom'

function Header({ user, onLogout }) {
  return (
    <header className="header">
      <div className="container header-content">
        <Link to="/" className="logo">
          MedicalComply
        </Link>

        <nav className="nav-links">
          <Link to="/pricing">요금제</Link>

          {user ? (
            <>
              <Link to="/dashboard">대시보드</Link>
              {(user.role === 'dealer' || user.role === 'admin') && (
                <Link to="/dealer">딜러 관리</Link>
              )}
              <span style={{ color: '#6b7280' }}>{user.name}님</span>
              <button className="btn btn-secondary" onClick={onLogout}>
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link to="/login">로그인</Link>
              <Link to="/register">
                <button className="btn btn-primary">무료 시작</button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

export default Header
