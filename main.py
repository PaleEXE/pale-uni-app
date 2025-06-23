import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

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


app.mount("/", StaticFiles(directory="dist/browser", html=True), name="static")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
