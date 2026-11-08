"""Local development settings."""
from .base import *  # noqa: F401,F403

DEBUG = True
# Ported from the hifadithi MVP: phone/tablet LAN testing reaches the dev
# server via the machine's LAN IP, so accept any host in DEBUG.
ALLOWED_HOSTS = ["*"]
