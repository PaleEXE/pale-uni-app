import logging
from typing import List, Tuple
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
import numpy as np

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
    algorithm: str
    points: List[Tuple[float, float]]
    k: int = 1
    eps: float = 0.5
    minSamples: int = 5


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
    logger.info("Clustering: %s for %d points", inp.algorithm, len(inp.points))

    try:
        points = np.array(inp.points)  

        if len(points) == 0:
            raise HTTPException(status_code=400, detail="No points provided.")

        if inp.algorithm == "kmeans":
            if inp.k <= 0:
                raise HTTPException(
                    status_code=400, detail="k must be a positive integer."
                )

            model = KMeans(n_clusters=inp.k, n_init="auto")
            model.fit(points)
            centroids = model.cluster_centers_.tolist()
            labels = model.labels_.tolist()

        elif inp.algorithm == "Agglomerative":
            if inp.k <= 0:
                raise HTTPException(
                    status_code=400, detail="k must be a positive integer."
                )

            model = AgglomerativeClustering(n_clusters=inp.k)
            labels = model.fit_predict(points).tolist()
            # Calculate centroids manually for AgglomerativeClustering
            centroids = []
            for cluster_id in set(labels):
                cluster_points = points[np.array(labels) == cluster_id]
                centroids.append(cluster_points.mean(axis=0).tolist())

        elif inp.algorithm == "DBSCAN":
            model = DBSCAN(eps=inp.eps, min_samples=inp.minSamples)
            labels = model.fit_predict(points).tolist()
            centroids = []

        else:
            raise HTTPException(
                status_code=400,
                detail="Invalid clustering algorithm specified. Choose from: kmeans, Agglomerative, DBSCAN",
            )

        return {
            "labels": labels,
            "centroids": centroids,
            "algorithm": inp.algorithm,
        }

    except Exception as e:
        logger.error(f"Clustering error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Clustering failed: {str(e)}")


app.mount("/", StaticFiles(directory="dist/browser", html=True), name="static")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
