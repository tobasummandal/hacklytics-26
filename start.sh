#!/bin/bash

echo "Starting Pure Imagination..."

if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo "Please edit .env and add your OPENAI_API_KEY"
    exit 1
fi

echo "Starting services with Docker Compose..."
docker-compose up --build
