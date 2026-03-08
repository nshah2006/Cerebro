from __future__ import annotations

import uuid
from fastapi import APIRouter, HTTPException, Query
from models.schemas import (
    AnswerSubmitRequest,
    AnswerSubmitResponse,
    QuestionOption,
    QuestionResponse,
)
from services.gemini_service import generate_question, generate_follow_up_question

router = APIRouter(prefix="/questions", tags=["questions"])

# In-memory store: question_id -> { correct_id, question_text, options, topics }
_question_store: dict[str, dict] = {}


def _topics_from_query(topics: str | None) -> list[str]:
    if not topics or not topics.strip():
        return []
    return [t.strip() for t in topics.split(",") if t.strip()]


@router.get("/next", response_model=QuestionResponse)
async def next_question(
    topics: str | None = Query(None, description="Comma-separated topics (e.g. Strategy, Technology)"),
    difficulty: str = Query("medium", description="easy | medium | hard"),
) -> QuestionResponse:
    topic_list = _topics_from_query(topics)
    data = generate_question(topic_list, difficulty=difficulty)
    if not data:
        # Fallback stub when Gemini unavailable
        return QuestionResponse(
            question_id="fallback-1",
            question_text="What is the time complexity of binary search?",
            options=[
                QuestionOption(id="a", text="O(n)"),
                QuestionOption(id="b", text="O(log n)"),
                QuestionOption(id="c", text="O(n log n)"),
                QuestionOption(id="d", text="O(1)"),
            ],
            difficulty="medium",
        )
    question_id = f"q-{uuid.uuid4().hex[:12]}"
    _question_store[question_id] = {
        "correct_id": data["correct_id"],
        "question_text": data["question_text"],
        "options": data["options"],
        "topics": topic_list,
    }
    return QuestionResponse(
        question_id=question_id,
        question_text=data["question_text"],
        options=[QuestionOption(id=o["id"], text=o["text"]) for o in data["options"]],
        difficulty=data.get("difficulty") or difficulty,
    )


@router.post("/submit", response_model=AnswerSubmitResponse)
async def submit_answer(body: AnswerSubmitRequest) -> AnswerSubmitResponse:
    stored = _question_store.get(body.question_id)
    if not stored:
        raise HTTPException(status_code=404, detail="Question not found or expired")
    correct_id = stored["correct_id"]
    correct = body.selected_option_id.strip().lower() == correct_id
    explanation = "That's correct." if correct else "That's not quite right."
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
            }
            follow_up = QuestionResponse(
                question_id=fu_id,
                question_text=fu["question_text"],
                options=[QuestionOption(id=o["id"], text=o["text"]) for o in fu["options"]],
                difficulty="easy",
            )
    return AnswerSubmitResponse(
        correct=correct,
        correct_option_id=correct_id,
        explanation=explanation,
        score_delta=10 if correct else 0,
        follow_up_question=follow_up,
    )
