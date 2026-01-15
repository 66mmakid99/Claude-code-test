#!/usr/bin/env python3
"""
MEDCHECKER 서버 상태 확인 스크립트
- 백엔드 서버 (기본 포트: 5000)
- 프론트엔드 서버 (기본 포트: 5173)
"""

import requests
import sys
import os
from datetime import datetime

# 환경변수에서 포트 설정 (기본값 사용)
BACKEND_PORT = int(os.getenv('BACKEND_PORT', 5000))
FRONTEND_PORT = int(os.getenv('FRONTEND_PORT', 5173))
BACKEND_HOST = os.getenv('BACKEND_HOST', 'localhost')
FRONTEND_HOST = os.getenv('FRONTEND_HOST', 'localhost')

def check_backend():
    """백엔드 서버 상태 확인"""
    url = f"http://{BACKEND_HOST}:{BACKEND_PORT}/api/health"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"[OK] 백엔드 서버 정상 (포트: {BACKEND_PORT})")
            print(f"     - 상태: {data.get('status', 'unknown')}")
            print(f"     - DB: {data.get('database', 'unknown')}")
            return True
        else:
            print(f"[ERROR] 백엔드 서버 응답 오류 (HTTP {response.status_code})")
            return False
    except requests.exceptions.ConnectionError:
        print(f"[ERROR] 백엔드 서버 연결 실패 (포트: {BACKEND_PORT})")
        return False
    except requests.exceptions.Timeout:
        print(f"[ERROR] 백엔드 서버 응답 시간 초과")
        return False
    except Exception as e:
        print(f"[ERROR] 백엔드 체크 실패: {e}")
        return False

def check_frontend():
    """프론트엔드 서버 상태 확인"""
    url = f"http://{FRONTEND_HOST}:{FRONTEND_PORT}"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            print(f"[OK] 프론트엔드 서버 정상 (포트: {FRONTEND_PORT})")
            return True
        else:
            print(f"[ERROR] 프론트엔드 서버 응답 오류 (HTTP {response.status_code})")
            return False
    except requests.exceptions.ConnectionError:
        print(f"[ERROR] 프론트엔드 서버 연결 실패 (포트: {FRONTEND_PORT})")
        return False
    except requests.exceptions.Timeout:
        print(f"[ERROR] 프론트엔드 서버 응답 시간 초과")
        return False
    except Exception as e:
        print(f"[ERROR] 프론트엔드 체크 실패: {e}")
        return False

def check_port_in_use(port):
    """특정 포트가 사용 중인지 확인"""
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def main():
    print("=" * 50)
    print(f"MEDCHECKER 서버 상태 확인")
    print(f"시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)
    print()

    results = []

    # 백엔드 체크
    print("[백엔드 서버]")
    backend_ok = check_backend()
    results.append(('백엔드', backend_ok))
    print()

    # 프론트엔드 체크
    print("[프론트엔드 서버]")
    frontend_ok = check_frontend()
    results.append(('프론트엔드', frontend_ok))
    print()

    # 결과 요약
    print("=" * 50)
    print("결과 요약:")
    all_ok = True
    for name, status in results:
        status_text = "정상" if status else "오류"
        status_icon = "[OK]" if status else "[FAIL]"
        print(f"  {status_icon} {name}: {status_text}")
        if not status:
            all_ok = False

    print("=" * 50)

    if all_ok:
        print("\n모든 서버가 정상 작동 중입니다.")
        return 0
    else:
        print("\n일부 서버에 문제가 있습니다. 로그를 확인해주세요.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
