from __future__ import annotations

import json
import math

import pytest

from cereva_proxy.schema import (
 LAYERS,
 LAYER_ORDER,
 SAFETY_CAPS,
 assert_safety_caps_intact,
 build_json_schema,
 normalize_aura_state,
 render_layer_reference,
)

def test_safety_caps_are_declared():
 assert len(SAFETY_CAPS) == 3
 for cap in SAFETY_CAPS:
  assert cap["layer"] in LAYERS, cap
  assert cap["field"] in LAYERS[cap["layer"]], cap
  assert cap["why"], "a safety cap without a reason will get removed by someone"

def test_safety_caps_intact_passes_on_the_real_table():
 assert_safety_caps_intact() is None

@pytest.mark.parametrize("cap", SAFETY_CAPS, ids=lambda c: f"{c['layer']}.{c['field']}")
def test_spec_max_never_exceeds_the_cap(cap):
 spec=LAYERS[cap["layer"]][cap["field"]]
 assert spec["kind"] == "number"
 assert spec["max"] <= cap["max"]

@pytest.mark.parametrize("cap", SAFETY_CAPS, ids=lambda c: f"{c['layer']}.{c['field']}")
def test_dangerous_values_are_clamped(cap):
 for attempt in [1e9, "99999", cap["max"] * 10, 10**15, float("inf")]:
  result=normalize_aura_state(
   {"layers": [{"type": cap["layer"], "config": {cap["field"]: attempt}}]}
  )
  value=result.state["layers"][0]["config"][cap["field"]]
  assert value <= cap["max"], f"{attempt!r} produced {value}"

def test_flicker_rates_cannot_reach_the_photosensitive_band():
 hz_caps={
  "photopsia_flashes": ("flashes_per_minute", 60.0),
  "phosphene_burst": ("burst_rate_per_minute", 60.0),
  "oscillopsia": ("frequency_hz", 1.0),
 }
 for layer, (field_name, divisor) in hz_caps.items():
  spec=LAYERS[layer][field_name]
  max_hz=spec["max"] / divisor
  assert max_hz <= 10.0, f"{layer}.{field_name} reaches {max_hz} Hz"

def test_json_schema_is_serializable_and_covers_every_layer():
 schema=build_json_schema()
 text=json.dumps(schema)
 assert len(text) > 0
 variants=schema["properties"]["layers"]["items"]["anyOf"]
 assert len(variants) == 21
 names={v["properties"]["type"]["const"] for v in variants}
 assert names == set(LAYERS)

def test_json_schema_obeys_structured_output_constraints():
 problems: list[str]=[]

 def walk(node, path="root"):
  if isinstance(node, dict):
   if node.get("type") == "object":
    if node.get("additionalProperties") is not False:
     problems.append(f"{path}: additionalProperties is not false")
    if set(node.get("required", [])) != set(node.get("properties", {})):
     problems.append(f"{path}: required does not match properties")
   for banned in ("minimum", "maximum", "minLength", "maxLength", "multipleOf"):
    if banned in node:
     problems.append(f"{path}: unsupported constraint {banned}")
   for key, value in node.items():
    walk(value, f"{path}.{key}")
  elif isinstance(node, list):
   for i, value in enumerate(node):
    walk(value, f"{path}[{i}]")

 walk(build_json_schema())
 assert problems == []

def test_layer_reference_mentions_every_layer():
 reference=render_layer_reference()
 for layer in LAYER_ORDER:
  assert layer in reference

def test_never_raises_on_hostile_input():
 for raw in [
  None,
  0,
  "",
  "not json",
  [],
  {"layers": "nope"},
  {"layers": [None, 3, "x", {}]},
  {"layers": [{"type": "visual_snow", "config": None}]},
  {"layers": [{"type": "visual_snow", "config": {"density": float("nan")}}]},
  {"layers": [{"type": 123}]},
 ]:
  result=normalize_aura_state(raw)
  assert isinstance(result.state["layers"], list)

def test_unknown_layers_are_rejected():
 result=normalize_aura_state(
  {"layers": [{"type": "visual_snow"}, {"type": "telepathy"}, {"type": "x"}]}
 )
 assert [layer["type"] for layer in result.state["layers"]] == ["visual_snow"]
 assert sum(1 for w in result.warnings if w.kind == "unknown_layer") == 2

def test_unknown_fields_are_dropped():
 result=normalize_aura_state(
  {"layers": [{"type": "visual_snow", "config": {"density": 500, "sparkliness": 11}}]}
 )
 assert "sparkliness" not in result.state["layers"][0]["config"]
 assert any(w.kind == "unknown_field" for w in result.warnings)

def test_missing_fields_get_defaults():
 result=normalize_aura_state({"layers": [{"type": "visual_snow", "config": {}}]})
 config=result.state["layers"][0]["config"]
 for name, spec in LAYERS["visual_snow"].items():
  if spec["kind"] not in ("list", "polylines"):
   assert config[name] == spec["default"], name

def test_numeric_strings_and_loose_booleans_are_accepted():
 result=normalize_aura_state(
  {"layers": [{"type": "visual_snow", "config": {"density": "4200", "color_noise": "true"}}]}
 )
 config=result.state["layers"][0]["config"]
 assert config["density"] == 4200
 assert config["color_noise"] is True

def test_nan_and_infinity_fall_back_to_defaults():
 for bad in [float("nan"), float("inf"), float("-inf")]:
  result=normalize_aura_state(
   {"layers": [{"type": "visual_snow", "config": {"brightness": bad}}]}
  )
  value=result.state["layers"][0]["config"]["brightness"]
  assert not math.isnan(value) and math.isfinite(value)

def test_sloppy_colors_are_repaired_and_impossible_ones_rejected():
 result=normalize_aura_state(
  {"layers": [{"type": "scotoma", "config": {"fill_color": "abc", "border_color": "mauve"}}]}
 )
 config=result.state["layers"][0]["config"]
 assert config["fill_color"] == "#aabbcc"
 assert config["border_color"] == LAYERS["scotoma"]["border_color"]["default"]

def test_duplicate_layers_keep_the_first():
 result=normalize_aura_state(
  {"layers": [{"type": "scotoma", "opacity": 0.25}, {"type": "scotoma", "opacity": 0.9}]}
 )
 assert len(result.state["layers"]) == 1
 assert result.state["layers"][0]["opacity"] == 0.25
 assert any(w.kind == "duplicate_layer" for w in result.warnings)

def test_lists_are_truncated():
 points=[{"x": i / 40, "y": 0.5} for i in range(40)]
 result=normalize_aura_state(
  {"layers": [{"type": "photopsia_flashes", "config": {"flash_points": points}}]}
 )
 assert len(result.state["layers"][0]["config"]["flash_points"]) == 20
 assert any(w.kind == "list_truncated" for w in result.warnings)

def test_output_is_sorted_into_canonical_compositing_order():
 result=normalize_aura_state(
  {"layers": [{"type": "oscillopsia"}, {"type": "visual_snow"}, {"type": "scotoma"}]}
 )
 assert [layer["type"] for layer in result.state["layers"]] == [
  "visual_snow",
  "scotoma",
  "oscillopsia",
 ]

def test_normalizing_twice_changes_nothing():
 once=normalize_aura_state(
  {"layers": [{"type": "visual_snow", "config": {"density": 9999999}}]}
 )
 twice=normalize_aura_state(once.state)
 assert twice.state == once.state
 assert twice.warnings == []
