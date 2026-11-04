#!/bin/sh
# 面板二进制优先用挂载目录里的，更新时只需替换 /etc/caddy/caddy-panel 再重启容器
if [ -f /etc/caddy/caddy-panel ]; then
  cp -f /etc/caddy/caddy-panel /usr/local/bin/caddy-panel
fi
chmod +x /usr/local/bin/caddy-panel 2>/dev/null

# 面板清空 GODEBUG：Go 1.27 起 tlsrsakex 设为 1 会直接 fatal，而 Caddy 仍需它连 AMI BMC
GODEBUG= /usr/local/bin/caddy-panel \
  -listen 127.0.0.1:8081 \
  -dir /etc/caddy \
  -admin http://127.0.0.1:2019 &

GODEBUG=tlsrsakex=1 exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
