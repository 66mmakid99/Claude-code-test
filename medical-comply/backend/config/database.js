const { Pool } = require('pg');
require('dotenv').config();

// Mock 모드 확인 (DB 없이 테스트용)
const isMockMode = !process.env.DATABASE_URL || process.env.MOCK_DB === 'true';

let pool = null;
let mockData = {
  users: [],
  reports: [],
  violations: [],
  payments: [],
  dealer_commissions: [],
  violation_rules: []
};
let mockIdCounters = { users: 1, reports: 1, violations: 1, payments: 1, dealer_commissions: 1 };

if (!isMockMode) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  pool.on('connect', () => {
    console.log('✅ PostgreSQL 데이터베이스 연결됨');
  });

  pool.on('error', (err) => {
    console.error('❌ PostgreSQL 연결 오류:', err);
  });
} else {
  console.log('⚠️  Mock DB 모드로 실행 중 (DATABASE_URL 없음)');

  // 기본 의료법 위반 규칙 초기화
  mockData.violation_rules = [
    { id: 1, code: 'MED001', name: '환자 후기 게시', category: '의료광고', severity: 'critical', description: '환자의 치료 경험담이나 후기를 게시', legal_basis: '의료법 제56조 제2항 제3호', keywords: ['후기', '치료후기', '환자후기', '치료경험', '수술후기'], patterns: [], is_active: true },
    { id: 2, code: 'MED002', name: '치료 전후 사진', category: '의료광고', severity: 'critical', description: '치료 전후 비교 사진 게시', legal_basis: '의료법 제56조 제2항 제4호', keywords: ['전후사진', '비포애프터', 'before', 'after'], patterns: [], is_active: true },
    { id: 3, code: 'MED003', name: '치료 성공률 표시', category: '의료광고', severity: 'critical', description: '치료 성공률이나 효과를 보장하는 표현', legal_basis: '의료법 제56조 제2항 제1호', keywords: ['성공률', '치료율', '완치율', '효과보장', '100%'], patterns: ['\\d+%\\s*(성공|완치|효과)'], is_active: true },
    { id: 4, code: 'MED004', name: '유명인 추천', category: '의료광고', severity: 'warning', description: '유명인이나 연예인의 추천/이용 표시', legal_basis: '의료법 제56조 제2항 제5호', keywords: ['연예인', '유명인', '셀럽', '스타'], patterns: [], is_active: true },
    { id: 5, code: 'MED005', name: '과도한 할인 광고', category: '의료광고', severity: 'warning', description: '과도한 할인이나 이벤트 광고', legal_basis: '의료법 제56조 제2항 제9호', keywords: ['특가', '할인', '이벤트', '프로모션', '무료'], patterns: ['\\d+%\\s*할인'], is_active: true },
    { id: 6, code: 'MED006', name: '최상급 표현 사용', category: '의료광고', severity: 'warning', description: '최고, 최초, 1위 등의 최상급 표현', legal_basis: '의료법 제56조 제2항 제2호', keywords: ['최고', '최초', '1위', '유일', '독보적', '최상'], patterns: [], is_active: true }
  ];
}

// Mock 쿼리 처리 함수
function processMockQuery(text, params = []) {
  const query = text.toLowerCase().trim();

  // SELECT 1 (health check)
  if (query === 'select 1') {
    return { rows: [{ '?column?': 1 }] };
  }

  // SELECT COUNT(*) FROM violation_rules
  if (query.includes('count(*)') && query.includes('violation_rules')) {
    const active = mockData.violation_rules.filter(r => r.is_active);
    return { rows: [{ count: active.length }] };
  }

  // SELECT * FROM violation_rules
  if (query.includes('from violation_rules')) {
    return { rows: mockData.violation_rules.filter(r => r.is_active) };
  }

  // User queries
  if (query.includes('from users')) {
    if (query.includes('where email')) {
      const user = mockData.users.find(u => u.email === params[0]);
      return { rows: user ? [user] : [] };
    }
    if (query.includes('where id')) {
      const user = mockData.users.find(u => u.id === params[0]);
      return { rows: user ? [user] : [] };
    }
    if (query.includes('where coupon_code')) {
      const user = mockData.users.find(u => u.coupon_code === params[0] && u.role === params[1]);
      return { rows: user ? [user] : [] };
    }
    if (query.includes('where referred_by')) {
      const users = mockData.users.filter(u => u.referred_by === params[0]);
      return { rows: users };
    }
    return { rows: mockData.users };
  }

  // INSERT INTO users
  if (query.includes('insert into users')) {
    const newUser = {
      id: mockIdCounters.users++,
      email: params[0],
      password_hash: params[1],
      name: params[2],
      phone: params[3] || null,
      company_name: params[4] || null,
      role: 'user',
      subscription_status: 'free',
      subscription_end_date: null,
      referred_by: params[5] || null,
      coupon_code: null,
      created_at: new Date().toISOString()
    };
    mockData.users.push(newUser);
    return { rows: [newUser] };
  }

  // UPDATE users
  if (query.includes('update users')) {
    if (query.includes('subscription_status')) {
      const user = mockData.users.find(u => u.id === params[params.length - 1]);
      if (user) {
        user.subscription_status = 'active';
        user.subscription_end_date = params[0];
      }
      return { rows: user ? [user] : [] };
    }
    if (query.includes('role')) {
      const user = mockData.users.find(u => u.id === params[params.length - 1]);
      if (user) {
        user.role = params[0];
        user.coupon_code = params[1];
      }
      return { rows: user ? [user] : [] };
    }
  }

  // Report queries
  if (query.includes('insert into reports')) {
    const newReport = {
      id: mockIdCounters.reports++,
      user_id: params[0],
      url: params[1],
      status: params[2] || 'pending',
      total_score: null,
      violation_count: 0,
      warning_count: 0,
      pass_count: 0,
      report_data: null,
      created_at: new Date().toISOString(),
      completed_at: null
    };
    mockData.reports.push(newReport);
    return { rows: [newReport] };
  }

  if (query.includes('from reports')) {
    // COUNT 쿼리를 먼저 처리 (더 구체적인 조건)
    if (query.includes('count(*)') && query.includes('date(created_at)')) {
      const today = new Date().toDateString();
      const count = mockData.reports.filter(r => r.user_id === params[0] && new Date(r.created_at).toDateString() === today).length;
      return { rows: [{ count }] };
    }
    if (query.includes('count(*)') && query.includes('where user_id')) {
      const count = mockData.reports.filter(r => r.user_id === params[0]).length;
      return { rows: [{ count }] };
    }
    if (query.includes('where id')) {
      const report = mockData.reports.find(r => r.id === parseInt(params[0]) && r.user_id === params[1]);
      return { rows: report ? [report] : [] };
    }
    if (query.includes('where user_id')) {
      const reports = mockData.reports.filter(r => r.user_id === params[0]);
      return { rows: reports };
    }
  }

  if (query.includes('update reports')) {
    const reportId = params[params.length - 1];
    const report = mockData.reports.find(r => r.id === reportId);
    if (report) {
      if (query.includes('status = \'completed\'')) {
        report.status = 'completed';
        report.total_score = params[0];
        report.violation_count = params[1];
        report.warning_count = params[2];
        report.pass_count = params[3];
        report.report_data = params[4];
        report.completed_at = new Date().toISOString();
      }
    }
    return { rows: [] };
  }

  // Violation queries
  if (query.includes('insert into violations')) {
    const newViolation = {
      id: mockIdCounters.violations++,
      report_id: params[0],
      category: params[1],
      severity: params[2],
      rule_code: params[3],
      rule_name: params[4],
      description: params[5],
      location: params[6],
      evidence: params[7],
      recommendation: params[8],
      created_at: new Date().toISOString()
    };
    mockData.violations.push(newViolation);
    return { rows: [newViolation] };
  }

  if (query.includes('from violations')) {
    const violations = mockData.violations.filter(v => v.report_id === parseInt(params[0]));
    return { rows: violations };
  }

  // Payment queries
  if (query.includes('insert into payments')) {
    const newPayment = {
      id: mockIdCounters.payments++,
      user_id: params[0],
      order_id: params[1],
      amount: params[2],
      subscription_months: params[3],
      coupon_code: params[4],
      dealer_id: params[5],
      status: params[6] || 'pending',
      payment_key: params[7] || null,
      payment_method: params[8] || null,
      paid_at: params[9] || null,
      dealer_commission: null,
      created_at: new Date().toISOString()
    };
    mockData.payments.push(newPayment);
    return { rows: [newPayment] };
  }

  if (query.includes('from payments')) {
    if (query.includes('where order_id')) {
      const payment = mockData.payments.find(p => p.order_id === params[0] && p.user_id === params[1]);
      return { rows: payment ? [payment] : [] };
    }
    if (query.includes('where user_id')) {
      const payments = mockData.payments.filter(p => p.user_id === params[0]);
      return { rows: payments };
    }
  }

  if (query.includes('update payments')) {
    const paymentId = params[params.length - 1];
    const payment = mockData.payments.find(p => p.id === paymentId);
    if (payment) {
      if (query.includes('dealer_commission')) {
        payment.dealer_commission = params[0];
      } else {
        payment.status = 'completed';
        payment.payment_key = params[0];
        payment.payment_method = params[1];
        payment.paid_at = new Date().toISOString();
      }
    }
    return { rows: [] };
  }

  // Dealer commission queries
  if (query.includes('insert into dealer_commissions')) {
    const newCommission = {
      id: mockIdCounters.dealer_commissions++,
      dealer_id: params[0],
      payment_id: params[1],
      customer_id: params[2],
      amount: params[3],
      commission_rate: params[4],
      status: 'pending',
      created_at: new Date().toISOString()
    };
    mockData.dealer_commissions.push(newCommission);
    return { rows: [newCommission] };
  }

  if (query.includes('from dealer_commissions')) {
    const commissions = mockData.dealer_commissions.filter(c => c.dealer_id === params[0]);
    if (query.includes('sum(amount)')) {
      const total = commissions.reduce((sum, c) => sum + c.amount, 0);
      return { rows: [{ total }] };
    }
    return { rows: commissions };
  }

  // Default empty result
  return { rows: [] };
}

// Mock client for transactions
function createMockClient() {
  return {
    query: (text, params) => Promise.resolve(processMockQuery(text, params)),
    release: () => {}
  };
}

// 쿼리 헬퍼 함수
const query = async (text, params) => {
  if (isMockMode) {
    return processMockQuery(text, params);
  }
  return pool.query(text, params);
};

// 트랜잭션 헬퍼
const getClient = async () => {
  if (isMockMode) {
    const client = createMockClient();
    client.query('BEGIN');
    return client;
  }
  return pool.connect();
};

module.exports = {
  pool,
  query,
  getClient,
  isMockMode,
  mockData
};
