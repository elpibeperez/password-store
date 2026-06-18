#!/usr/bin/env bash
set -e

echo "==> Building web app"
npm run build:cap

echo "==> Copying to Android"
npx cap copy android

echo "==> Registering CapacitorHttp native plugin"
PLUGIN_JSON='[{"classpath":"com.getcapacitor.plugin.CapacitorHttp"}]'
echo "$PLUGIN_JSON" > android/app/src/main/assets/capacitor.plugins.json
echo "    plugins.json: $(cat android/app/src/main/assets/capacitor.plugins.json)"

echo "==> Building APK"
cd android
./gradlew assembleDebug
cd ..

echo "==> Copying APK"
cp android/app/build/outputs/apk/debug/app-debug.apk release/password-store-0.1.0-android.apk
echo "==> Done: release/password-store-0.1.0-android.apk"
