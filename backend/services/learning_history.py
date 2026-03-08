"""
Learning history stored in MongoDB for adaptive question generation.
Each document: user_id, question_text, topics, difficulty, correct, timestamp.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from config import get_database

COLLECTION = "learning_history"
MAX_HISTORY = 50  # last N entries to send to AI


async def save_answer(
    user_id: str,
    question_text: str,
    topics: list[str],
    difficulty: str,
    correct: bool,
) -> None:
    try:
        db = get_database()
        await db[COLLECTION].insert_one({
            "user_id": user_id,
            "question_text": question_text,
            "topics": topics,
            "difficulty": difficulty,
            "correct": correct,
            "timestamp": datetime.utcnow(),
        })
    except Exception:
        pass  # don't fail the request if DB is down


async def get_history(user_id: str, limit: int = MAX_HISTORY) -> list[dict[str, Any]]:
    try:
        db = get_database()
        cursor = db[COLLECTION].find(
            {"user_id": user_id},
            sort=[("timestamp", -1)],
            limit=limit,
            projection={"question_text": 1, "topics": 1, "difficulty": 1, "correct": 1, "timestamp": 1},
        )
        return await cursor.to_list(length=limit)
    except Exception:
        return []


def compute_next_difficulty(history: list[dict[str, Any]], default: str = "medium") -> str:
    """If last answer was correct -> harder; if wrong -> easier."""
    if not history:
        return default
    last = history[0]
    last_difficulty = (last.get("difficulty") or default).lower()
    correct = last.get("correct", False)
    order = ["easy", "medium", "hard"]
    try:
        idx = order.index(last_difficulty)
    except ValueError:
        idx = 1
    if correct:
        idx = min(idx + 1, 2)
    else:
        idx = max(idx - 1, 0)
    return order[idx]


def build_history_summary(history: list[dict[str, Any]]) -> str:
    """Short summary for the AI prompt."""
    if not history:
        return "This is the user's first question. Use medium difficulty."
    lines = []
    for i, h in enumerate(history[:15]):
        q = (h.get("question_text") or "")[:80]
        d = h.get("difficulty", "?")
        c = "correct" if h.get("correct") else "wrong"
        lines.append(f"- {q}... (difficulty: {d}, {c})")
    return "Recent history (newest first):\n" + "\n".join(lines)


def get_exclude_questions(history: list[dict[str, Any]]) -> list[str]:
    """Question texts to avoid repeating."""
    return [h.get("question_text", "").strip() for h in history if h.get("question_text")]
