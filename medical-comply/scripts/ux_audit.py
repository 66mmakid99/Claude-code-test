#!/usr/bin/env python3
"""
MEDCHECKER UX 자동 평가 스크립트
프론트엔드 코드를 분석하여 UX 품질을 평가합니다.
"""

import os
import re
import json
import sys
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
FRONTEND_DIR = PROJECT_DIR / 'frontend' / 'src'

class UXAuditor:
    def __init__(self):
        self.results = {
            'timestamp': datetime.now().isoformat(),
            'categories': {},
            'total_score': 0,
            'max_score': 0,
            'issues': [],
            'recommendations': []
        }

    def audit_accessibility(self):
        """접근성 검사"""
        score = 0
        max_score = 25
        issues = []

        pages_dir = FRONTEND_DIR / 'pages'
        components_dir = FRONTEND_DIR / 'components'

        all_jsx_files = list(pages_dir.glob('*.jsx')) + list(components_dir.glob('*.jsx')) if pages_dir.exists() else []

        for jsx_file in all_jsx_files:
            content = jsx_file.read_text(encoding='utf-8')
            filename = jsx_file.name

            # aria-label 체크
            if 'aria-label' in content or 'aria-labelledby' in content:
                score += 2
            else:
                issues.append(f"{filename}: aria-label 속성 부족")

            # alt 속성 체크 (이미지)
            img_tags = re.findall(r'<img[^>]*>', content)
            for img in img_tags:
                if 'alt=' not in img:
                    issues.append(f"{filename}: 이미지에 alt 속성 누락")

            # 버튼 접근성
            buttons = re.findall(r'<button[^>]*>.*?</button>', content, re.DOTALL)
            if buttons:
                score += 2

            # 시맨틱 태그 사용
            semantic_tags = ['<header', '<nav', '<main', '<section', '<article', '<aside', '<footer']
            for tag in semantic_tags:
                if tag in content:
                    score += 1
                    break

        score = min(score, max_score)
        self.results['categories']['accessibility'] = {
            'name': '접근성',
            'score': score,
            'max_score': max_score,
            'issues': issues[:5]  # 상위 5개만
        }
        return score, max_score

    def audit_consistency(self):
        """일관성 검사"""
        score = 0
        max_score = 25
        issues = []

        # 스타일 일관성 체크
        global_css = FRONTEND_DIR / 'styles' / 'global.css'
        if global_css.exists():
            score += 10
            css_content = global_css.read_text(encoding='utf-8')

            # CSS 변수 사용
            if '--' in css_content or 'var(' in css_content:
                score += 5
            else:
                issues.append("CSS 변수 미사용 - 일관성 저하 가능")

        # 컴포넌트 스타일 일관성
        pages_dir = FRONTEND_DIR / 'pages'
        if pages_dir.exists():
            inline_styles_count = 0
            for jsx_file in pages_dir.glob('*.jsx'):
                content = jsx_file.read_text(encoding='utf-8')
                inline_styles_count += len(re.findall(r'style=\{\{', content))

            if inline_styles_count > 50:
                issues.append(f"인라인 스타일 과다 사용 ({inline_styles_count}개) - CSS 클래스 권장")
            else:
                score += 5

        # 버튼 스타일 일관성
        if pages_dir.exists():
            btn_classes = set()
            for jsx_file in pages_dir.glob('*.jsx'):
                content = jsx_file.read_text(encoding='utf-8')
                btn_classes.update(re.findall(r'className="[^"]*btn[^"]*"', content))

            if len(btn_classes) <= 5:
                score += 5
            else:
                issues.append(f"버튼 클래스 종류 과다 ({len(btn_classes)}개)")

        score = min(score, max_score)
        self.results['categories']['consistency'] = {
            'name': '일관성',
            'score': score,
            'max_score': max_score,
            'issues': issues
        }
        return score, max_score

    def audit_feedback(self):
        """피드백 검사"""
        score = 0
        max_score = 25
        issues = []

        pages_dir = FRONTEND_DIR / 'pages'
        if not pages_dir.exists():
            self.results['categories']['feedback'] = {
                'name': '피드백',
                'score': 0,
                'max_score': max_score,
                'issues': ['페이지 디렉토리 없음']
            }
            return 0, max_score

        for jsx_file in pages_dir.glob('*.jsx'):
            content = jsx_file.read_text(encoding='utf-8')
            filename = jsx_file.name

            # 로딩 상태 체크
            if 'loading' in content.lower() or 'spinner' in content.lower():
                score += 3
            else:
                issues.append(f"{filename}: 로딩 상태 표시 없음")

            # 에러 처리 체크
            if 'error' in content.lower() or 'catch' in content:
                score += 3
            else:
                issues.append(f"{filename}: 에러 상태 처리 없음")

            # 성공 피드백
            if '성공' in content or 'success' in content.lower():
                score += 2

            # 호버 효과
            if 'onMouseOver' in content or ':hover' in content or 'hover' in content:
                score += 2

        score = min(score, max_score)
        self.results['categories']['feedback'] = {
            'name': '피드백',
            'score': score,
            'max_score': max_score,
            'issues': issues[:5]
        }
        return score, max_score

    def audit_navigation(self):
        """네비게이션 검사"""
        score = 0
        max_score = 25
        issues = []

        # Header 컴포넌트 체크
        header_file = FRONTEND_DIR / 'components' / 'Header.jsx'
        if header_file.exists():
            content = header_file.read_text(encoding='utf-8')
            score += 5

            # 네비게이션 링크 수
            links = re.findall(r'<Link[^>]*to="[^"]*"', content)
            if len(links) >= 3:
                score += 5
            else:
                issues.append(f"네비게이션 링크 부족 ({len(links)}개)")

            # 로고/홈 링크
            if 'to="/"' in content or "to='/'" in content:
                score += 5
            else:
                issues.append("홈으로 가는 로고 링크 없음")

            # 로그인/로그아웃
            if 'logout' in content.lower() or '로그아웃' in content:
                score += 5
        else:
            issues.append("Header 컴포넌트 없음")

        # App.jsx 라우팅 체크
        app_file = FRONTEND_DIR / 'App.jsx'
        if app_file.exists():
            content = app_file.read_text(encoding='utf-8')
            routes = re.findall(r'<Route[^>]*path="[^"]*"', content)
            if len(routes) >= 5:
                score += 5
            else:
                issues.append(f"라우트 수 부족 ({len(routes)}개)")

        score = min(score, max_score)
        self.results['categories']['navigation'] = {
            'name': '네비게이션',
            'score': score,
            'max_score': max_score,
            'issues': issues
        }
        return score, max_score

    def generate_recommendations(self):
        """개선 권고사항 생성"""
        recommendations = []

        for category, data in self.results['categories'].items():
            percentage = (data['score'] / data['max_score']) * 100 if data['max_score'] > 0 else 0

            if percentage < 60:
                if category == 'accessibility':
                    recommendations.append({
                        'priority': 'HIGH',
                        'category': '접근성',
                        'recommendation': 'aria-label 속성 추가, 시맨틱 HTML 태그 사용 권장'
                    })
                elif category == 'consistency':
                    recommendations.append({
                        'priority': 'MEDIUM',
                        'category': '일관성',
                        'recommendation': 'CSS 변수 활용, 공통 스타일 컴포넌트 생성 권장'
                    })
                elif category == 'feedback':
                    recommendations.append({
                        'priority': 'HIGH',
                        'category': '피드백',
                        'recommendation': '로딩 스피너, 에러 메시지, 성공 토스트 추가 권장'
                    })
                elif category == 'navigation':
                    recommendations.append({
                        'priority': 'MEDIUM',
                        'category': '네비게이션',
                        'recommendation': '브레드크럼, 사이드바 네비게이션 추가 권장'
                    })

        self.results['recommendations'] = recommendations

    def run_audit(self):
        """전체 UX 감사 실행"""
        print("=" * 60)
        print("MEDCHECKER UX 자동 평가")
        print(f"시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)

        total_score = 0
        max_score = 0

        # 각 카테고리 검사
        s, m = self.audit_accessibility()
        total_score += s
        max_score += m

        s, m = self.audit_consistency()
        total_score += s
        max_score += m

        s, m = self.audit_feedback()
        total_score += s
        max_score += m

        s, m = self.audit_navigation()
        total_score += s
        max_score += m

        self.results['total_score'] = total_score
        self.results['max_score'] = max_score

        # 권고사항 생성
        self.generate_recommendations()

        # 결과 출력
        self.print_results()

        return self.results

    def print_results(self):
        """결과 출력"""
        print("\n" + "=" * 60)
        print("UX 평가 결과")
        print("=" * 60)

        total_percentage = (self.results['total_score'] / self.results['max_score'] * 100) if self.results['max_score'] > 0 else 0

        print(f"\n총점: {self.results['total_score']}/{self.results['max_score']} ({total_percentage:.1f}%)")

        # 등급 표시
        if total_percentage >= 90:
            grade = "A+ (우수)"
        elif total_percentage >= 80:
            grade = "A (양호)"
        elif total_percentage >= 70:
            grade = "B+ (보통)"
        elif total_percentage >= 60:
            grade = "B (개선 필요)"
        else:
            grade = "C (개선 시급)"

        print(f"등급: {grade}")

        print("\n[카테고리별 점수]")
        for category, data in self.results['categories'].items():
            percentage = (data['score'] / data['max_score'] * 100) if data['max_score'] > 0 else 0
            bar = "█" * int(percentage / 10) + "░" * (10 - int(percentage / 10))
            print(f"  {data['name']}: {data['score']}/{data['max_score']} ({percentage:.0f}%) {bar}")

            if data.get('issues'):
                for issue in data['issues'][:2]:
                    print(f"    ⚠ {issue}")

        if self.results['recommendations']:
            print("\n[개선 권고사항]")
            for rec in self.results['recommendations']:
                priority_icon = "🔴" if rec['priority'] == 'HIGH' else "🟡"
                print(f"  {priority_icon} [{rec['category']}] {rec['recommendation']}")

        print("\n" + "=" * 60)

        # JSON 파일로 저장
        output_file = SCRIPT_DIR / 'ux_audit_result.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, ensure_ascii=False, indent=2)
        print(f"결과 저장: {output_file}")


def main():
    auditor = UXAuditor()
    results = auditor.run_audit()

    total_percentage = (results['total_score'] / results['max_score'] * 100) if results['max_score'] > 0 else 0

    if total_percentage >= 70:
        return 0
    else:
        return 1


if __name__ == "__main__":
    sys.exit(main())
