from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

_SCHEMA_PATH=Path(__file__).with_name("layer_schema.json")

HEX_COLOR=re.compile(r"^#[0-9a-fA-F]{6}$")
HEX_SHORT=re.compile(r"^#[0-9a-fA-F]{3}$")

def load_schema() -> dict[str, Any]:
 with _SCHEMA_PATH.open(encoding="utf-8") as fh:
  return json.load(fh)

SCHEMA=load_schema()
LAYERS: dict[str, dict[str, Any]]=SCHEMA["layers"]
LAYER_LABELS: dict[str, str]=SCHEMA["layerLabels"]
LAYER_ORDER: list[str]=SCHEMA["layerOrder"]
SAFETY_CAPS: list[dict[str, Any]]=SCHEMA["safetyCaps"]
SCHEMA_VERSION: int=SCHEMA["schemaVersion"]

@dataclass
class Warning_:

 kind: str
 path: str
 message: str
 received: Any=None
 used: Any=None

 def as_dict(self) -> dict[str, Any]:
  out: dict[str, Any]={
   "kind": self.kind,
   "path": self.path,
   "message": self.message,
  }
  if self.received is not None:
   out["received"] = self.received
  if self.used is not None:
   out["used"] = self.used
  return out

@dataclass
class NormalizeResult:
 state: dict[str, Any]
 warnings: list[Warning_]=field(default_factory=list)

def _leaf_json_schema(spec: dict[str, Any]) -> dict[str, Any]:
 kind=spec["kind"]
 if kind == "number":
  base: dict[str, Any]={"type": "integer" if spec.get("int") else "number"}
  desc=_describe(spec)
  if desc:
   base["description"] = desc
  return base
 if kind == "bool":
  return {"type": "boolean", "description": spec["label"]}
 if kind == "enum":
  return {"type": "string", "enum": list(spec["values"]), "description": spec["label"]}
 if kind == "color":
  return {"type": "string", "description": f"{spec['label']}, a #RRGGBB hex color"}
 raise ValueError(f"unknown leaf kind {kind!r}")

def _describe(spec: dict[str, Any]) -> str:
 bits=[spec["label"]]
 if spec.get("unit"):
  bits.append(f"in {spec['unit']}")
 bits.append(f"from {spec['min']} to {spec['max']}")
 if spec.get("hint"):
  bits.append(f"({spec['hint']})")
 return ", ".join(bits)

def _object(properties: dict[str, Any]) -> dict[str, Any]:
 return {
  "type": "object",
  "properties": properties,
  "required": list(properties.keys()),
  "additionalProperties": False,
 }

def _config_json_schema(fields: dict[str, Any]) -> dict[str, Any]:
 props: dict[str, Any]={}
 for name, spec in fields.items():
  kind=spec["kind"]
  if kind == "list":
   props[name]={
    "type": "array",
    "description": f"{spec['label']}, at most {spec['maxItems']} entries",
    "items": _object({k: _leaf_json_schema(v) for k, v in spec["of"].items()}),
   }
  elif kind == "polylines":
   props[name]={
    "type": "array",
    "description": (
     f"{spec['label']}, each shape is a list of "
     f"{spec['minPoints']} to {spec['maxPoints']} [x, y] points "
     "with x and y from 0 to 1"
    ),
    "items": {
     "type": "array",
     "items": {"type": "array", "items": {"type": "number"}},
    },
   }
  else:
   props[name]=_leaf_json_schema(spec)
 return _object(props)

def build_json_schema() -> dict[str, Any]:
 variants=[]
 for layer_type, fields in LAYERS.items():
  variants.append(
   _object(
    {
     "type": {"type": "string", "const": layer_type},
     "visible": {"type": "boolean"},
     "opacity": {
      "type": "number",
      "description": "Master opacity from 0 to 1",
     },
     "config": _config_json_schema(fields),
    }
   )
  )

 return _object(
  {
   "layers": {
    "type": "array",
    "description": (
     "The symptom layers that make up this aura, bottom to top. "
     "Include only layers the description actually calls for. "
     "Two or three layers is usually right; more than four is "
     "rarely what someone means."
    ),
    "items": {"anyOf": variants},
   },
   "notes": {
    "type": "string",
    "description": (
     "One short sentence, in plain language, saying what you "
     "built and what you were unsure about. Shown to the person."
    ),
   },
  }
 )

def render_layer_reference() -> str:
 lines: list[str]=[]
 for layer_type in LAYER_ORDER:
  fields=LAYERS[layer_type]
  label=LAYER_LABELS[layer_type]
  parts=[]
  for name, spec in fields.items():
   kind=spec["kind"]
   if kind == "number":
    parts.append(f"{name} ({spec['min']} to {spec['max']})")
   elif kind == "enum":
    parts.append(f"{name} ({'|'.join(spec['values'])})")
   elif kind == "bool":
    parts.append(f"{name} (true|false)")
   elif kind == "color":
    parts.append(f"{name} (#RRGGBB)")
   elif kind == "list":
    parts.append(f"{name} (list, max {spec['maxItems']})")
   elif kind == "polylines":
    parts.append(f"{name} (drawn shapes, usually empty)")
  lines.append(f"{layer_type} - {label}: " + ", ".join(parts))
 return "\n".join(lines)

def _clamp_number(spec: dict[str, Any], raw: Any, path: str, warn: list[Warning_]) -> float | int:
 try:
  value=float(raw)
 except (TypeError, ValueError):
  warn.append(
   Warning_(
    "wrong_type",
    path,
    f"expected a number, using the default {spec['default']}",
    received=raw,
    used=spec["default"],
   )
  )
  return spec["default"]

 if value != value or value in (float("inf"), float("-inf")):
  warn.append(
   Warning_(
    "wrong_type",
    path,
    f"not a finite number, using the default {spec['default']}",
    received=str(raw),
    used=spec["default"],
   )
  )
  return spec["default"]

 if spec.get("int"):
  value=round(value)

 clamped=min(spec["max"], max(spec["min"], value))
 if clamped != value:
  warn.append(
   Warning_(
    "clamped",
    path,
    f"{value} is outside {spec['min']} to {spec['max']}, clamped to {clamped}",
    received=value,
    used=clamped,
   )
  )
 return int(clamped) if spec.get("int") else clamped

def _normalize_leaf(spec: dict[str, Any], raw: Any, path: str, warn: list[Warning_]) -> Any:
 if raw is None:
  warn.append(
   Warning_(
    "missing_field",
    path,
    f"missing, using the default {spec['default']!r}",
    used=spec["default"],
   )
  )
  return spec["default"]

 kind=spec["kind"]

 if kind == "number":
  return _clamp_number(spec, raw, path, warn)

 if kind == "bool":
  if isinstance(raw, bool):
   return raw
  if raw in ("true", 1):
   return True
  if raw in ("false", 0):
   return False
  warn.append(
   Warning_(
    "wrong_type",
    path,
    f"expected true or false, using the default {spec['default']}",
    received=raw,
    used=spec["default"],
   )
  )
  return spec["default"]

 if kind == "enum":
  if isinstance(raw, str) and raw in spec["values"]:
   return raw
  warn.append(
   Warning_(
    "wrong_type",
    path,
    "expected one of " + ", ".join(spec["values"]) + f", using {spec['default']}",
    received=raw,
    used=spec["default"],
   )
  )
  return spec["default"]

 if kind == "color":
  if isinstance(raw, str):
   s=raw.strip()
   if not s.startswith("#"):
    s="#" + s
   if HEX_SHORT.match(s):
    s="#" + "".join(c * 2 for c in s[1:])
   if HEX_COLOR.match(s):
    return s.lower()
  warn.append(
   Warning_(
    "wrong_type",
    path,
    f"expected a #RRGGBB color, using the default {spec['default']}",
    received=raw,
    used=spec["default"],
   )
  )
  return spec["default"]

 raise ValueError(f"unknown leaf kind {kind!r}")

def _normalize_field(spec: dict[str, Any], raw: Any, path: str, warn: list[Warning_]) -> Any:
 kind=spec["kind"]

 if kind == "list":
  if not isinstance(raw, list):
   if raw is not None:
    warn.append(
     Warning_("wrong_type", path, "expected a list, using the defaults", received=raw)
    )
   return [dict(d) for d in spec["default"]]
  items=raw
  if len(items) > spec["maxItems"]:
   warn.append(
    Warning_(
     "list_truncated",
     path,
     f"{len(items)} entries exceeds the maximum of {spec['maxItems']}",
     received=len(items),
     used=spec["maxItems"],
    )
   )
   items=items[: spec["maxItems"]]
  out=[]
  for i, item in enumerate(items):
   src=item if isinstance(item, dict) else {}
   entry={
    key: _normalize_leaf(leaf, src.get(key), f"{path}[{i}].{key}", warn)
    for key, leaf in spec["of"].items()
   }
   out.append(entry)
  if len(out) < spec["minItems"]:
   return [dict(d) for d in spec["default"]]
  return out

 if kind == "polylines":
  if not isinstance(raw, list):
   return []
  shapes=raw[: spec["maxShapes"]]
  out=[]
  for i, shape in enumerate(shapes):
   if not isinstance(shape, list):
    continue
   points=[]
   for p in shape:
    if isinstance(p, list) and len(p) >= 2:
     try:
      x, y = float(p[0]), float(p[1])
     except (TypeError, ValueError):
      continue
     points.append([min(1.0, max(0.0, x)), min(1.0, max(0.0, y))])
   if len(points) < spec["minPoints"]:
    warn.append(
     Warning_(
      "wrong_type",
      f"{path}[{i}]",
      f"{len(points)} usable points is below the minimum "
      f"of {spec['minPoints']}, shape dropped",
      received=len(points),
     )
    )
    continue
   out.append(points[: spec["maxPoints"]])
  return out

 return _normalize_leaf(spec, raw, path, warn)

def normalize_aura_state(raw: Any) -> NormalizeResult:
 warn: list[Warning_]=[]

 if not isinstance(raw, dict):
  warn.append(Warning_("malformed_input", "", "not an object, returning an empty aura"))
  return NormalizeResult({"schemaVersion": SCHEMA_VERSION, "layers": []}, warn)

 layers_raw=raw.get("layers")
 layers: list[dict[str, Any]]=[]
 seen: set[str]=set()

 if isinstance(layers_raw, list):
  for i, item in enumerate(layers_raw):
   if not isinstance(item, dict):
    warn.append(
     Warning_("wrong_type", f"layers[{i}]", "expected an object, dropped", received=item)
    )
    continue
   layer_type=item.get("type")
   if not isinstance(layer_type, str) or layer_type not in LAYERS:
    warn.append(
     Warning_(
      "unknown_layer",
      f"layers[{i}]",
      f"{layer_type!r} is not a layer this app knows, dropped",
      received=layer_type,
     )
    )
    continue
   if layer_type in seen:
    warn.append(
     Warning_(
      "duplicate_layer",
      f"layers[{i}]",
      f"{layer_type} appears more than once, only the first is kept",
      received=layer_type,
     )
    )
    continue
   seen.add(layer_type)

   spec_fields=LAYERS[layer_type]
   raw_config=item.get("config") if isinstance(item.get("config"), dict) else {}
   config={
    name: _normalize_field(spec, raw_config.get(name), f"{layer_type}.{name}", warn)
    for name, spec in spec_fields.items()
   }
   for key in raw_config:
    if key not in spec_fields:
     warn.append(
      Warning_(
       "unknown_field",
       f"{layer_type}.{key}",
       "not part of this layer's schema, dropped",
       received=raw_config[key],
      )
     )

   opacity_spec={"kind": "number", "min": 0, "max": 1, "default": 1, "label": "Opacity"}
   raw_opacity=item.get("opacity")
   opacity=(
    1.0
    if raw_opacity is None
    else _clamp_number(opacity_spec, raw_opacity, f"{layer_type}.opacity", warn)
   )

   layers.append(
    {
     "id": layer_type,
     "type": layer_type,
     "visible": bool(item.get("visible", True)),
     "opacity": opacity,
     "config": config,
    }
   )
 elif layers_raw is not None:
  warn.append(Warning_("wrong_type", "layers", "expected a list, using no layers", received=layers_raw))

 rank={t: i for i, t in enumerate(LAYER_ORDER)}
 layers.sort(key=lambda layer: rank.get(layer["type"], 0))

 return NormalizeResult({"schemaVersion": SCHEMA_VERSION, "layers": layers}, warn)

def assert_safety_caps_intact() -> None:
 for cap in SAFETY_CAPS:
  spec=LAYERS[cap["layer"]][cap["field"]]
  if spec["max"] > cap["max"]:
   raise RuntimeError(
    f"SAFETY: {cap['layer']}.{cap['field']} has max {spec['max']}, "
    f"above the hard cap of {cap['max']} ({cap['why']})"
   )

assert_safety_caps_intact()
