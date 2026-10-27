from __future__ import annotations

import logging

import pytest
from fastapi.testclient import TestClient

from cereva_proxy import claude, main
from cereva_proxy.claude import DraftResult, ModelRefusedError, ModelUnavailableError

@pytest.fixture
def client(monkeypatch):
 monkeypatch.setattr(main.limiter, "enabled", False)
 return TestClient(main.app)

def fake_draft(**overrides):
 base=dict(
  draft={"layers": [{"type": "visual_snow", "config": {"density": 4000}}]},
  notes="I used visual snow across the whole field.",
  model="claude-opus-5",
  input_tokens=1200,
  output_tokens=300,
  duration_ms=850,
 )
 base.update(overrides)
 return DraftResult(**base)

def test_health_reports_nothing_about_usage(client):
 response=client.get("/health")
 assert response.status_code == 200
 assert response.json() == {"ok": True, "schema_version": 1}

def test_describe_returns_a_clamped_draft(client, monkeypatch):
 monkeypatch.setattr(main, "draft_from_description", lambda d: fake_draft())
 response=client.post("/v1/describe", json={"description": "static everywhere"})
 assert response.status_code == 200
 body=response.json()
 assert body["schema_version"] == 1
 assert body["draft"]["layers"][0]["type"] == "visual_snow"
 assert body["notes"]
 assert body["model"] == "claude-opus-5"

def test_a_dangerous_draft_is_clamped_before_it_leaves_the_server(client, monkeypatch):
 monkeypatch.setattr(
  main,
  "draft_from_description",
  lambda d: fake_draft(
   draft={
    "layers": [
     {"type": "photopsia_flashes", "config": {"flashes_per_minute": 600}},
     {"type": "oscillopsia", "config": {"frequency_hz": 45}},
    ]
   }
  ),
 )
 response=client.post("/v1/describe", json={"description": "fast flashing"})
 assert response.status_code == 200
 body=response.json()

 by_type={layer["type"]: layer for layer in body["draft"]["layers"]}
 assert by_type["photopsia_flashes"]["config"]["flashes_per_minute"] <= 180
 assert by_type["oscillopsia"]["config"]["frequency_hz"] <= 10

 clamped=[w for w in body["warnings"] if w["kind"] == "clamped"]
 assert len(clamped) >= 2, "the user must be told the values were changed"

 assert body["raw_draft"]["layers"][0]["config"]["flashes_per_minute"] == 600

def test_unknown_layers_are_dropped(client, monkeypatch):
 monkeypatch.setattr(
  main,
  "draft_from_description",
  lambda d: fake_draft(draft={"layers": [{"type": "kaleidoscope", "config": {}}]}),
 )
 body=client.post("/v1/describe", json={"description": "x y z"}).json()
 assert body["draft"]["layers"] == []
 assert any(w["kind"] == "unknown_layer" for w in body["warnings"])

def test_refusal_becomes_a_422_with_a_usable_message(client, monkeypatch):
 def refuse(_description):
  raise ModelRefusedError("cyber", "declined")

 monkeypatch.setattr(main, "draft_from_description", refuse)
 response=client.post("/v1/describe", json={"description": "something refused"})
 assert response.status_code == 422
 body=response.json()
 assert body["error"] == "declined"
 assert "by hand" in body["message"]

def test_upstream_failure_becomes_a_503(client, monkeypatch):
 def fail(_description):
  raise ModelUnavailableError("could not reach the model")

 monkeypatch.setattr(main, "draft_from_description", fail)
 response=client.post("/v1/describe", json={"description": "anything at all"})
 assert response.status_code == 503
 assert response.json()["error"] == "unavailable"

@pytest.mark.parametrize(
 "payload",
 [
  {},
  {"description": ""},
  {"description": "  "},
  {"description": "ab"},
  {"description": "x" * 2001},
  {"description": 42},
  {"description": None},
 ],
)
def test_bad_descriptions_are_rejected(client, payload):
 assert client.post("/v1/describe", json=payload).status_code == 422

def test_extra_request_fields_are_rejected_loudly(client, monkeypatch):
 monkeypatch.setattr(main, "draft_from_description", lambda d: fake_draft())
 response=client.post(
  "/v1/describe",
  json={"description": "static everywhere", "user_id": "abc", "device_id": "xyz"},
 )
 assert response.status_code == 422

def test_logs_contain_no_content(client, monkeypatch, caplog):
 secret="a very distinctive phrase about my left eye"
 monkeypatch.setattr(main, "draft_from_description", lambda d: fake_draft())
 with caplog.at_level(logging.DEBUG):
  client.post("/v1/describe", json={"description": secret})
 logged="\n".join(record.getMessage() for record in caplog.records)
 assert secret not in logged
 assert "left eye" not in logged
 assert "visual_snow" not in logged

def test_model_errors_do_not_leak_the_description(monkeypatch, caplog):
 import anthropic

 class Boom(anthropic.APIConnectionError):
  def __init__(self):
   super().__init__(message="boom", request=None)

 monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-not-real")

 class FakeMessages:
  def create(self, **kwargs):
   raise Boom()

 class FakeClient:
  messages=FakeMessages()

 monkeypatch.setattr(claude.anthropic, "Anthropic", lambda **kw: FakeClient())

 with caplog.at_level(logging.DEBUG):
  with pytest.raises(ModelUnavailableError):
   claude.draft_from_description("my private description")

 logged="\n".join(record.getMessage() for record in caplog.records)
 assert "my private description" not in logged

def test_missing_api_key_is_a_clear_server_error(monkeypatch):
 monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
 with pytest.raises(ModelUnavailableError) as exc:
  claude.draft_from_description("anything")
 assert "ANTHROPIC_API_KEY" in str(exc.value)
 assert "must not be asked" in str(exc.value)

def test_oversized_body_is_rejected_before_parsing(client):
 response=client.post(
  "/v1/describe",
  content=b'{"description":"' + b"x" * (80 * 1024) + b'"}',
  headers={"content-type": "application/json"},
 )
 assert response.status_code == 413

def test_a_lying_content_length_is_still_caught(client):
 response=client.post(
  "/v1/describe",
  content=b'{"description":"' + b"x" * (80 * 1024) + b'"}',
  headers={"content-type": "application/json", "content-length": "20"},
 )
 assert response.status_code in (400, 413, 422)

def test_client_token_is_required_when_configured(client, monkeypatch):
 monkeypatch.setenv("CEREVA_CLIENT_TOKEN", "a-real-token")
 monkeypatch.setattr(main, "draft_from_description", lambda d: fake_draft())

 refused=client.post("/v1/describe", json={"description": "static everywhere"})
 assert refused.status_code == 401
 assert "token" not in refused.text.lower()

 wrong=client.post(
  "/v1/describe",
  json={"description": "static everywhere"},
  headers={"x-cereva-client": "not-the-token"},
 )
 assert wrong.status_code == 401

 right=client.post(
  "/v1/describe",
  json={"description": "static everywhere"},
  headers={"x-cereva-client": "a-real-token"},
 )
 assert right.status_code == 200

def test_no_token_configured_means_open(client, monkeypatch):
 monkeypatch.delenv("CEREVA_CLIENT_TOKEN", raising=False)
 monkeypatch.setattr(main, "draft_from_description", lambda d: fake_draft())
 assert client.post("/v1/describe", json={"description": "static everywhere"}).status_code == 200

 from cereva_proxy.security import startup_warnings

 assert any("CEREVA_CLIENT_TOKEN" in w for w in startup_warnings())

def test_server_misconfiguration_is_not_disclosed_to_the_client(client, monkeypatch):

 def fail(_description):
  raise ModelUnavailableError("ANTHROPIC_API_KEY is not set on the server.")

 monkeypatch.setattr(main, "draft_from_description", fail)
 response=client.post("/v1/describe", json={"description": "anything at all"})
 assert response.status_code == 503
 assert "ANTHROPIC_API_KEY" not in response.text
 assert "not set" not in response.text

def test_security_headers_are_present(client):
 response=client.get("/health")
 headers={k.lower(): v for k, v in response.headers.items()}
 assert "no-store" in headers["cache-control"]
 assert headers["x-content-type-options"] == "nosniff"
 assert headers["x-frame-options"] == "DENY"
 assert headers["referrer-policy"] == "no-referrer"
 assert headers.get("server") == "cereva"

def test_startup_warns_about_a_wide_open_forwarded_header(monkeypatch):
 from cereva_proxy.security import startup_warnings

 monkeypatch.setenv("FORWARDED_ALLOW_IPS", "*")
 assert any("X-Forwarded-For" in w for w in startup_warnings())

def test_docs_are_off_by_default(client):
 assert client.get("/docs").status_code == 404
 assert client.get("/redoc").status_code == 404

def test_unknown_routes_say_nothing_useful(client):
 for path in ["/admin", "/.env", "/v1/../etc/passwd", "/metrics"]:
  response=client.get(path)
  assert response.status_code in (404, 405)
  assert "uvicorn" not in response.text.lower()
