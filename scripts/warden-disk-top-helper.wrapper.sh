#!/usr/bin/env bash
set -euo pipefail

# Install target (root-owned):
#   /usr/local/sbin/warden-disk-top-helper
# Wrapper to call the root-owned Python helper placed in /usr/local/libexec.

exec /usr/bin/python3 /usr/local/libexec/warden-disk-top-helper.py
