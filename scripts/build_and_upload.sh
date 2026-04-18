#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Building APK..."
cd "$PROJECT_ROOT/app/android"
./gradlew assembleRelease

APK_PATH="$PROJECT_ROOT/app/android/app/build/outputs/apk/release/app-release.apk"

if [ ! -f "$APK_PATH" ]; then
    echo "Error: APK build failed"
    exit 1
fi

echo "APK built successfully: $APK_PATH"
echo ""

read -p "Upload to Google Drive? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    python3 "$SCRIPT_DIR/upload_apk.py" "$APK_PATH"
else
    echo "Skipped upload. You can upload manually later with:"
    echo "python3 $SCRIPT_DIR/upload_apk.py $APK_PATH"
fi
