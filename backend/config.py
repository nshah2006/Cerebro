from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

# Load .env from backend dir so it works from any cwd
_backend_dir = Path(__file__).resolve().parent
load_dotenv(_backend_dir / ".env", override=True)

# ---------------------------------------------------------------------------
# MongoDB
# ---------------------------------------------------------------------------
MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "hackai")

_motor_client: AsyncIOMotorClient | None = None


def get_motor_client() -> AsyncIOMotorClient:
    global _motor_client
    if _motor_client is None:
        # Use certifi's CA bundle for Atlas (mongodb+srv) to fix SSL handshake on macOS/Anaconda
        if "mongodb.net" in MONGODB_URI or MONGODB_URI.strip().startswith("mongodb+srv"):
            import certifi
            _motor_client = AsyncIOMotorClient(
                MONGODB_URI,
                tlsCAFile=certifi.where(),
                serverSelectionTimeoutMS=10000,
            )
        else:
            _motor_client = AsyncIOMotorClient(MONGODB_URI)
    return _motor_client


def get_database() -> AsyncIOMotorDatabase:
    return get_motor_client()[MONGODB_DB_NAME]


async def close_mongo_connection() -> None:
    global _motor_client
    if _motor_client is not None:
        _motor_client.close()
        _motor_client = None


# ---------------------------------------------------------------------------
# Gemini AI  (placeholder – fill in .env when ready)
# ---------------------------------------------------------------------------
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-pro")

# ---------------------------------------------------------------------------
# Solana  (placeholder – fill in .env when ready)
# ---------------------------------------------------------------------------
SOLANA_RPC_URL: str = os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com")
SOLANA_PRIVATE_KEY: str = os.getenv("SOLANA_PRIVATE_KEY", "")
