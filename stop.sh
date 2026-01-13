#!/bin/bash

# Stop script for datenightbingo.com
# Stops the Docker container

CONTAINER_NAME="datenightbingo-site"

echo "Stopping datenightbingo..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed!"
    exit 1
fi

# Check if container is running
if sudo docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
    sudo docker stop $CONTAINER_NAME
    echo "✓ Container stopped."
else
    echo "Container is not running."
fi

# Show status
echo ""
echo "Current status:"
if sudo docker ps -aq -f name=$CONTAINER_NAME | grep -q .; then
    sudo docker ps -a -f name=$CONTAINER_NAME
else
    echo "  No container found."
fi
