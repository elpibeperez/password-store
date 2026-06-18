#!/usr/bin/env bash
set -e

NAME="password-store"
VERSION="0.1.0"
ARCH="amd64"
DESCRIPTION="Electron frontend for pass (password-store)"
MAINTAINER="password-store <pass@local>"

cd "$(dirname "$0")/.."
ROOT="$PWD"
BUILD_DIR="$ROOT/build-deb"
DEB_DIR="${BUILD_DIR}/${NAME}_${VERSION}_${ARCH}"
ELECTRON_SRC="$ROOT/node_modules/electron/dist"

echo "==> Cleaning build directory"
rm -rf "$BUILD_DIR"

echo "==> Building app"
npm run build

echo "==> Setting up package structure"
mkdir -p "$DEB_DIR/DEBIAN"
mkdir -p "$DEB_DIR/usr/share/$NAME"
mkdir -p "$DEB_DIR/usr/share/applications"
mkdir -p "$DEB_DIR/usr/share/icons/hicolor/512x512/apps"
mkdir -p "$DEB_DIR/usr/bin"

echo "==> Copying Electron"
cp -r "$ELECTRON_SRC"/* "$DEB_DIR/usr/share/$NAME/"
rm -f "$DEB_DIR/usr/share/$NAME/resources/default_app.asar"

echo "==> Installing production dependencies"
mkdir -p "$DEB_DIR/usr/share/$NAME/resources/app"
cp -r out/ "$DEB_DIR/usr/share/$NAME/resources/app/out"
cp package.json "$DEB_DIR/usr/share/$NAME/resources/app/"
cd "$DEB_DIR/usr/share/$NAME/resources/app"
npm install --omit=dev --no-audit --no-fund 2>&1 | tail -3
cd "$ROOT"

echo "==> Creating launcher script"
cat > "$DEB_DIR/usr/share/$NAME/launcher.sh" << 'SCRIPT'
#!/bin/bash
DIR="$(dirname "$(readlink -f "$0")")"
exec "$DIR/electron" "$DIR/resources/app" "$@"
SCRIPT
chmod +x "$DEB_DIR/usr/share/$NAME/launcher.sh"

echo "==> Creating symlink"
ln -sf "/usr/share/$NAME/launcher.sh" "$DEB_DIR/usr/bin/$NAME"

echo "==> Creating desktop entry"
cat > "$DEB_DIR/usr/share/applications/${NAME}.desktop" << DESKTOP
[Desktop Entry]
Name=password-store
Comment=$DESCRIPTION
Exec=$NAME %U
Icon=$NAME
Terminal=false
Type=Application
Categories=Utility;
StartupWMClass=password-store
DESKTOP

echo "==> Copying icon"
cp build/icon.png "$DEB_DIR/usr/share/icons/hicolor/512x512/apps/${NAME}.png"

echo "==> Creating control file"
cat > "$DEB_DIR/DEBIAN/control" << CONTROL
Package: $NAME
Version: $VERSION
Architecture: $ARCH
Maintainer: $MAINTAINER
Depends:
Description: $DESCRIPTION
 Desktop and mobile client for password-store (pass).
 Compatible with pass (password-store) and GPG.
 Cross-platform, works with any git-synced password store.
CONTROL

echo "==> Creating postinst script"
cat > "$DEB_DIR/DEBIAN/postinst" << POSTINST
#!/bin/bash
set -e
# Fix chrome-sandbox permissions
chown root:root /usr/share/$NAME/chrome-sandbox 2>/dev/null || true
chmod 4755 /usr/share/$NAME/chrome-sandbox 2>/dev/null || true
# Update desktop database
update-desktop-database 2>/dev/null || true
update-icon-caches /usr/share/icons/hicolor/ 2>/dev/null || true
POSTINST
chmod 755 "$DEB_DIR/DEBIAN/postinst"

echo "==> Building .deb"
mkdir -p "$ROOT/release"
fakeroot dpkg-deb --build "$DEB_DIR" "$ROOT/release/${NAME}_${VERSION}_${ARCH}.deb"

echo "==> Done"
ls -lh "$ROOT/release/${NAME}_${VERSION}_${ARCH}.deb"
