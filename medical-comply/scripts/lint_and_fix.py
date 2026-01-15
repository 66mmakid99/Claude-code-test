#!/usr/bin/env python3
"""
MEDCHECKER 코드 품질 검사 및 자동 수정 스크립트
- ESLint: JavaScript/TypeScript 린팅 및 자동 수정
- Python 문법 검사 (scripts 폴더)
- 타입 체크 (TypeScript)
"""

import subprocess
import sys
import os
import glob

# 프로젝트 경로
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
BACKEND_DIR = os.path.join(PROJECT_DIR, 'backend')
FRONTEND_DIR = os.path.join(PROJECT_DIR, 'frontend')

def run_command(cmd, cwd=None, description=""):
    """명령 실행 및 결과 반환"""
    print(f"\n{'=' * 40}")
    print(f"실행: {description}")
    print(f"명령: {cmd}")
    print(f"{'=' * 40}")

    try:
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=cwd,
            capture_output=True,
            text=True
        )
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr)
        return result.returncode == 0
    except Exception as e:
        print(f"[ERROR] 명령 실행 실패: {e}")
        return False

def check_python_syntax():
    """Python 스크립트 문법 검사"""
    print("\n" + "=" * 50)
    print("[Python 문법 검사]")
    print("=" * 50)

    python_files = glob.glob(os.path.join(SCRIPT_DIR, '*.py'))
    errors = []

    for filepath in python_files:
        filename = os.path.basename(filepath)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                source = f.read()
            compile(source, filename, 'exec')
            print(f"  [OK] {filename}")
        except SyntaxError as e:
            print(f"  [ERROR] {filename}: Line {e.lineno} - {e.msg}")
            errors.append(filename)

    if errors:
        print(f"\n[ERROR] {len(errors)}개 파일에 문법 오류가 있습니다.")
        return False
    else:
        print(f"\n[OK] 모든 Python 파일 문법 정상 ({len(python_files)}개)")
        return True

def run_eslint_frontend(fix=True):
    """프론트엔드 ESLint 실행"""
    print("\n" + "=" * 50)
    print("[프론트엔드 ESLint 검사]")
    print("=" * 50)

    if not os.path.exists(FRONTEND_DIR):
        print(f"[SKIP] 프론트엔드 디렉토리 없음: {FRONTEND_DIR}")
        return True

    # ESLint 설정 파일 확인
    eslint_configs = [
        '.eslintrc.js', '.eslintrc.json', '.eslintrc.yml',
        'eslint.config.js', 'eslint.config.mjs'
    ]
    has_eslint = any(
        os.path.exists(os.path.join(FRONTEND_DIR, config))
        for config in eslint_configs
    )

    if not has_eslint:
        print("[INFO] ESLint 설정 파일이 없습니다. 기본 검사 건너뜁니다.")
        return True

    fix_flag = "--fix" if fix else ""
    cmd = f"npx eslint src/**/*.{{js,jsx,ts,tsx}} {fix_flag} --no-error-on-unmatched-pattern"

    return run_command(cmd, cwd=FRONTEND_DIR, description="ESLint 프론트엔드")

def run_eslint_backend(fix=True):
    """백엔드 ESLint 실행"""
    print("\n" + "=" * 50)
    print("[백엔드 ESLint 검사]")
    print("=" * 50)

    if not os.path.exists(BACKEND_DIR):
        print(f"[SKIP] 백엔드 디렉토리 없음: {BACKEND_DIR}")
        return True

    # package.json에서 eslint 스크립트 확인
    package_json_path = os.path.join(BACKEND_DIR, 'package.json')
    if os.path.exists(package_json_path):
        import json
        with open(package_json_path, 'r') as f:
            package_data = json.load(f)
            scripts = package_data.get('scripts', {})
            if 'lint' in scripts:
                fix_flag = ":fix" if fix else ""
                return run_command(f"npm run lint{fix_flag}", cwd=BACKEND_DIR, description="ESLint 백엔드")

    # 기본 ESLint 실행
    fix_flag = "--fix" if fix else ""
    cmd = f"npx eslint **/*.js {fix_flag} --no-error-on-unmatched-pattern"

    return run_command(cmd, cwd=BACKEND_DIR, description="ESLint 백엔드")

def run_typescript_check():
    """TypeScript 타입 체크"""
    print("\n" + "=" * 50)
    print("[TypeScript 타입 검사]")
    print("=" * 50)

    if not os.path.exists(FRONTEND_DIR):
        print(f"[SKIP] 프론트엔드 디렉토리 없음")
        return True

    tsconfig_path = os.path.join(FRONTEND_DIR, 'tsconfig.json')
    if not os.path.exists(tsconfig_path):
        print("[INFO] tsconfig.json이 없습니다. TypeScript 검사 건너뜁니다.")
        return True

    return run_command("npx tsc --noEmit", cwd=FRONTEND_DIR, description="TypeScript 타입 체크")

def run_prettier(fix=True):
    """Prettier 코드 포맷팅"""
    print("\n" + "=" * 50)
    print("[Prettier 코드 포맷팅]")
    print("=" * 50)

    action = "--write" if fix else "--check"

    # 프론트엔드
    if os.path.exists(FRONTEND_DIR):
        prettier_config = os.path.exists(os.path.join(FRONTEND_DIR, '.prettierrc'))
        if prettier_config:
            run_command(
                f"npx prettier {action} 'src/**/*.{{js,jsx,ts,tsx,css}}'",
                cwd=FRONTEND_DIR,
                description="Prettier 프론트엔드"
            )

    return True

def main():
    import argparse

    parser = argparse.ArgumentParser(description='MEDCHECKER 코드 품질 검사 및 자동 수정')
    parser.add_argument('--no-fix', action='store_true', help='자동 수정 비활성화 (검사만)')
    parser.add_argument('--python-only', action='store_true', help='Python 검사만')
    parser.add_argument('--eslint-only', action='store_true', help='ESLint만')
    parser.add_argument('--typescript-only', action='store_true', help='TypeScript만')

    args = parser.parse_args()
    fix = not args.no_fix

    results = []

    print("=" * 60)
    print("MEDCHECKER 코드 품질 검사")
    print(f"모드: {'검사 + 자동수정' if fix else '검사만'}")
    print("=" * 60)

    if args.python_only:
        results.append(('Python 문법', check_python_syntax()))
    elif args.eslint_only:
        results.append(('ESLint 프론트엔드', run_eslint_frontend(fix)))
        results.append(('ESLint 백엔드', run_eslint_backend(fix)))
    elif args.typescript_only:
        results.append(('TypeScript', run_typescript_check()))
    else:
        # 전체 검사
        results.append(('Python 문법', check_python_syntax()))
        results.append(('ESLint 프론트엔드', run_eslint_frontend(fix)))
        results.append(('ESLint 백엔드', run_eslint_backend(fix)))
        results.append(('TypeScript', run_typescript_check()))

    # 결과 요약
    print("\n" + "=" * 60)
    print("검사 결과 요약")
    print("=" * 60)

    all_passed = True
    for name, passed in results:
        status = "[PASS]" if passed else "[FAIL]"
        print(f"  {status} {name}")
        if not passed:
            all_passed = False

    print("=" * 60)

    if all_passed:
        print("\n[OK] 모든 검사를 통과했습니다.")
        return 0
    else:
        print("\n[WARNING] 일부 검사에서 문제가 발견되었습니다.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
