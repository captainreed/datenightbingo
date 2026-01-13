#!/bin/bash

# Start script for datenightbingo.com
# Starts the Docker container (builds if image doesn't exist)

CONTAINER_NAME="datenightbingo-site"
IMAGE_NAME="datenightbingo"

echo "Starting datenightbingo..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed!"
    exit 1
fi

# Check if container is already running
if sudo docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
    echo "Container is already running."
    sudo docker ps -f name=$CONTAINER_NAME
    exit 0
fi

# Check if container exists but is stopped
if sudo docker ps -aq -f name=$CONTAINER_NAME | grep -q .; then
    echo "Starting existing container..."
    sudo docker start $CONTAINER_NAME
else
    # Check if image exists
    if ! sudo docker images -q $IMAGE_NAME | grep -q .; then
        echo "Image not found. Building first..."
        sudo docker build -t $IMAGE_NAME .
    fi

    # Run new container
    echo "Creating and starting container..."
    sudo docker run -d \
        -p 3000:3000 \
        --name $CONTAINER_NAME \
        --restart unless-stopped \
        -v datenightbingo-saves:/app/saves \
        $IMAGE_NAME
fi

# Verify container is running
if sudo docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
    echo ""
    echo "✓ datenightbingo is running on port 3000"
    echo "  Local:   http://localhost:3000"
    echo "  Public:  https://datenightbingo.com"
else
    echo "ERROR: Failed to start container!"
    exit 1
fi
