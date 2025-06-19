# Spatial Scene

A web application for processing images into 3D spatial scenes using depth estimation and inpainting techniques.

## Features

- **Depth Estimation**: Generate depth maps from 2D images
- **Image Inpainting**: Fill gaps and enhance images using AI models
- **3D Visualization**: Render layered depth images (LDI) with parallax effects
- **Gallery Management**: Save and manage processed scenes
- **Cross-platform**: Web-based interface with mobile support

## Tech Stack

### Backend

- FastAPI for REST API
- PyTorch for AI models
- Transformers for depth estimation
- OpenCV for image processing

### Frontend

- React 18 with TypeScript
- Three.js with React Three Fiber
- Vite for development
- TailwindCSS for styling

## Quick Start

### Prerequisites

- Python 3.8+
- Node.js 18+
- Modern web browser

### Setup

1. **Backend Setup**

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

2. **Frontend Setup**

```bash
cd frontend
npm install
npm run dev
```

3. **Access Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000

## Usage

1. Upload an image through the web interface
2. The system will automatically:
   - Generate a depth map
   - Create an inpainted version
   - Render as 3D layered scene
3. Interact with the 3D scene using mouse/touch
4. Save scenes to gallery for later viewing

## Development

Use the provided scripts for easy development:

- `./start-dev.sh` (Unix/Mac)
- `start-dev.bat` (Windows)

## License

MIT License
