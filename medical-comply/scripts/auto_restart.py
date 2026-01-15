#!/usr/bin/env python3
"""
MEDCHECKER 서버 자동 재시작 스크립트
- 지정된 포트의 프로세스 종료
- 백엔드/프론트엔드 서버 재시작
"""

import subprocess
import sys
import os
import time
import signal
import platform

# 프로젝트 경로
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
BACKEND_DIR = os.path.join(PROJECT_DIR, 'backend')
FRONTEND_DIR = os.path.join(PROJECT_DIR, 'frontend')

# 포트 설정
BACKEND_PORT = int(os.getenv('BACKEND_PORT', 5000))
FRONTEND_PORT = int(os.getenv('FRONTEND_PORT', 5173))

def kill_port(port):
    """특정 포트를 사용하는 프로세스 종료"""
    system = platform.system()

    try:
        if system == 'Windows':
            # Windows
            result = subprocess.run(
                f'netstat -ano | findstr :{port}',
                shell=True, capture_output=True, text=True
            )
            if result.stdout:
                lines = result.stdout.strip().split('\n')
                pids = set()
                for line in lines:
                    parts = line.split()
                    if len(parts) >= 5:
                        pids.add(parts[-1])
                for pid in pids:
                    subprocess.run(f'taskkill /F /PID {pid}', shell=True)
                print(f"[OK] 포트 {port} 프로세스 종료 완료")
            else:
                print(f"[INFO] 포트 {port}에서 실행 중인 프로세스 없음")
        else:
            # Linux/macOS
            result = subprocess.run(
                f'lsof -ti:{port}',
                shell=True, capture_output=True, text=True
            )
            if result.stdout:
                pids = result.stdout.strip().split('\n')
                for pid in pids:
                    if pid:
                        subprocess.run(f'kill -9 {pid}', shell=True)
                print(f"[OK] 포트 {port} 프로세스 종료 완료 (PID: {', '.join(pids)})")
            else:
                print(f"[INFO] 포트 {port}에서 실행 중인 프로세스 없음")
        return True
    except Exception as e:
        print(f"[ERROR] 포트 {port} 프로세스 종료 실패: {e}")
        return False

def start_backend(background=True):
    """백엔드 서버 시작"""
    print(f"\n[백엔드 서버 시작]")
    print(f"  디렉토리: {BACKEND_DIR}")
    print(f"  포트: {BACKEND_PORT}")

    if not os.path.exists(BACKEND_DIR):
        print(f"[ERROR] 백엔드 디렉토리를 찾을 수 없습니다: {BACKEND_DIR}")
        return False

    try:
        env = os.environ.copy()
        env['PORT'] = str(BACKEND_PORT)

        if background:
            # 백그라운드 실행
            subprocess.Popen(
                'npm start',
                shell=True,
                cwd=BACKEND_DIR,
                env=env,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            print(f"[OK] 백엔드 서버 백그라운드 시작")
        else:
            # 포그라운드 실행
            subprocess.run('npm start', shell=True, cwd=BACKEND_DIR, env=env)
        return True
    except Exception as e:
        print(f"[ERROR] 백엔드 서버 시작 실패: {e}")
        return False

def start_frontend(background=True):
    """프론트엔드 서버 시작"""
    print(f"\n[프론트엔드 서버 시작]")
    print(f"  디렉토리: {FRONTEND_DIR}")
    print(f"  포트: {FRONTEND_PORT}")

    if not os.path.exists(FRONTEND_DIR):
        print(f"[ERROR] 프론트엔드 디렉토리를 찾을 수 없습니다: {FRONTEND_DIR}")
        return False

    try:
        env = os.environ.copy()
        env['PORT'] = str(FRONTEND_PORT)

        if background:
            # 백그라운드 실행
            subprocess.Popen(
                'npm run dev',
                shell=True,
                cwd=FRONTEND_DIR,
                env=env,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            print(f"[OK] 프론트엔드 서버 백그라운드 시작")
        else:
            # 포그라운드 실행
            subprocess.run('npm run dev', shell=True, cwd=FRONTEND_DIR, env=env)
        return True
    except Exception as e:
        print(f"[ERROR] 프론트엔드 서버 시작 실패: {e}")
        return False

def restart_all():
    """모든 서버 재시작"""
    print("=" * 50)
    print("MEDCHECKER 서버 재시작")
    print("=" * 50)

    # 1. 기존 프로세스 종료
    print("\n[1단계] 기존 프로세스 종료")
    kill_port(BACKEND_PORT)
    kill_port(FRONTEND_PORT)

    # 잠시 대기
    time.sleep(2)

    # 2. 서버 시작
    print("\n[2단계] 서버 시작")
    backend_ok = start_backend(background=True)
    frontend_ok = start_frontend(background=True)

    # 서버 시작 대기
    print("\n서버 시작 대기 중 (5초)...")
    time.sleep(5)

    # 3. 상태 확인
    print("\n[3단계] 상태 확인")
    from healthcheck import check_backend, check_frontend

    backend_health = check_backend()
    frontend_health = check_frontend()

    print("\n" + "=" * 50)
    if backend_health and frontend_health:
        print("[OK] 모든 서버가 정상적으로 재시작되었습니다.")
        return 0
    else:
        print("[WARNING] 일부 서버가 아직 시작 중이거나 오류가 있습니다.")
        print("         잠시 후 다시 확인하거나 로그를 확인해주세요.")
        return 1

def main():
    import argparse

    parser = argparse.ArgumentParser(description='MEDCHECKER 서버 자동 재시작')
    parser.add_argument('--backend-only', action='store_true', help='백엔드만 재시작')
    parser.add_argument('--frontend-only', action='store_true', help='프론트엔드만 재시작')
    parser.add_argument('--kill-only', action='store_true', help='프로세스만 종료 (재시작 안함)')
    parser.add_argument('--port', type=int, help='특정 포트만 종료')

    args = parser.parse_args()

    if args.port:
        kill_port(args.port)
        return 0

    if args.kill_only:
        kill_port(BACKEND_PORT)
        kill_port(FRONTEND_PORT)
        print("\n모든 서버 프로세스를 종료했습니다.")
        return 0

    if args.backend_only:
        kill_port(BACKEND_PORT)
        time.sleep(1)
        start_backend(background=True)
        return 0

    if args.frontend_only:
        kill_port(FRONTEND_PORT)
        time.sleep(1)
        start_frontend(background=True)
        return 0

    return restart_all()

if __name__ == "__main__":
    sys.exit(main())
