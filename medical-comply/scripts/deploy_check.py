#!/usr/bin/env python3
"""
MEDCHECKER 배포 전 종합 검사 스크립트
모든 검사 스크립트를 순차적으로 실행합니다.

실행 순서:
1. 코드 품질 검사 (lint_and_fix.py)
2. 서버 재시작 (auto_restart.py)
3. 헬스 체크 (healthcheck.py)
"""

import subprocess
import sys
import os
import time
from datetime import datetime

# 프로젝트 경로
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)

def run_script(script_name, args="", description=""):
    """스크립트 실행"""
    script_path = os.path.join(SCRIPT_DIR, script_name)

    print("\n" + "=" * 60)
    print(f"[실행] {description}")
    print(f"스크립트: {script_name} {args}")
    print("=" * 60 + "\n")

    if not os.path.exists(script_path):
        print(f"[ERROR] 스크립트를 찾을 수 없습니다: {script_path}")
        return False

    try:
        result = subprocess.run(
            f"python3 {script_path} {args}",
            shell=True,
            cwd=SCRIPT_DIR
        )
        return result.returncode == 0
    except Exception as e:
        print(f"[ERROR] 스크립트 실행 실패: {e}")
        return False

def run_npm_build():
    """프론트엔드 빌드"""
    print("\n" + "=" * 60)
    print("[실행] 프론트엔드 빌드")
    print("=" * 60 + "\n")

    frontend_dir = os.path.join(PROJECT_DIR, 'frontend')
    if not os.path.exists(frontend_dir):
        print("[SKIP] 프론트엔드 디렉토리 없음")
        return True

    try:
        result = subprocess.run(
            "npm run build",
            shell=True,
            cwd=frontend_dir
        )
        return result.returncode == 0
    except Exception as e:
        print(f"[ERROR] 빌드 실패: {e}")
        return False

def main():
    import argparse

    parser = argparse.ArgumentParser(description='MEDCHECKER 배포 전 종합 검사')
    parser.add_argument('--skip-lint', action='store_true', help='린트 검사 건너뛰기')
    parser.add_argument('--skip-build', action='store_true', help='빌드 건너뛰기')
    parser.add_argument('--skip-restart', action='store_true', help='서버 재시작 건너뛰기')
    parser.add_argument('--quick', action='store_true', help='빠른 검사 (린트, 빌드 건너뛰기)')
    parser.add_argument('--lint-only', action='store_true', help='린트 검사만 실행')

    args = parser.parse_args()

    start_time = datetime.now()

    print("=" * 60)
    print("MEDCHECKER 배포 전 종합 검사")
    print(f"시작 시간: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    results = []

    # 린트 검사만
    if args.lint_only:
        success = run_script("lint_and_fix.py", "", "코드 품질 검사")
        results.append(("코드 품질 검사", success))
    else:
        # 1. 코드 품질 검사
        if not args.skip_lint and not args.quick:
            success = run_script("lint_and_fix.py", "", "코드 품질 검사")
            results.append(("코드 품질 검사", success))
            if not success:
                print("\n[WARNING] 코드 품질 검사에서 문제가 발견되었습니다.")
                print("계속 진행합니다...")

        # 2. 프론트엔드 빌드
        if not args.skip_build and not args.quick:
            success = run_npm_build()
            results.append(("프론트엔드 빌드", success))
            if not success:
                print("\n[ERROR] 빌드 실패! 배포를 중단합니다.")
                return 1

        # 3. 서버 재시작
        if not args.skip_restart:
            success = run_script("auto_restart.py", "", "서버 재시작")
            results.append(("서버 재시작", success))

            # 서버 시작 대기
            print("\n서버 안정화 대기 중 (5초)...")
            time.sleep(5)

        # 4. 헬스 체크
        success = run_script("healthcheck.py", "", "서버 상태 확인")
        results.append(("헬스 체크", success))

    # 결과 요약
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()

    print("\n" + "=" * 60)
    print("배포 검사 결과 요약")
    print("=" * 60)

    all_passed = True
    for name, passed in results:
        status = "[PASS]" if passed else "[FAIL]"
        print(f"  {status} {name}")
        if not passed:
            all_passed = False

    print(f"\n소요 시간: {duration:.1f}초")
    print("=" * 60)

    if all_passed:
        print("\n" + "=" * 60)
        print("[SUCCESS] 모든 검사를 통과했습니다!")
        print("배포를 진행해도 됩니다.")
        print("=" * 60)
        return 0
    else:
        print("\n" + "=" * 60)
        print("[WARNING] 일부 검사에서 문제가 발견되었습니다.")
        print("로그를 확인하고 문제를 해결해주세요.")
        print("=" * 60)
        return 1

if __name__ == "__main__":
    sys.exit(main())
