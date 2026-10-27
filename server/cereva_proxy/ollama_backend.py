from __future__ import annotations

import logging
import os
import time

import httpx

from .drafting import SYSTEM_PROMPT, DraftResult, ModelUnavailableError, parse_draft
from .schema import build_json_schema, render_layer_reference

log=logging.getLogger("cereva.ollama")

HOST=os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")

MODEL=os.environ.get("CEREVA_OLLAMA_MODEL", "qwen2.5:14b")

NUM_CTX=int(os.environ.get("CEREVA_OLLAMA_NUM_CTX", "16384"))

TIMEOUT=float(os.environ.get("CEREVA_OLLAMA_TIMEOUT", "240"))

def available() -> tuple[bool, str]:
 try:
  r=httpx.get(f"{HOST}/api/tags", timeout=3)
  r.raise_for_status()
 except Exception as exc:
  return False, f"cannot reach Ollama at {HOST} ({type(exc).__name__})"

 names=[m.get("name", "") for m in r.json().get("models", [])]
 if not any(n == MODEL or n.startswith(MODEL.split(":")[0] + ":") for n in names):
  return False, f"Ollama is running but {MODEL} is not pulled"
 return True, ""

def draft_from_description(description: str) -> DraftResult:
 started=time.monotonic()
 payload={
  "model": MODEL,
  "stream": False,
  "format": build_json_schema(),
  "options": {"temperature": 0.3, "num_ctx": NUM_CTX},
  "messages": [
   {"role": "system", "content": SYSTEM_PROMPT.format(layer_reference=render_layer_reference())},
   {"role": "user", "content": description},
  ],
 }

 try:
  response=httpx.post(f"{HOST}/api/chat", json=payload, timeout=TIMEOUT)
 except httpx.TimeoutException as exc:
  raise ModelUnavailableError(
   "the local model took too long. A smaller model or a shorter description will help."
  ) from exc
 except httpx.HTTPError as exc:
  raise ModelUnavailableError(f"could not reach the local model at {HOST}") from exc

 if response.status_code == 404:
  raise ModelUnavailableError(f"the local model {MODEL} is not pulled. Run: ollama pull {MODEL}")
 if response.status_code >= 400:
  log.warning("ollama returned status %s", response.status_code)
  raise ModelUnavailableError(f"the local model returned status {response.status_code}")

 body=response.json()
 duration_ms=int((time.monotonic() - started) * 1000)

 if body.get("done_reason") == "length":
  raise ModelUnavailableError(
   "the draft was cut off before it finished. Try a shorter description."
  )

 draft, notes=parse_draft(body.get("message", {}).get("content", ""))

 return DraftResult(
  draft=draft,
  notes=notes,
  model=body.get("model", MODEL),
  input_tokens=int(body.get("prompt_eval_count", 0)),
  output_tokens=int(body.get("eval_count", 0)),
  duration_ms=duration_ms,
 )
