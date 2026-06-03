#!/usr/bin/env bash
# Build and publish a new release to GitHub.
#
# Usage: ./scripts/release.sh 1.2.0
#
# Requirements:
#   - gh CLI installed and authenticated
#   - You have push access to the repo
#   - The repo on GitHub is rommel-exe/free-music-player
#
# What it does:
#   1. Bumps version in package.json
#   2. Builds for macOS, Windows, Linux
#   3. Creates a draft GitHub release and uploads all artifacts
#
# The auto-updater picks up new releases from GitHub's release feed automatically.

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 1.2.0"
  exit 1
fi

VERSION="$1"
TAG="v$VERSION"

# Make sure version looks like semver
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-z0-9.]+)?$ ]]; then
  echo "Error: Version must be in semver format (e.g. 1.2.0 or 1.2.0-beta.1)"
  exit 1
fi

# Make sure we're on main and clean
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ] && [ "$BRANCH" != "master" ]; then
  echo "Warning: Not on main/master branch (currently on $BRANCH). Continue? (y/n)"
  read -r CONT
  if [ "$CONT" != "y" ]; then exit 1; fi
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Error: Working tree is dirty. Commit or stash changes first."
  git status --short
  exit 1
fi

# Bump version
echo "→ Bumping version to $VERSION in package.json"
npm version "$VERSION" --no-git-tag-version

# Commit version bump
git add package.json package-lock.json 2>/dev/null || true
git commit -m "chore: bump version to $VERSION" || true

# Build
echo "→ Building for macOS, Windows, Linux..."
npm run electron:build -- --publish never

# Create the release and upload artifacts
echo "→ Creating GitHub release $TAG..."
gh release create "$TAG" \
  --title "Free Music Player $VERSION" \
  --generate-notes \
  --draft \
  release/*.dmg \
  release/*.zip \
  release/*.exe \
  release/*.AppImage \
  release/*.deb \
  release/latest*.yml \
  release/latest*.yaml 2>/dev/null || \
gh release create "$TAG" \
  --title "Free Music Player $VERSION" \
  --generate-notes \
  --draft \
  release/*.dmg \
  release/*.zip \
  release/*.exe \
  release/*.AppImage \
  release/*.deb \
  release/latest*.yml \
  release/latest*.yaml

echo ""
echo "✓ Draft release $TAG created."
echo ""
echo "Next steps:"
echo "  1. Edit the release notes: gh release edit $TAG"
echo "  2. Push the tag:           git push origin $TAG"
echo "  3. Publish the release:    gh release edit $TAG --draft=false"
echo ""
echo "Once published, all installed apps will get the update within 5 seconds of starting."
