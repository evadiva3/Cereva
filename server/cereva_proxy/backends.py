from __future__ import annotations

import logging
import os

from .drafting import DraftResult, ModelRefusedError, ModelUnavailableError

log=logging.getLogger("cereva.backends")

DESCRIBE=os.environ.get("CEREVA_BACKEND_DESCRIBE", "auto").strip().lower()

EXPLAIN=os.environ.get("CEREVA_BACKEND_EXPLAIN", "none").strip().lower()

VALID={"auto", "ollama", "anthropic"}

def _resolve_describe() -> str:
 if DESCRIBE not in VALID:
  raise ModelUnavailableError(
   f"CEREVA_BACKEND_DESCRIBE is {DESCRIBE!r}, expected one of {sorted(VALID)}"
  )

 if DESCRIBE == "ollama":
  return "ollama"
 if DESCRIBE == "anthropic":
  return "anthropic"

 from . import ollama_backend

 ok, why=ollama_backend.available()
 if ok:
  return "ollama"
 if os.environ.get("ANTHROPIC_API_KEY"):
  log.info("describe backend=anthropic (ollama unavailable: %s)", why)
  return "anthropic"
 raise ModelUnavailableError(
  f"no drafting backend is usable. Ollama: {why}. ANTHROPIC_API_KEY is not set either."
 )

def describe_backend_name() -> str:
 try:
  return _resolve_describe()
 except ModelUnavailableError:
  return "none"

def draft_from_description(description: str) -> DraftResult:
 which=_resolve_describe()
 if which == "ollama":
  from . import ollama_backend

  return ollama_backend.draft_from_description(description)

 from . import claude

 return claude.draft_from_description(description)

__all__=[
 "DraftResult",
 "ModelRefusedError",
 "ModelUnavailableError",
 "describe_backend_name",
 "draft_from_description",
]
