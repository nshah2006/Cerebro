from __future__ import annotations

import random
import uuid
from fastapi import APIRouter, HTTPException, Query
from models.schemas import (
    AnswerSubmitRequest,
    AnswerSubmitResponse,
    QuestionOption,
    QuestionResponse,
)
from services.gemini_service import generate_question, generate_question_adaptive, generate_follow_up_question
from services.learning_history import (
    get_history,
    save_answer,
    compute_next_difficulty,
    build_history_summary,
    get_exclude_questions,
)

router = APIRouter(prefix="/questions", tags=["questions"])

# In-memory store: question_id -> { correct_id, question_text, options, topics, difficulty, explanation }
_question_store: dict[str, dict] = {}


def _topics_from_query(topics: str | None) -> list[str]:
    if not topics or not topics.strip():
        return []
    return [t.strip() for t in topics.split(",") if t.strip()]


# Fallbacks when Gemini is unavailable (variety instead of one repeated question)
_FALLBACKS = [
    {
        "question_text": "What is the time complexity of binary search?",
        "options": [("a", "O(n)"), ("b", "O(log n)"), ("c", "O(n log n)"), ("d", "O(1)")],
        "correct_id": "b",
    },
    {
        "question_text": "Which data structure uses LIFO (Last In, First Out)?",
        "options": [("a", "Queue"), ("b", "Stack"), ("c", "Array"), ("d", "Linked List")],
        "correct_id": "b",
    },
    {
        "question_text": "What does CPU stand for?",
        "options": [("a", "Central Processing Unit"), ("b", "Computer Personal Unit"), ("c", "Central Program Utility"), ("d", "Core Processing Unit")],
        "correct_id": "a",
    },
    {
        "question_text": "In a REST API, which HTTP method is typically used to create a new resource?",
        "options": [("a", "GET"), ("b", "PUT"), ("c", "POST"), ("d", "DELETE")],
        "correct_id": "c",
    },
    {
        "question_text": "What is the main purpose of a firewall?",
        "options": [("a", "Speed up the network"), ("b", "Monitor and control network traffic"), ("c", "Store backups"), ("d", "Run applications")],
        "correct_id": "b",
    },
]


@router.get("/next", response_model=QuestionResponse)
async def next_question(
    topics: str | None = Query(None, description="Comma-separated topics (e.g. Strategy, Technology)"),
    difficulty: str = Query("medium", description="easy | medium | hard"),
    user_id: str | None = Query(None, description="User ID for adaptive questions and no-repeat; uses history from MongoDB"),
) -> QuestionResponse:
    topic_list = _topics_from_query(topics)
    base_difficulty = difficulty

    if user_id:
        history = await get_history(user_id)
        next_difficulty = compute_next_difficulty(history, default=base_difficulty)
        history_summary = build_history_summary(history)
        exclude = get_exclude_questions(history)
        data = generate_question_adaptive(topic_list, next_difficulty, history_summary, exclude)
    else:
        next_difficulty = base_difficulty
        data = generate_question(topic_list, difficulty=base_difficulty)

    if not data:
        fb = random.choice(_FALLBACKS)
        question_id = f"fallback-{uuid.uuid4().hex[:8]}"
        _question_store[question_id] = {
            "correct_id": fb["correct_id"],
            "question_text": fb["question_text"],
            "options": [{"id": o[0], "text": o[1]} for o in fb["options"]],
            "topics": topic_list,
            "difficulty": "medium",
            "explanation": "",
        }
        return QuestionResponse(
            question_id=question_id,
            question_text=fb["question_text"],
            options=[QuestionOption(id=o[0], text=o[1]) for o in fb["options"]],
            difficulty="medium",
            correct_option_id=fb["correct_id"],
        )
    question_id = f"q-{uuid.uuid4().hex[:12]}"
    _question_store[question_id] = {
        "correct_id": data["correct_id"],
        "question_text": data["question_text"],
        "options": data["options"],
        "topics": topic_list,
        "difficulty": data.get("difficulty") or next_difficulty,
        "explanation": data.get("explanation", ""),
    }
    return QuestionResponse(
        question_id=question_id,
        question_text=data["question_text"],
        options=[QuestionOption(id=o["id"], text=o["text"]) for o in data["options"]],
        difficulty=data.get("difficulty") or next_difficulty,
        correct_option_id=data["correct_id"],
    )


@router.post("/submit", response_model=AnswerSubmitResponse)
async def submit_answer(body: AnswerSubmitRequest) -> AnswerSubmitResponse:
    stored = _question_store.get(body.question_id)
    if not stored:
        raise HTTPException(status_code=404, detail="Question not found or expired")
    correct_id = stored["correct_id"]
    correct = body.selected_option_id.strip().lower() == correct_id
    # Use Gemini-generated explanation, or fall back to generic text
    stored_explanation = stored.get("explanation", "")
    if correct:
        explanation = stored_explanation or "That's correct! Great job."
    else:
        correct_text = next((o["text"] for o in stored.get("options", []) if o["id"] == correct_id), correct_id)
        explanation = stored_explanation or f"The correct answer is: {correct_text}."
    # Save to MongoDB for adaptive learning (no-op if DB unavailable)
    await save_answer(
        body.user_id,
        question_text=stored.get("question_text") or "",
        topics=stored.get("topics") or [],
        difficulty=stored.get("difficulty") or "medium",
        correct=correct,
    )
    follow_up: QuestionResponse | None = None
    if not correct:
        prev_text = stored.get("question_text") or ""
        topic_list = stored.get("topics") or []
        fu = generate_follow_up_question(topic_list, prev_text)
        if fu:
            fu_id = f"q-{uuid.uuid4().hex[:12]}"
            _question_store[fu_id] = {
                "correct_id": fu["correct_id"],
                "question_text": fu["question_text"],
                "options": fu["options"],
                "topics": topic_list,
                "difficulty": "easy",
                "explanation": fu.get("explanation", ""),
            }
            follow_up = QuestionResponse(
                question_id=fu_id,
                question_text=fu["question_text"],
                options=[QuestionOption(id=o["id"], text=o["text"]) for o in fu["options"]],
                difficulty="easy",
                correct_option_id=fu["correct_id"],
            )
    return AnswerSubmitResponse(
        correct=correct,
        correct_option_id=correct_id,
        explanation=explanation,
        score_delta=10 if correct else 0,
        follow_up_question=follow_up,
    )
