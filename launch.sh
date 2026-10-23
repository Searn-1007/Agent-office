#!/usr/bin/env bash
set -euo pipefail
if ! command -v python3 >/dev/null 2>&1; then
  echo 'Agent Office cần Python 3. Trên Ubuntu: sudo apt install python3' >&2
  exit 1
fi
exec python3 "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/scripts/launch.py" "$@"
