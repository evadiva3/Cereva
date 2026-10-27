from __future__ import annotations

import logging
import os
import time

import anthropic

from .drafting import (
 SYSTEM_PROMPT,
 DraftResult,
 ModelRefusedError,
 ModelUnavailableError,
 parse_draft,
)
from .schema import build_json_schema, render_layer_reference

log=logging.getLogger("cereva.claude")

MODEL=os.environ.get("CEREVA_MODEL", "claude-opus-5")

EFFORT=os.environ.get("CEREVA_EFFORT", "low")

MAX_TOKENS=int(os.environ.get("CEREVA_MAX_TOKENS", "16000"))

def _client() -> anthropic.Anthropic:
 if not os.environ.get("ANTHROPIC_API_KEY"):
  raise ModelUnavailableError(
   "ANTHROPIC_API_KEY is not set on the server. "
   "The app cannot supply it and must not be asked to."
  )
 return anthropic.Anthropic(max_retries=2)

def draft_from_description(description: str) -> DraftResult:
 started=time.monotonic()
 client=_client()

 try:
  response=client.messages.create(
   model=MODEL,
   max_tokens=MAX_TOKENS,
   system=[
    {
     "type": "text",
     "text": SYSTEM_PROMPT.format(layer_reference=render_layer_reference()),
     "cache_control": {"type": "ephemeral"},
    }
   ],
   output_config={
    "effort": EFFORT,
    "format": {"type": "json_schema", "schema": build_json_schema()},
   },
   messages=[{"role": "user", "content": description}],
  )
 except anthropic.RateLimitError as exc:
  raise ModelUnavailableError("the model is rate limited, try again shortly") from exc
 except anthropic.APIStatusError as exc:
  log.warning("model call failed with status %s", exc.status_code)
  raise ModelUnavailableError(f"the model returned status {exc.status_code}") from exc
 except anthropic.APIConnectionError as exc:
  raise ModelUnavailableError("could not reach the model") from exc

 duration_ms=int((time.monotonic() - started) * 1000)

 if response.stop_reason == "refusal":
  details=getattr(response, "stop_details", None)
  raise ModelRefusedError(
   getattr(details, "category", None),
   getattr(details, "explanation", None),
  )

 if response.stop_reason == "max_tokens":
  raise ModelUnavailableError(
   "the draft was cut off before it finished. Try a shorter description."
  )

 text="".join(block.text for block in response.content if block.type == "text")
 draft, notes=parse_draft(text)

 return DraftResult(
  draft=draft,
  notes=notes,
  model=response.model,
  input_tokens=response.usage.input_tokens,
  output_tokens=response.usage.output_tokens,
  duration_ms=duration_ms,
 )
