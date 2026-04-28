from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import subprocess, json, os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Point3D(BaseModel):
    x: float
    y: float
    z: float

class HullRequest(BaseModel):
    points: List[Point3D]
    alpha: float
    surface: bool

ALPHA_ADVFRONTSURFACE_EXE_PATH = os.path.join(
    os.path.dirname(__file__),
    "CAlphaShapes",
    "build",
    "Release",
	"alphaShaperRetroFit.exe",
    #"alphaShaper.exe",
)
ALPHA_EXE_PATH = os.path.join(
    os.path.dirname(__file__),
    "CAlphaShapes",
    "build",
    "Release",
    "alphaShaper.exe",
)

@app.post("/alpha3d_cgal")
def alpha3d_cgal(req: HullRequest):
    payload = {
        "points": [p.model_dump() for p in req.points],
        "alpha": req.alpha,
		"surface": req.surface,
    }

	#Reintroduce this path if you want advancing front surface reconstruction by CGAL.
    #print(ALPHA_EXE_PATH if not req.surface else ALPHA_ADVFRONTSURFACE_EXE_PATH)

    proc = subprocess.Popen(
		[ALPHA_EXE_PATH],
        #[ALPHA_EXE_PATH if not req.surface else ALPHA_ADVFRONTSURFACE_EXE_PATH],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    out, err = proc.communicate(json.dumps(payload))

    if proc.returncode != 0:
        return {"error": err}

    return json.loads(out)
