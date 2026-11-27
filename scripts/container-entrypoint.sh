#!/bin/sh
set -eu

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"
case "$PUID" in
	''|*[!0-9]*) echo 'PUID must be a numeric user ID' >&2; exit 1 ;;
esac
case "$PGID" in
	''|*[!0-9]*) echo 'PGID must be a numeric group ID' >&2; exit 1 ;;
esac

if [ "$(id -u)" -eq 0 ]; then
	mkdir -p /app/data
	chown -R "$PUID:$PGID" /app/data
	run_as_user() { gosu "$PUID:$PGID" "$@"; }
else
	if [ "$(id -u)" != "$PUID" ] || [ "$(id -g)" != "$PGID" ]; then
		echo 'PUID and PGID must match the container user when overriding Docker user' >&2
		exit 1
	fi
	run_as_user() { "$@"; }
fi

export HOME=/tmp
if [ "$#" -eq 0 ]; then set -- node build; fi

if [ "$1" = node ] && [ "${2:-}" = build ]; then
	if [ -n "${ADMIN_PASSWORD_FILE:-}" ]; then
		if [ -n "${ADMIN_PASSWORD:-}" ]; then
			echo 'Set either ADMIN_PASSWORD or ADMIN_PASSWORD_FILE, not both' >&2
			exit 1
		fi
		ADMIN_PASSWORD="$(cat "$ADMIN_PASSWORD_FILE")"
		export ADMIN_PASSWORD
	fi
	run_as_user npm run db:deploy
	run_as_user npm run db:seed
fi

unset ADMIN_EMAIL ADMIN_PASSWORD ADMIN_PASSWORD_FILE
if [ "$(id -u)" -eq 0 ]; then exec gosu "$PUID:$PGID" "$@"; fi
exec "$@"
