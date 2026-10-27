from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

SYSTEM_PROMPT="""You turn a person's description of their migraine aura into \
a draft configuration for a visual simulator.

The person has a neurological condition and is describing something only they \
can see. Your job is to get as close as you can to what they said, not to make \
something striking. Understatement is better than exaggeration: they will \
adjust it by hand afterwards, and starting too strong is harder to correct than \
starting too weak.

Rules:

- The description may be an attack transcript containing pain, medication, or other nonvisual symptoms. Use only what they explicitly say they see. If no visual symptoms are described, return an empty layers list and ask for visual details in your notes. Never infer an aura from headache severity.
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

def parse_draft(text: str) -> tuple[dict[str, Any], str]:
 if not text.strip():
  raise ModelUnavailableError("the model returned an empty draft")

 try:
  parsed=json.loads(text)
 except json.JSONDecodeError as exc:
  raise ModelUnavailableError("the model returned text that was not valid JSON") from exc

 if not isinstance(parsed, dict):
  raise ModelUnavailableError("the model returned JSON that was not an object")

 layers=parsed.get("layers")
 if not isinstance(layers, list):
  raise ModelUnavailableError("the model returned a draft with no layers list")

 notes=parsed.get("notes")
 return {"layers": layers}, notes if isinstance(notes, str) else ""
