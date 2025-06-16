# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
总是使用中文思考和回答
积极使用 git 管理版本

## Development Commands

### Starting Development Environment

- `./start-dev.sh` - Starts both backend and frontend services concurrently
- Backend runs on http://127.0.0.1:8000 (FastAPI with hot reload)
- Frontend runs on Vite dev server (typically http://localhost:5173)

### Backend (Python FastAPI)

- `cd backend && source .venv/bin/activate` - Activate Python virtual environment
- `uvicorn main:app --reload` - Start backend server with hot reload
- Dependencies in `requirements.txt` include PyTorch, transformers, FastAPI, OpenCV

### Frontend (React + TypeScript + Vite)

- `cd frontend && npm run dev` - Start development server
- `npm run build` - Build for production (runs TypeScript check + Vite build)
- `npm run lint` - Run ESLint

## Architecture Overview

This is a spatial scene processing application that creates 3D layered depth image (LDI) representations from 2D images.

### Core Pipeline

1. **Image Upload** → FastAPI backend `/process-image` endpoint
2. **Depth Estimation** → Uses Depth-Anything-V2-Large-hf model via transformers
3. **Image Inpainting** → Uses LaMa model for filling gaps/holes in images
4. **3D Rendering** → React Three Fiber renders layered depth images with gyroscope control

### Key Components

**Backend (`backend/`)**

- `main.py` - FastAPI app with CORS, image processing endpoints, gallery management
- `depth_estimation.py` - Depth-Anything-V2 model wrapper for depth map generation
- `inpainting.py` - LaMa model integration for image inpainting
- `lama/` - Custom LaMa model implementation
- `models/big-lama/` - Pre-trained LaMa model files
- `gallery/` - JSON storage for saved scenes

**Frontend (`frontend/src/`)**

- `App.tsx` - Main application with image upload, 3D canvas, gyroscope controls
- `components/AdvancedLDIRenderer.tsx` - Three.js layered depth image renderer with adaptive layers
- `components/Gallery.tsx` - Scene gallery for saving/loading/deleting processed images
- Uses React Three Fiber (@react-three/fiber) + Drei (@react-three/drei) for 3D rendering
- Gyroscope integration for mobile device orientation control
- Tailwind CSS for styling

### Data Flow

- Images processed to generate: original, depth map, inpainted image, inpainted depth map
- Results encoded as base64 and sent to frontend
- Frontend creates layered 3D geometry using depth information
- Gallery system saves complete scene data as JSON files

### Device Features

- Gyroscope support for mobile devices with permission handling
- Fullscreen mode support
- Responsive design for mobile and desktop
