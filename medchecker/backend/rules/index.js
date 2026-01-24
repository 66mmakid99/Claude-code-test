/**
 * 규칙 통합 인덱스
 * 
 * 모든 규칙을 하나로 통합하여 export
 */

const medicalAdRules = require('./medical-ad-rules');
const extendedMedicalAdRules = require('./medical-ad-rules-extended');
const viralMonitoringRules = require('./viral-monitoring-rules');

// 의료광고 규칙 통합 (기본 + 확장)
const allMedicalAdRules = [
  ...medicalAdRules,
  ...extendedMedicalAdRules,
];

// 규칙 통계
const stats = {
  medicalAd: {
    total: allMedicalAdRules.length,
    byCategory: {},
    bySeverity: {},
  },
  viralMonitoring: {
    total: viralMonitoringRules.length,
    byCategory: {},
  },
};

// 카테고리별 분류
allMedicalAdRules.forEach(rule => {
  const subcat = rule.subcategory || 'other';
  stats.medicalAd.byCategory[subcat] = (stats.medicalAd.byCategory[subcat] || 0) + 1;
  
  const severity = rule.severity || 'info';
  stats.medicalAd.bySeverity[severity] = (stats.medicalAd.bySeverity[severity] || 0) + 1;
});

viralMonitoringRules.forEach(rule => {
  const subcat = rule.subcategory || 'other';
  stats.viralMonitoring.byCategory[subcat] = (stats.viralMonitoring.byCategory[subcat] || 0) + 1;
});

// 규칙 ID로 빠르게 찾기 위한 맵
const medicalAdRulesById = new Map(
  allMedicalAdRules.map(rule => [rule.id, rule])
);

const viralRulesById = new Map(
  viralMonitoringRules.map(rule => [rule.id, rule])
);

// 활성화된 규칙만 필터링
const activeMedicalAdRules = allMedicalAdRules.filter(
  rule => rule.metadata?.isActive !== false
);

const activeViralRules = viralMonitoringRules.filter(
  rule => rule.metadata?.isActive !== false
);

// 우선순위별 정렬 (낮은 숫자가 높은 우선순위)
const sortedMedicalAdRules = [...activeMedicalAdRules].sort(
  (a, b) => (a.metadata?.priority || 99) - (b.metadata?.priority || 99)
);

const sortedViralRules = [...activeViralRules].sort(
  (a, b) => (a.metadata?.priority || 99) - (b.metadata?.priority || 99)
);

module.exports = {
  // 전체 규칙
  medicalAdRules: allMedicalAdRules,
  viralMonitoringRules,
  
  // 활성화된 규칙
  activeMedicalAdRules,
  activeViralRules,
  
  // 우선순위 정렬된 규칙
  sortedMedicalAdRules,
  sortedViralRules,
  
  // ID로 찾기
  medicalAdRulesById,
  viralRulesById,
  
  // 통계
  stats,
  
  // 헬퍼 함수
  getRuleById: (id) => {
    return medicalAdRulesById.get(id) || viralRulesById.get(id) || null;
  },
  
  getRulesByCategory: (category, subcategory = null) => {
    const rules = category === 'medical_ad' ? allMedicalAdRules : viralMonitoringRules;
    if (subcategory) {
      return rules.filter(r => r.subcategory === subcategory);
    }
    return rules;
  },
  
  getRulesBySeverity: (severity) => {
    return allMedicalAdRules.filter(r => r.severity === severity);
  },
  
  getCriticalRules: () => {
    return allMedicalAdRules.filter(r => r.severity === 'critical');
  },
};
