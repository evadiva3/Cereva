from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass
from typing import Any

import anthropic

from .schema import build_json_schema, render_layer_reference

log=logging.getLogger("scintilla.claude")

MODEL=os.environ.get("SCINTILLA_MODEL", "claude-opus-5")

EFFORT=os.environ.get("SCINTILLA_EFFORT", "low")

MAX_TOKENS=int(os.environ.get("SCINTILLA_MAX_TOKENS", "16000"))

SYSTEM_PROMPT="""You turn a person's description of their migraine aura into \
a draft configuration for a visual simulator.

The person has a neurological condition and is describing something only they \
can see. Your job is to get as close as you can to what they said, not to make \
something striking. Understatement is better than exaggeration: they will \
adjust it by hand afterwards, and starting too strong is harder to correct than \
starting too weak.

Rules:

- Use only layers the description actually calls for. One to three layers is \
usually right. Do not add layers because they might look good together.
- When the description is vague about a number, choose a middle value. Do not \
choose an extreme to be safe.
- "Everywhere", "all over", "the whole field" means a global layer. "On the \
left", "in one spot", "off to the side" means a positioned one.
- Positions are 0 to 1, where x 0 is the left edge and y 0 is the top edge.
- If the description mentions something no layer covers, leave it out and say \
so in your notes. Do not approximate it with an unrelated layer.
- Never exceed the stated range for any parameter. Rates of flashing and \
movement in particular have hard limits for safety reasons.

The layers available, with each parameter and its range:

{layer_reference}

Write your notes as one short plain sentence addressed to the person, for \
example "I used visual snow across the whole field and added a soft blind spot \
on the left; I was not sure how fast you meant the trails to fade." No \
exclamation marks. Do not claim this is a diagnosis or a measurement."""

@dataclass
class DraftResult:
 draft: dict[str, Any]
 notes: str
 model: str
 input_tokens: int
 output_tokens: int
 duration_ms: int

class ModelRefusedError(RuntimeError):

 def __init__(self, category: str | None, explanation: str | None) -> None:
  self.category=category
  self.explanation=explanation
  super().__init__(f"the model declined this description ({category or 'no category'})")

class ModelUnavailableError(RuntimeError):
 pass

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
 if not text.strip():
  raise ModelUnavailableError("the model returned an empty draft")

 try:
  parsed=json.loads(text)
 except json.JSONDecodeError as exc:
  raise ModelUnavailableError("the model returned text that was not valid JSON") from exc

 if not isinstance(parsed, dict):
  raise ModelUnavailableError("the model returned JSON that was not an object")

 notes=parsed.get("notes")
 return DraftResult(
  draft={"layers": parsed.get("layers", [])},
  notes=notes if isinstance(notes, str) else "",
  model=response.model,
  input_tokens=response.usage.input_tokens,
  output_tokens=response.usage.output_tokens,
  duration_ms=duration_ms,
 )
