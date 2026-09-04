#!/usr/bin/env bash
# Regenera index.html a partir de las piezas de src/
# Uso, parado en la raiz del repo:   bash src/build.sh
set -euo pipefail

cd "$(dirname "$0")/.."
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

printf '%s\n' \
  '<!doctype html>' \
  '<html lang="es-AR">' \
  '<head>' \
  '  <meta charset="utf-8">' \
  '  <meta name="viewport" content="width=device-width, initial-scale=1">' \
  '  <title>Vestí Tu Negocio | Remeras, buzos y gorras personalizadas en Córdoba</title>' \
  > "$TMP/p1"

printf '%s\n' \
  '' \
  '  <link rel="preconnect" href="https://fonts.googleapis.com">' \
  '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' \
  '  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">' \
  '  <style>' \
  > "$TMP/p2"

printf '%s\n' '  </style>' '</head>' '<body>' > "$TMP/p3"
printf '%s\n' '</body>' '</html>' > "$TMP/p4"

cat "$TMP/p1" src/head-seo.html "$TMP/p2" src/styles.css "$TMP/p3" \
    src/body.html src/jsonld.html "$TMP/p4" > index.html

echo "index.html regenerado ($(wc -c < index.html) bytes)"
