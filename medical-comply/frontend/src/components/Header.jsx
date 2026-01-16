import { Link } from 'react-router-dom'

function Header({ user, onLogout }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container flex h-14 items-center justify-between">
        <Link to="/" className="text-lg font-semibold tracking-tight text-gray-900">
          MADMEDCHECK
        </Link>

        <nav className="flex items-center gap-1">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors"
              >
                대시보드
              </Link>
              <Link
                to="/aeo"
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors"
              >
                AEO 분석
              </Link>
              <Link
                to="/scan"
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors"
              >
                의료광고
              </Link>
              <Link
                to="/viral"
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors"
              >
                모니터링
              </Link>
              {(user.role === 'dealer' || user.role === 'admin') && (
                <Link
                  to="/dealer"
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors"
                >
                  딜러
                </Link>
              )}
              <div className="ml-2 pl-2 border-l flex items-center gap-2">
                <span className="text-sm text-gray-500">{user.name}</span>
                <button
                  onClick={onLogout}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors"
                >
                  로그아웃
                </button>
              </div>
            </>
          ) : (
            <>
              <Link
                to="/aeo"
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors"
              >
                AEO 분석
              </Link>
              <Link
                to="/scan"
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors"
              >
                의료광고
              </Link>
              <Link
                to="/pricing"
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors"
              >
                요금제
              </Link>
              <div className="ml-2 pl-2 border-l flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors"
                >
                  로그인
                </Link>
                <Link to="/register">
                  <button className="btn btn-primary h-8 px-4 text-sm">
                    시작하기
                  </button>
                </Link>
              </div>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

export default Header
