#!/bin/bash

# Deploy script for datenightbingo.com
# This script rebuilds and redeploys the Docker container

set -e  # Exit on any error

CONTAINER_NAME="datenightbingo-site"
IMAGE_NAME="datenightbingo"
PORT_MAPPING="3000:3000"

echo "========================================="
echo "Deploying datenightbingo.com"
echo "========================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed!"
    echo "Install with: sudo apt install docker.io"
    exit 1
fi

# Stop existing container if running
echo "Stopping existing container..."
if sudo docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
    sudo docker stop $CONTAINER_NAME
    echo "Container stopped."
else
    echo "No running container found."
fi

# Remove existing container if exists
echo "Removing old container..."
if sudo docker ps -aq -f name=$CONTAINER_NAME | grep -q .; then
    sudo docker rm $CONTAINER_NAME
    echo "Container removed."
fi

# Build new image
echo "Building Docker image..."
sudo docker build -t $IMAGE_NAME .

# Run new container with volume for persistent saves
echo "Starting new container..."
sudo docker run -d \
    -p $PORT_MAPPING \
    --name $CONTAINER_NAME \
    --restart unless-stopped \
    -v datenightbingo-saves:/app/saves \
    $IMAGE_NAME

# Check if container is running
if sudo docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
    echo "========================================="
    echo "Deployment successful!"
    echo "Container: $CONTAINER_NAME"
    echo "Status: Running"
    echo "Port: 3000"
    echo "========================================="

    # Show container logs
    echo ""
    echo "Container logs:"
    sudo docker logs $CONTAINER_NAME
else
    echo "ERROR: Container failed to start!"
    echo "Check logs with: sudo docker logs $CONTAINER_NAME"
    exit 1
fi

echo ""
echo "========================================="
echo "NEXT STEPS:"
echo "========================================="
echo "1. Update cloudflared config to add datenightbingo.com routing"
echo "2. Restart cloudflared service"
echo ""
echo "See README.md for detailed instructions."
echo "========================================="
