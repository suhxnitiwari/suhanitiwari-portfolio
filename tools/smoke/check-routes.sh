#!/usr/bin/env bash
# Smoke test: every public page and the sitemap should answer 200.
# Usage: tools/smoke/check-routes.sh [base-url]   (default http://localhost:5142)
base="${1:-http://localhost:5142}"
fail=0
for path in / /marketing /resume /work/starbucks /Tiwari_Suhani_Resume.pdf /sitemap.xml /robots.txt; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$base$path")
  if [ "$code" = "200" ]; then echo "ok    $code  $path"; else echo "FAIL  $code  $path"; fail=1; fi
done
exit $fail
