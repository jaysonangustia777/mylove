#!/usr/bin/env bash
# Run inside this folder. Needs git installed and a GitHub login (HTTPS token or SSH key).
set -e
REPO="https://github.com/jaysonangustia777/Family-Circle-.git"
git init -b main
git add .
git commit -m "Family Circle with Supabase"
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO"
if git ls-remote --exit-code --heads origin main >/dev/null 2>&1; then
  git pull origin main --allow-unrelated-histories --no-edit || true
fi
git push -u origin main
