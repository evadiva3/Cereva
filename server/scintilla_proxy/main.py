from __future__ import annotations

import logging
import os
import uuid

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from .claude import ModelRefusedError, ModelUnavailableError, draft_from_description
from .schema import SCHEMA_VERSION, normalize_aura_state
from .security import (
 BodySizeLimitMiddleware,
 SecurityHeadersMiddleware,
 require_client_token,
 startup_warnings,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
log=logging.getLogger("scintilla.proxy")

RATE_LIMIT=os.environ.get("SCINTILLA_RATE_LIMIT", "10/minute")
DAILY_LIMIT=os.environ.get("SCINTILLA_DAILY_LIMIT", "100/day")

limiter=Limiter(key_func=get_remote_address, default_limits=[DAILY_LIMIT])

app=FastAPI(
 title="Scintilla AI proxy",
 version="1.0.0",
 description=(
  "Turns a description of a migraine aura into a draft configuration. "
  "Holds the model API key so the app does not have to. Logs no content."
 ),
 docs_url="/docs" if os.environ.get("SCINTILLA_DOCS") else None,
 redoc_url=None,
)
app.state.limiter=limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(BodySizeLimitMiddleware)

for _warning in startup_warnings():
 log.warning("STARTUP: %s", _warning)

class DescribeRequest(BaseModel):

 model_config=ConfigDict(extra="forbid")

 description: str=Field(
  min_length=3,
  max_length=2000,
  description="What the person typed or dictated about their aura.",
 )

 @field_validator("description")
 @classmethod
 def not_blank(cls, v: str) -> str:
  stripped=v.strip()
  if len(stripped) < 3:
   raise ValueError("description is empty")
  return stripped

class WarningOut(BaseModel):
 kind: str
 path: str
 message: str

class DescribeResponse(BaseModel):
 schema_version: int
 draft: dict
 raw_draft: dict
 warnings: list[WarningOut]
 notes: str
 model: str

@app.get("/health")
async def health() -> dict[str, object]:
 return {"ok": True, "schema_version": SCHEMA_VERSION}

@app.post(
 "/v1/describe",
 response_model=DescribeResponse,
 dependencies=[Depends(require_client_token)],
)
@limiter.limit(RATE_LIMIT)
async def describe(request: Request, body: DescribeRequest) -> DescribeResponse:
 request_id=uuid.uuid4().hex[:8]

 try:
  result=draft_from_description(body.description)
 except ModelRefusedError as exc:
  log.info("req=%s outcome=refused category=%s", request_id, exc.category)
  return JSONResponse(
   status_code=422,
   content={
    "error": "declined",
    "message": (
     "The model would not draft from that description. "
     "You can still build your aura by hand, which works fully "
     "without any of this."
    ),
    "request_id": request_id,
   },
  )
 except ModelUnavailableError as exc:
  log.info("req=%s outcome=unavailable detail=%s", request_id, exc)
  return JSONResponse(
   status_code=503,
   content={
    "error": "unavailable",
    "message": (
     "The drafting service is not available right now. "
     "Building your aura by hand works normally."
    ),
    "request_id": request_id,
   },
  )

 normalized=normalize_aura_state(result.draft)

 log.info(
  "req=%s outcome=ok layers=%d warnings=%d in=%d out=%d ms=%d",
  request_id,
  len(normalized.state["layers"]),
  len(normalized.warnings),
  result.input_tokens,
  result.output_tokens,
  result.duration_ms,
 )

 return DescribeResponse(
  schema_version=SCHEMA_VERSION,
  draft=normalized.state,
  raw_draft=result.draft,
  warnings=[WarningOut(**w.as_dict()) for w in normalized.warnings],
  notes=result.notes,
  model=result.model,
 )
