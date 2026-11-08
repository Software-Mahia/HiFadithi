#!/usr/bin/env bash
# Download the two Piper voices used by HiFadithi.
# Usage: ./scripts/download_voices.sh [target-dir]
set -euo pipefail

target="${1:-$(cd "$(dirname "$0")/.." && pwd)/backend/voices}"
base="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0"
voices=(
    "en/en_GB/alba/medium/en_GB-alba-medium"
    "en/en_US/lessac/medium/en_US-lessac-medium"
    "sw/sw_CD/lanfrica/medium/sw_CD-lanfrica-medium"
)

mkdir -p "$target"
for voice in "${voices[@]}"; do
    name="$(basename "$voice")"
    for ext in onnx onnx.json; do
        file="$target/$name.$ext"
        if [[ -s "$file" ]]; then
            echo "already present: $file"
            continue
        fi
        echo "downloading: $file"
        curl -fL --retry 3 --retry-delay 2 -o "$file.tmp" "$base/$voice.$ext"
        mv "$file.tmp" "$file"
    done
done

echo "Voices installed in $target"
echo "Note: sw_CD-lanfrica-medium is licensed for non-commercial/research use."
