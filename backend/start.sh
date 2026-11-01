#!/bin/sh
set -e

# Env vars only exist at runtime, so config is cached here, not in the image.
php artisan migrate --force
php artisan config:cache
php artisan route:cache

# Free hosts give one container, so the worker and scheduler run beside the
# web server. Each loop restarts its process if it ever exits.
(while true; do php artisan queue:work --sleep=3 --tries=3 --max-time=3600; sleep 1; done) &
(while true; do php artisan schedule:work; sleep 1; done) &

exec php artisan serve --host=0.0.0.0 --port="${PORT:-8000}"
