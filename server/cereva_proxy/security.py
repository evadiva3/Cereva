from __future__ import annotations

import os
import secrets

from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

MAX_BODY_BYTES=64 * 1024

CLIENT_TOKEN_HEADER="x-cereva-client"

def _expected_token() -> str | None:
 token=os.environ.get("CEREVA_CLIENT_TOKEN", "").strip()
 return token or None

async def require_client_token(request: Request) -> None:
 expected=_expected_token()
 if expected is None:
  return

 supplied=request.headers.get(CLIENT_TOKEN_HEADER, "")
 if not secrets.compare_digest(supplied, expected):
  raise HTTPException(
   status_code=status.HTTP_401_UNAUTHORIZED,
   detail={"error": "unauthorized", "message": "This endpoint is not open."},
  )

class BodySizeLimitMiddleware(BaseHTTPMiddleware):

 def __init__(self, app, max_bytes: int = MAX_BODY_BYTES) -> None:
  super().__init__(app)
  self.max_bytes=max_bytes

 async def dispatch(self, request: Request, call_next):
  declared=request.headers.get("content-length")
  if declared is not None:
   try:
    if int(declared) > self.max_bytes:
     return self._too_large()
   except ValueError:
    return JSONResponse(
     status_code=status.HTTP_400_BAD_REQUEST,
     content={"error": "bad_request", "message": "Malformed content length."},
    )

  body=await request.body()
  if len(body) > self.max_bytes:
   return self._too_large()

  return await call_next(request)

 def _too_large(self) -> Response:
  return JSONResponse(
   status_code=status.HTTP_413_CONTENT_TOO_LARGE,
   content={"error": "too_large", "message": "That request was too large."},
  )

class SecurityHeadersMiddleware(BaseHTTPMiddleware):

 async def dispatch(self, request: Request, call_next):
  response=await call_next(request)
  response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
  response.headers["Pragma"] = "no-cache"
  response.headers["X-Content-Type-Options"] = "nosniff"
  response.headers["X-Frame-Options"] = "DENY"
  response.headers["Referrer-Policy"] = "no-referrer"
  response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
  response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
  response.headers["Server"] = "cereva"
  return response

def startup_warnings() -> list[str]:
 warnings: list[str]=[]
 if _expected_token() is None:
  warnings.append(
   "CEREVA_CLIENT_TOKEN is not set. Anyone who finds this URL can "
   "spend the model budget. Set it, and set a spending cap with the "
   "model provider as well."
  )
 backend=os.environ.get("CEREVA_BACKEND_DESCRIBE", "auto").strip().lower()
 if backend == "anthropic" and not os.environ.get("ANTHROPIC_API_KEY"):
  warnings.append("ANTHROPIC_API_KEY is not set. Draft requests will fail.")
 if os.environ.get("CEREVA_DOCS"):
  warnings.append(
   "CEREVA_DOCS is set, so the interactive docs are exposed. "
   "Do not do this in production."
  )
 if os.environ.get("FORWARDED_ALLOW_IPS", "").strip() == "*":
  warnings.append(
   "FORWARDED_ALLOW_IPS is '*', so any client can forge "
   "X-Forwarded-For and bypass rate limiting. Set it to the address "
   "of your reverse proxy."
  )
 return warnings
