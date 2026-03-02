from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from descartes import PolygonPatch
from pydantic import BaseModel
from typing import List

import pandas as pd
import matplotlib.pyplot as plt
import alphashape
import numpy as np

app = FastAPI()

origins = [
    "http://127.0.0.1:8081",
    "http://localhost:8081",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

"""class Point3D(BaseModel):
    x: float
    y: float
    z: float
"""
class HullRequest(BaseModel):
    points: List[List[float]]
    alpha: float | None = None


@app.post("/alpha3d")
def alpha3d(req: HullRequest):
	print(req)
	#alpha_shape = alphashape.alphashape(req.points, req.alpha)
	#alpha_shape.show()
	#pts = np.array([[p.x, p.y, p.z] for p in req.points])
	#hull = alphashape.alphashape(pts, req.alpha)
    # TODO: convert hull to vertices/faces
	return {}