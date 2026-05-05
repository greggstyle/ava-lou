#!/usr/bin/env bash
#
# Build, sign, archive and upload iOS app to App Store Connect / TestFlight.
# Run on a Mac with Xcode installed and signed in with the Apple Developer account.
#
# Prerequisites:
#   1. Xcode installed
#   2. Apple Developer account active ($99/year)
#   3. Bundle ID fr.digidatale.ava registered
#   4. App created in App Store Connect
#   5. .appstore/.env populated (copy from .env.example)
#   6. .appstore/AuthKey_*.p8 in place
#
# Usage:
#   ./scripts/ios-archive-and-upload.sh
#
# What it does:
#   - pnpm cap sync ios (copy latest web build refs)
#   - xcodebuild archive (with auto signing)
#   - xcodebuild -exportArchive (with App Store Connect API key)
#   - Build is then visible in App Store Connect → TestFlight in 5-15 min

set -euo pipefail

cd "$(dirname "$0")/.."

# Load env
if [ -f .appstore/.env ]; then
  set -a
  # shellcheck disable=SC1091
  source .appstore/.env
  set +a
else
  echo "Error: .appstore/.env not found. Copy .appstore/.env.example and fill in your values."
  exit 1
fi

: "${ASC_KEY_ID:?ASC_KEY_ID required}"
: "${ASC_ISSUER_ID:?ASC_ISSUER_ID required}"
: "${ASC_KEY_PATH:?ASC_KEY_PATH required}"
: "${APP_BUNDLE_ID:?APP_BUNDLE_ID required}"

if [ ! -f "$ASC_KEY_PATH" ]; then
  echo "Error: ASC_KEY_PATH ($ASC_KEY_PATH) not found"
  exit 1
fi

# Build paths
WORKSPACE="ios/App/App.xcworkspace"
SCHEME="App"
BUILD_DIR="ios/App/build"
ARCHIVE_PATH="$BUILD_DIR/AVA.xcarchive"
EXPORT_PATH="$BUILD_DIR/export"
EXPORT_OPTIONS="scripts/exportOptions.plist"

echo "Step 1/3: Capacitor sync"
pnpm cap sync ios

echo "Step 2/3: Xcode archive"
rm -rf "$BUILD_DIR"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -archivePath "$ARCHIVE_PATH" \
  -allowProvisioningUpdates \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID" \
  -authenticationKeyPath "$(pwd)/$ASC_KEY_PATH" \
  archive

echo "Step 3/3: Export + upload to App Store Connect"
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  -allowProvisioningUpdates \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID" \
  -authenticationKeyPath "$(pwd)/$ASC_KEY_PATH"

echo ""
echo "Build uploaded. Check App Store Connect -> TestFlight in 5-15 min."
echo "  https://appstoreconnect.apple.com/apps"
