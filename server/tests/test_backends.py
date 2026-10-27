from __future__ import annotations

import importlib

import pytest

from cereva_proxy import backends, drafting, ollama_backend
from cereva_proxy.drafting import ModelUnavailableError, parse_draft

def reload_with(monkeypatch, **env):
 for k, v in env.items():
  if v is None:
   monkeypatch.delenv(k, raising=False)
  else:
   monkeypatch.setenv(k, v)
 return importlib.reload(backends)

def test_an_unknown_backend_name_fails_loudly(monkeypatch):
 mod=reload_with(monkeypatch, CEREVA_BACKEND_DESCRIBE="gpt4")
 with pytest.raises(ModelUnavailableError) as exc:
  mod.draft_from_description("anything")
 assert "gpt4" in str(exc.value)
 importlib.reload(backends)

def test_auto_falls_back_to_anthropic_when_ollama_is_down(monkeypatch):
 mod=reload_with(
  monkeypatch, CEREVA_BACKEND_DESCRIBE="auto", ANTHROPIC_API_KEY="test-key-not-real"
 )
 monkeypatch.setattr(ollama_backend, "available", lambda: (False, "not running"))
 assert mod.describe_backend_name() == "anthropic"
 importlib.reload(backends)

def test_auto_prefers_ollama_when_it_is_up(monkeypatch):
 mod=reload_with(
  monkeypatch, CEREVA_BACKEND_DESCRIBE="auto", ANTHROPIC_API_KEY="test-key-not-real"
 )
 monkeypatch.setattr(ollama_backend, "available", lambda: (True, ""))
 assert mod.describe_backend_name() == "ollama"
 importlib.reload(backends)

def test_auto_with_nothing_available_names_both_problems(monkeypatch):
 mod=reload_with(monkeypatch, CEREVA_BACKEND_DESCRIBE="auto", ANTHROPIC_API_KEY=None)
 monkeypatch.setattr(ollama_backend, "available", lambda: (False, "not running"))
 assert mod.describe_backend_name() == "none"
 with pytest.raises(ModelUnavailableError) as exc:
  mod.draft_from_description("anything")
 message=str(exc.value)
 assert "not running" in message
 assert "ANTHROPIC_API_KEY" in message
 importlib.reload(backends)

def test_explicit_ollama_does_not_silently_fall_back(monkeypatch):
 mod=reload_with(
  monkeypatch, CEREVA_BACKEND_DESCRIBE="ollama", ANTHROPIC_API_KEY="test-key-not-real"
 )
 monkeypatch.setattr(ollama_backend, "available", lambda: (False, "not running"))
 assert mod.describe_backend_name() == "ollama"
 importlib.reload(backends)

def test_no_api_key_warning_when_drafting_is_local(monkeypatch):
 from cereva_proxy.security import startup_warnings

 monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

 monkeypatch.setenv("CEREVA_BACKEND_DESCRIBE", "ollama")
 assert not any("ANTHROPIC_API_KEY" in w for w in startup_warnings())

 monkeypatch.setenv("CEREVA_BACKEND_DESCRIBE", "anthropic")
 assert any("ANTHROPIC_API_KEY" in w for w in startup_warnings())

def test_parse_draft_rejects_junk():
 with pytest.raises(ModelUnavailableError):
  parse_draft("")
 with pytest.raises(ModelUnavailableError):
  parse_draft("sure, here is your aura!")
 with pytest.raises(ModelUnavailableError):
  parse_draft("[1, 2, 3]")
 with pytest.raises(ModelUnavailableError):
  parse_draft('{"notes": "no layers key"}')

def test_parse_draft_accepts_a_well_formed_draft():
 draft, notes=parse_draft('{"layers": [{"type": "visual_snow"}], "notes": "hello"}')
 assert draft == {"layers": [{"type": "visual_snow"}]}
 assert notes == "hello"

def test_parse_draft_tolerates_missing_notes():
 draft, notes=parse_draft('{"layers": []}')
 assert draft == {"layers": []}
 assert notes == ""

def test_ollama_context_window_is_big_enough_for_the_schema():
 from cereva_proxy.schema import build_json_schema, render_layer_reference
 import json

 prompt=drafting.SYSTEM_PROMPT.format(layer_reference=render_layer_reference())
 approx=(len(prompt) + len(json.dumps(build_json_schema()))) // 4
 assert ollama_backend.NUM_CTX > approx * 1.5

def test_ollama_reports_a_missing_model_rather_than_guessing(monkeypatch):
 class FakeResponse:
  status_code=200

  @staticmethod
  def json():
   return {"models": [{"name": "llama3.1:8b"}]}

  @staticmethod
  def raise_for_status():
   return None

 monkeypatch.setattr(ollama_backend.httpx, "get", lambda *a, **k: FakeResponse())
 monkeypatch.setattr(ollama_backend, "MODEL", "qwen2.5:14b")
 ok, why=ollama_backend.available()
 assert ok is False
 assert "qwen2.5:14b" in why

def test_ollama_truncated_output_is_not_passed_off_as_a_draft(monkeypatch):
 class FakeResponse:
  status_code=200

  @staticmethod
  def json():
   return {"done_reason": "length", "message": {"content": '{"layers": []}'}}

 monkeypatch.setattr(ollama_backend.httpx, "post", lambda *a, **k: FakeResponse())
 with pytest.raises(ModelUnavailableError) as exc:
  ollama_backend.draft_from_description("anything")
 assert "cut off" in str(exc.value)

def test_ollama_errors_do_not_leak_the_description(monkeypatch, caplog):
 import logging

 def boom(*a, **k):
  raise ollama_backend.httpx.ConnectError("refused")

 monkeypatch.setattr(ollama_backend.httpx, "post", boom)
 with caplog.at_level(logging.DEBUG):
  with pytest.raises(ModelUnavailableError) as exc:
   ollama_backend.draft_from_description("a zigzag in my left eye")
 assert "zigzag" not in str(exc.value)
 assert "zigzag" not in "\n".join(r.getMessage() for r in caplog.records)
