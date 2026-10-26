#!/usr/bin/env sh
# Önbellek kırıcı: tüm asset adreslerine ve TV sürüm kontrolüne yeni sürüm yazar.
# Kullanım: ./bump.sh   (her yayından önce)
set -e
cd "$(dirname "$0")"
V=$(date +%Y%m%d%H%M%S)
sed -i -E "s#\?v=[0-9]+#?v=$V#g" index.html control.html assets/js/*.js
sed -i -E "s#^const APP_VERSION = \"[0-9]+\"#const APP_VERSION = \"$V\"#" assets/js/tv.js
printf '{ "v": "%s" }\n' "$V" > version.json
echo "sürüm: $V"
