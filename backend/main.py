import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import close_mongo_connection, get_database
from models.schemas import HealthResponse
from routes.auth import router as auth_router
from routes.skills import router as skills_router
from routes.questions import router as questions_router
from routes.games import router as games_router
from routes.leaderboard import router as leaderboard_router
from routes.analysis import router as analysis_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    try:
        db = get_database()
        await db.command("ping")
        logger.info("MongoDB connection OK")
    except Exception as e:
        logger.warning(
            "MongoDB not available at startup: %s. App will run; DB-dependent routes may fail. "
            "To run without MongoDB, set MONGODB_URI= in backend/.env",
            e,
        )
    yield
    try:
        await close_mongo_connection()
    except Exception:
        pass


app = FastAPI(
    title="HackAI Backend",
    version="0.1.0",
    lifespan=lifespan,
)

# -- CORS – allow local frontend dev servers ----------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -- Routes -------------------------------------------------------------------
app.include_router(auth_router)
app.include_router(skills_router)
app.include_router(questions_router)
app.include_router(games_router)
app.include_router(leaderboard_router)
app.include_router(analysis_router)


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse()


@app.get("/health/db")
async def health_db():
    """Check if MongoDB is reachable. Returns 200 if connected, 503 otherwise."""
    try:
        db = get_database()
        await db.command("ping")
        return {"status": "ok", "mongodb": "connected"}
    except Exception as e:
        logger.warning("MongoDB health check failed: %s", e)
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=503,
            content={"status": "error", "mongodb": "disconnected", "detail": str(e)},
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
