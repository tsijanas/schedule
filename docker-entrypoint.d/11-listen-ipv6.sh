#!/bin/sh
# Make nginx also listen on IPv6 — but only where the pod has IPv6.
#
# The image's own 10-listen-on-ipv6-by-default.sh does this for the packaged config and skips
# ours because it differs from it (the container log says so). On a dual-stack cluster that
# leaves anything dialling the pod over IPv6 with nothing to connect to. Adding the listen
# lines unconditionally isn't safe either: on a pod without IPv6 nginx refuses to start. So
# check first, and do nothing if there's any doubt.
set -e
conf=/etc/nginx/conf.d/default.conf

if [ ! -f /proc/net/if_inet6 ]; then
    echo "$0: info: no IPv6 on this pod, listening on IPv4 only"
    exit 0
fi
if [ ! -w "$conf" ]; then
    echo "$0: info: $conf is not writable, listening on IPv4 only"
    exit 0
fi
if grep -q 'listen \[::\]' "$conf"; then
    exit 0
fi

sed -i -E 's/^([[:space:]]*)listen ([0-9]+);/&\n\1listen [::]:\2;/' "$conf"
echo "$0: info: IPv6 available, added IPv6 listen lines to $conf"
