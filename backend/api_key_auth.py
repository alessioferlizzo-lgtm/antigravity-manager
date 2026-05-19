import json
import secrets
from pathlib import Path
from datetime import datetime
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

API_KEYS_FILE = Path(__file__).parent.parent / "api_keys.json"

LOCALHOST_ORIGINS = {"localhost", "127.0.0.1", "::1"}


def _load_keys() -> dict:
    if not API_KEYS_FILE.exists():
        return {}
    try:
        with open(API_KEYS_FILE) as f:
            return json.load(f)
    except Exception:
        return {}


def _save_keys(keys: dict):
    with open(API_KEYS_FILE, "w") as f:
        json.dump(keys, f, indent=2)


def is_valid_key(key: str) -> bool:
    keys = _load_keys()
    return key in keys


def create_api_key(name: str) -> str:
    keys = _load_keys()
    new_key = secrets.token_hex(32)
    keys[new_key] = {
        "name": name,
        "created_at": datetime.utcnow().isoformat(),
        "expires_at": None,
    }
    _save_keys(keys)
    return new_key


def list_api_keys() -> list:
    keys = _load_keys()
    return [{"key_preview": k[:8] + "...", "name": v["name"], "created_at": v["created_at"]} for k, v in keys.items()]


def delete_api_key(key: str) -> bool:
    keys = _load_keys()
    if key in keys:
        del keys[key]
        _save_keys(keys)
        return True
    return False


def _is_localhost_request(request: Request) -> bool:
    host = request.client.host if request.client else ""
    origin = request.headers.get("origin", "")
    referer = request.headers.get("referer", "")
    if host in LOCALHOST_ORIGINS:
        return True
    for url in [origin, referer]:
        if any(f"://{h}" in url or f"://{h}:" in url for h in LOCALHOST_ORIGINS):
            return True
    return False


class APIKeyMiddleware(BaseHTTPMiddleware):
    EXEMPT_PATHS = {"/", "/health", "/docs", "/openapi.json", "/redoc"}

    async def dispatch(self, request: Request, call_next):
        if request.url.path in self.EXEMPT_PATHS:
            return await call_next(request)

        if _is_localhost_request(request):
            return await call_next(request)

        api_key = (
            request.headers.get("X-API-Key")
            or _extract_bearer(request.headers.get("Authorization", ""))
        )

        if not api_key or not is_valid_key(api_key):
            return JSONResponse(
                status_code=401,
                content={"error": "Unauthorized", "detail": "Valid API key required. Use X-API-Key header."},
            )

        return await call_next(request)


def _extract_bearer(auth_header: str) -> str:
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()
    return ""
