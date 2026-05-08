#!/bin/bash
set -e
export NEXT_DISABLE_NETLIFY_PLUGIN=1
pnpm build
