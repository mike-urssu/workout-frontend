#!/bin/sh
# Rebuild and reinstall the Release app on the connected iPhone.
# Free Apple accounts expire the app and its provisioning profile every 7 days;
# -allowProvisioningUpdates lets xcodebuild fetch a fresh profile (expo run:ios can't).
set -e
cd "$(dirname "$0")/.."

[ -d ios ] || npx expo prebuild --platform ios

# Physical devices have 8-16 hex UDIDs; simulators use 8-4-4-4-12 UUIDs.
UDID=$(xcrun devicectl list devices | grep -v unavailable | grep -oE '[0-9A-F]{8}-[0-9A-F]{16}' | head -1)
[ -n "$UDID" ] || { echo "No iPhone found. Connect and unlock it, then retry."; exit 1; }

xcodebuild -workspace ios/workout.xcworkspace -scheme workout -configuration Release \
  -destination "id=$UDID" -derivedDataPath ios/build -allowProvisioningUpdates -quiet build

xcrun devicectl device install app --device "$UDID" ios/build/Build/Products/Release-iphoneos/workout.app
