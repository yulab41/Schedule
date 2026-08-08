#!/usr/bin/env bash
set -u

printf '\n==== %s ====\n' "$(date '+%F %T %Z')"
free -h
echo "--- disk ---"
df -h / | tail -1
echo "--- docker ---"
docker ps --format 'table {{.Names}}\t{{.Status}}' 2>/dev/null || true
docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}' 2>/dev/null || true
