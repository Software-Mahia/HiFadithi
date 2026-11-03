#!/usr/bin/env bash
# Render runs this on every deploy (from the backend/ folder). Owner: C.
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input   # admin CSS/JS for WhiteNoise
python manage.py migrate --no-input         # migrations run here only, never from laptops
python manage.py setup_roles                # keep the researcher/curator/admin groups in step