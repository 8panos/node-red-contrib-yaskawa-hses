#!/bin/bash

# Installation script for node-red-contrib-yaskawa-hses
# This script installs the Yaskawa HSES nodes to Node-RED

echo "=========================================="
echo "Yaskawa HSES Node Installation"
echo "=========================================="

# Find Node-RED user directory
if [ -z "$NODE_RED_HOME" ]; then
    NODE_RED_HOME="$HOME/.node-red"
fi

echo "Node-RED home directory: $NODE_RED_HOME"

# Check if Node-RED is installed
if [ ! -d "$NODE_RED_HOME" ]; then
    echo "Error: Node-RED directory not found at $NODE_RED_HOME"
    echo "Please install Node-RED first or set NODE_RED_HOME environment variable"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Source directory: $SCRIPT_DIR"

# Create package directory in Node-RED
PACKAGE_DIR="$NODE_RED_HOME/node_modules/node-red-contrib-yaskawa-hses"
echo "Installing to: $PACKAGE_DIR"

# Remove old version if exists
if [ -d "$PACKAGE_DIR" ]; then
    echo "Removing old version..."
    rm -rf "$PACKAGE_DIR"
fi

# Copy files
mkdir -p "$PACKAGE_DIR"
cp -r "$SCRIPT_DIR"/* "$PACKAGE_DIR/"

# Install dependencies
echo "Installing dependencies..."
cd "$PACKAGE_DIR"
npm install

# Link to Node-RED
if [ ! -L "$NODE_RED_HOME/node_modules/node-red-contrib-yaskawa-hses" ]; then
    ln -s "$PACKAGE_DIR" "$NODE_RED_HOME/node_modules/node-red-contrib-yaskawa-hses"
fi

echo ""
echo "=========================================="
echo "Installation Complete!"
echo "=========================================="
echo ""
echo "Please restart Node-RED to load the new nodes:"
echo "  node-red-restart"
echo ""
echo "Or if running manually:"
echo "  Ctrl+C to stop, then 'node-red' to restart"
echo ""
echo "The following nodes are now available:"
echo "  - yaskawa-hses-config (Configuration)"
echo "  - yaskawa-hses (Communication)"
echo ""
