#!/usr/bin/env bash
# Render runs this on every deploy (from the backend/ folder). Owner: C.
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input   # admin CSS/JS for WhiteNoise
python manage.py migrate --no-input         # migrations run here only, never from laptops
python manage.py setup_roles                # keep the researcher/curator/admin groups in step

# First admin account. Render's free plan has no Shell, so it is created here from
# DJANGO_SUPERUSER_USERNAME / _EMAIL / _PASSWORD. Skipped if those are not set or it exists.
if [ -n "${DJANGO_SUPERUSER_USERNAME:-}" ]; then
  python manage.py createsuperuser --no-input || echo "Admin account already exists, skipping."
fi

# Demo records DEMO-001..005 (create-only: never updates or deletes, so safe on every deploy).
# On when SEED_DEMO=1 in Render. --force only lets it run with DEBUG off.
if [ "${SEED_DEMO:-}" = "1" ]; then
  python manage.py seed_demo --force || echo "seed_demo failed, see log above"
fi
