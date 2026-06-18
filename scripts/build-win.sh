#!/usr/bin/env bash
set -e

NAME="password-store"
VERSION="0.1.0"
DESCRIPTION="Electron frontend for pass (password-store)"
ELECTRON_VERSION=$(node -p "require('electron/package.json').version")

cd "$(dirname "$0")/.."
ROOT="$PWD"
BUILD_DIR="$ROOT/build-win"
APP_DIR="$BUILD_DIR/$NAME-win32-x64"
RELEASE_FILE="$ROOT/release/${NAME}-${VERSION}-win32-x64.zip"

echo "==> Cleaning build directory"
rm -rf "$BUILD_DIR"

echo "==> Building app (electron-vite)"
npm run build

echo "==> Setting up app directory"
mkdir -p "$APP_DIR/resources/app"

echo "==> Downloading Electron $ELECTRON_VERSION for Windows"
EL_ZIP="electron-v${ELECTRON_VERSION}-win32-x64.zip"
EL_URL="https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}/${EL_ZIP}"

if [ ! -f "$BUILD_DIR/$EL_ZIP" ]; then
  echo "    Downloading $EL_URL..."
  curl -L -o "$BUILD_DIR/$EL_ZIP" "$EL_URL"
fi

echo "==> Extracting Electron"
unzip -q -o "$BUILD_DIR/$EL_ZIP" -d "$APP_DIR"

echo "==> Copying app files"
cp -r out/ "$APP_DIR/resources/app/out"
cp package.json "$APP_DIR/resources/app/"

echo "==> Installing production dependencies"
cd "$APP_DIR/resources/app"
npm install --omit=dev --no-audit --no-fund 2>&1 | tail -3
cd "$ROOT"

echo "==> Creating launcher script (password-store.bat)"
cat > "$APP_DIR/password-store.bat" << 'BAT'
@echo off
start "" "%~dp0electron.exe" "%~dp0resources\app"
BAT

echo "==> Creating portable ZIP"
mkdir -p "$ROOT/release"
rm -f "$RELEASE_FILE"
cd "$BUILD_DIR"
zip -qr "$RELEASE_FILE" "${NAME}-win32-x64"
cd "$ROOT"

echo "==> Creating NSIS installer (if makensis available)"
if command -v makensis &> /dev/null; then
  echo "    Creating NSIS script..."
  cat > "$BUILD_DIR/installer.nsi" << NSIS
!include "MUI2.nsh"

Name "$NAME"
OutFile "$ROOT/release/${NAME}-${VERSION}-win32-x64-setup.exe"
InstallDir "\$PROGRAMFILES\\$NAME"
RequestExecutionLevel admin

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "English"

!define MUI_ICON "build\\icon.ico"
!define MUI_UNICON "build\\icon.ico"

Section "Install"
  SetOutPath "\$INSTDIR"
  File /r "${NAME}-win32-x64\\*.*"
  File "build\\icon.ico"
  CreateShortCut "\$DESKTOP\\$NAME.lnk" "\$INSTDIR\\$NAME.bat" "" "\$INSTDIR\\icon.ico"
  CreateDirectory "\$SMPROGRAMS\\$NAME"
  CreateShortCut "\$SMPROGRAMS\\$NAME\\$NAME.lnk" "\$INSTDIR\\$NAME.bat" "" "\$INSTDIR\\icon.ico"
  CreateShortCut "\$SMPROGRAMS\\$NAME\\Uninstall.lnk" "\$INSTDIR\\uninstall.exe"
  WriteUninstaller "\$INSTDIR\\uninstall.exe"
SectionEnd

Section "Uninstall"
  RMDir /r "\$INSTDIR"
  Delete "\$DESKTOP\\$NAME.lnk"
  RMDir /r "\$SMPROGRAMS\\$NAME"
SectionEnd
NSIS
  echo "    Compiling NSIS installer..."
  makensis "$BUILD_DIR/installer.nsi" 2>&1 | tail -3
  echo "    Done: release/${NAME}-${VERSION}-win32-x64-setup.exe"
else
  echo "    makensis not found. Install with: sudo apt install nsis"
fi

echo "==> Done"
ls -lh "$RELEASE_FILE"
