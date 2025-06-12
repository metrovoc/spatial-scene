from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import io
import base64
from depth_estimation import depth_estimator

app = FastAPI()

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.post("/process-image")
async def process_image(file: UploadFile = File(...)):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))
    
    depth_map_image = depth_estimator.estimate_depth(image)
    
    buffered = io.BytesIO()
    depth_map_image.save(buffered, format="PNG")
    depth_map_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
    
    return {
        "depth_map": f"data:image/png;base64,{depth_map_base64}"
    } 