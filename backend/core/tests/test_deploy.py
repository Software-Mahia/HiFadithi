"""Checks the deployment settings without deploying anything."""
import importlib
import sys

import pytest
from django.test import Client


def load_production_settings(monkeypatch, **env):
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    sys.modules.pop("config.settings.production", None)
    return importlib.import_module("config.settings.production")


def test_health_check_answers_without_signing_in():
    response = Client().get("/healthz/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_production_settings_are_safe_and_know_the_render_address(monkeypatch):
    prod = load_production_settings(
        monkeypatch,
        SECRET_KEY="x" * 60,
        RENDER_EXTERNAL_HOSTNAME="hifadithi-api.onrender.com",
    )
    assert prod.DEBUG is False
    assert "hifadithi-api.onrender.com" in prod.ALLOWED_HOSTS
    assert "https://hifadithi-api.onrender.com" in prod.CSRF_TRUSTED_ORIGINS
    assert prod.SESSION_COOKIE_SECURE and prod.CSRF_COOKIE_SECURE
    assert "whitenoise.middleware.WhiteNoiseMiddleware" in prod.MIDDLEWARE
    assert prod.STORAGES["staticfiles"]["BACKEND"].startswith("whitenoise.")


def test_production_refuses_to_start_without_a_secret_key(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.setattr("environ.Env.read_env", lambda *a, **k: None)
    with pytest.raises(Exception, match="SECRET_KEY"):
        load_production_settings(monkeypatch)