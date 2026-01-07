#!/bin/sh
set -eu

: "${DEEPBOUNTY_ACCESS_MODE:=public}"
: "${DEEPBOUNTY_BEHIND_PROXY:=false}"
: "${DEEPBOUNTY_TRUSTED_PROXY_CIDRS:=}"

DEEPBOUNTY_REAL_IP_CONFIG=""

if [ "$DEEPBOUNTY_BEHIND_PROXY" = "true" ]; then
	if [ -z "$DEEPBOUNTY_TRUSTED_PROXY_CIDRS" ]; then
		echo "DEEPBOUNTY_BEHIND_PROXY=true requires DEEPBOUNTY_TRUSTED_PROXY_CIDRS" >&2
		echo "Example: DEEPBOUNTY_TRUSTED_PROXY_CIDRS=10.0.0.0/8,172.16.0.0/12" >&2
		exit 1
	fi

	# Generate one set_real_ip_from per CIDR to satisfy nginx syntax.
	# Comma-separated list, no spaces.
	for cidr in $(echo "$DEEPBOUNTY_TRUSTED_PROXY_CIDRS" | tr ',' ' '); do
		DEEPBOUNTY_REAL_IP_CONFIG="$DEEPBOUNTY_REAL_IP_CONFIG\n  set_real_ip_from $cidr;"
	done

	DEEPBOUNTY_REAL_IP_CONFIG="$DEEPBOUNTY_REAL_IP_CONFIG\n  real_ip_header X-Forwarded-For;\n  real_ip_recursive on;\n"
fi

export DEEPBOUNTY_REAL_IP_CONFIG

envsubst '$DEEPBOUNTY_ACCESS_MODE $DEEPBOUNTY_REAL_IP_CONFIG' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
