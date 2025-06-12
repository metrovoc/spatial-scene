from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import io
import base64
from depth_estimation import depth_estimator
from inpainting import inpainter

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
    
    # 1. Estimate Depth
    depth_map_image = depth_estimator.estimate_depth(image)
    
    # 2. Inpaint Image (and depth map)
    inpainted_image, inpainted_depth_map = inpainter.inpaint_image(image, depth_map_image)

    # 3. Encode all images to Base64
    def image_to_base64(img: Image.Image) -> str:
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        encoded = base64.b64encode(buffered.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{encoded}"

    original_base64 = image_to_base64(image.convert("RGB"))
    depth_map_base64 = image_to_base64(inpainted_depth_map)
    inpainted_base64 = image_to_base64(inpainted_image)

    return {
        "original_image": original_base64,
        "depth_map": depth_map_base64,
        "inpainted_image": inpainted_base64
    } 