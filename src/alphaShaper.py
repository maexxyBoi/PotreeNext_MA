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
    }

    proc = subprocess.Popen(
        [ALPHA_EXE_PATH],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    out, err = proc.communicate(json.dumps(payload))

    if proc.returncode != 0:
        return {"error": err}

    return json.loads(out)
