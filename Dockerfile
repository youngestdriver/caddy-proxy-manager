ARG BASE
FROM ${BASE}
COPY --chmod=755 caddy-panel /usr/local/bin/caddy-panel
COPY --chmod=755 start.sh /usr/local/bin/start.sh
