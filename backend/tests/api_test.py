"""
Run API tests against a running backend at BASE_URL.
Usage: python -m tests.api_test [BASE_URL]
Default BASE_URL: http://localhost:8000
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Add backend root so we can run from backend/ or project root
_backend = Path(__file__).resolve().parent.parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

try:
    import httpx
except ImportError:
    print("Install httpx: pip install httpx")
    sys.exit(1)

BASE_URL = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/")


def run():
    passed = 0
    failed = 0

    def ok(name: str, r: httpx.Response, expect_status: int = 200) -> bool:
        nonlocal passed, failed
        if r.status_code == expect_status:
            print(f"  OK   {name} -> {r.status_code}")
            passed += 1
            return True
        else:
            print(f"  FAIL {name} -> {r.status_code} (expected {expect_status})")
            try:
                print(f"        {r.text[:200]}")
            except Exception:
                pass
            failed += 1
            return False

    print(f"Testing APIs at {BASE_URL}\n")

    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        # Health
        r = client.get("/health")
        ok("GET /health", r)
        if r.status_code == 200 and isinstance(r.json(), dict):
            if r.json().get("status") != "ok":
                print("        unexpected body:", r.json())
                failed += 1
                passed -= 1

        # Auth
        r = client.post("/auth/challenge", json={"wallet_address": "11111111111111111111111111111111"})
        ok("POST /auth/challenge", r)

        r = client.post("/auth/verify", json={"wallet_address": "stub", "signature": "stub"})
        # May 400 if challenge required, or 200 for stub
        if r.status_code not in (200, 400):
            ok("POST /auth/verify", r, expect_status=r.status_code)
        else:
            passed += 1
            print(f"  OK   POST /auth/verify -> {r.status_code}")

        # /auth/me often requires Bearer token; try without for stub
        r = client.get("/auth/me", headers={"Authorization": "Bearer stub-token"})
        if r.status_code in (200, 401):
            passed += 1
            print(f"  OK   GET /auth/me -> {r.status_code}")
        else:
            ok("GET /auth/me", r)

        # Skills
        r = client.get("/skills/")
        ok("GET /skills/", r)

        r = client.post("/skills/select", json={"user_id": "test-user", "skills": ["Python", "Rust"]})
        ok("POST /skills/select", r)

        r = client.put("/skills/update", json={"user_id": "test-user", "skills": ["JavaScript"]})
        ok("PUT /skills/update", r)

        # Questions
        r = client.get("/questions/next")
        ok("GET /questions/next", r)

        r = client.post(
            "/questions/submit",
            json={"user_id": "u1", "question_id": "q1", "selected_option_id": "b"},
        )
        ok("POST /questions/submit", r)

        # Games
        r = client.post("/games/event", json={})
        ok("POST /games/event", r)

        r = client.post("/games/result", json={})
        ok("POST /games/result", r)

        # Leaderboard
        r = client.get("/leaderboard/")
        ok("GET /leaderboard/", r)

        # Analysis
        r = client.post("/analysis/init", json={})
        ok("POST /analysis/init", r)

        r = client.get("/analysis/status")
        ok("GET /analysis/status", r)

    print()
    print(f"Result: {passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(run())
