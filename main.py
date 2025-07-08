import logging
from typing import List, Tuple
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sklearn.cluster import KMeans

from PLogic import PExp

logging.basicConfig(
    level=logging.DEBUG, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExpressionRequest(BaseModel):
    expression: str


class ClusterRequest(BaseModel):
    points: List[Tuple[float, float]]
    k: int


@app.post("/evaluate")
async def evaluate(inp: ExpressionRequest):
    try:
        exp0 = PExp(inp.expression).solve()
        response = {
            "headers": exp0.df.columns.to_list(),
            "data": exp0.df.values.tolist(),
        }

        logger.info("Evaluated: %s", inp.expression)
        return response

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/cluster")
async def cluster(inp: ClusterRequest):
    points = inp.points  # List of (x, y) tuples

    if not points:
        return {"error": "No points provided."}

    model = KMeans(n_clusters=inp.k, n_init="auto")
    model.fit(points)

    labels = model.labels_.tolist()
    centroids = model.cluster_centers_.tolist()

    return {"labels": labels, "centroids": centroids}


app.mount("/", StaticFiles(directory="dist/browser", html=True), name="static")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
