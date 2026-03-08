"""
Gemini-powered question generation for game-based learning.
Uses prompt engineering to generate MCQs by topic and simpler follow-ups on wrong answers.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from config import GEMINI_API_KEY, GEMINI_MODEL

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt engineering
# ---------------------------------------------------------------------------

MAIN_QUESTION_SYSTEM = """You are a quiz generator for a game-based learning app. Generate exactly one multiple-choice question.
Output ONLY valid JSON with this exact structure (no markdown, no code fence):
{"question_text": "...", "options": [{"id": "a", "text": "..."}, {"id": "b", "text": "..."}, {"id": "c", "text": "..."}, {"id": "d", "text": "..."}], "correct_id": "a", "difficulty": "medium", "explanation": "1-2 sentence explanation of why the correct answer is correct."}
Rules: Use exactly 4 options. correct_id must be one of "a","b","c","d". difficulty is "easy", "medium", or "hard". explanation must clearly explain WHY the correct answer is right. Keep question_text and option text concise and clear. Do NOT repeat or rephrase any question that appears in the "Do not repeat" list below."""

ADAPTIVE_QUESTION_SYSTEM = """You are a quiz generator for a game-based learning app. You adapt to the user's learning history.
Output ONLY valid JSON with this exact structure (no markdown, no code fence):
{"question_text": "...", "options": [{"id": "a", "text": "..."}, {"id": "b", "text": "..."}, {"id": "c", "text": "..."}, {"id": "d", "text": "..."}], "correct_id": "a", "difficulty": "easy|medium|hard", "explanation": "1-2 sentence explanation of why the correct answer is correct."}
Rules:
- Use exactly 4 options. correct_id must be one of "a","b","c","d".
- Match the requested difficulty (easier after wrong answers, harder after correct ones).
- Do NOT repeat or rephrase any question listed in "Do not repeat these questions" — generate a new, different question.
- Use the user's learning history to pick topics they need more practice on, or to avoid over-testing what they already know.
- Keep question_text and option text concise."""

FOLLOW_UP_SYSTEM = """You are a quiz generator. The user just answered the previous question incorrectly. Generate a SIMPLER follow-up question on the same topic to help them learn.
Output ONLY valid JSON with this exact structure (no markdown, no code fence):
{"question_text": "...", "options": [{"id": "a", "text": "..."}, {"id": "b", "text": "..."}, {"id": "c", "text": "..."}, {"id": "d", "text": "..."}], "correct_id": "a", "difficulty": "easy", "explanation": "1-2 sentence explanation of why the correct answer is correct."}
Rules: Use exactly 4 options. correct_id must be one of "a","b","c","d". difficulty must be "easy". explanation must clearly explain WHY the correct answer is right. Keep the question and options short."""


def _build_topics_prompt(topics: list[str]) -> str:
    if not topics:
        return "Topics: General knowledge."
    return "Topics to draw from: " + ", ".join(topics) + "."


def _parse_json_from_text(text: str) -> dict[str, Any] | None:
    """Extract JSON object from model output (may be wrapped in markdown)."""
    if not text or not text.strip():
        return None
    text = text.strip()
    # Remove markdown code block if present
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        text = match.group(1).strip()
    # Find first { ... }
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    end = -1
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end == -1:
        return None
    try:
        return json.loads(text[start:end])
    except json.JSONDecodeError:
        return None


def _call_gemini(prompt: str, system_instruction: str) -> str | None:
    """Call Gemini API (sync). Returns response text or None on failure."""
    if not GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not set; question generation disabled.")
        return None
    try:
        from google import genai
        client = genai.Client(api_key=GEMINI_API_KEY)
        full_prompt = f"{system_instruction}\n\n{prompt}"
        response = client.models.generate_content(
            model=GEMINI_MODEL or "gemini-2.0-flash",
            contents=full_prompt,
        )
        if response and getattr(response, "text", None):
            return response.text.strip()
        return None
    except Exception as e:
        logger.exception("Gemini API error: %s", e)
        return None


def generate_question(topics: list[str], difficulty: str = "medium") -> dict[str, Any] | None:
    """
    Generate one MCQ based on the given topics.
    Returns dict with question_text, options (list of {id, text}), correct_id, difficulty,
    or None if API fails / key missing.
    """
    prompt = _build_topics_prompt(topics) + f"\nDifficulty: {difficulty}.\nGenerate one question."
    text = _call_gemini(prompt, MAIN_QUESTION_SYSTEM)
    if not text:
        return None
    data = _parse_json_from_text(text)
    if not data:
        return None
    # Normalize to our shape
    options = data.get("options") or []
    correct_id = (data.get("correct_id") or "a").lower()
    if correct_id not in ("a", "b", "c", "d"):
        correct_id = "a"
    return {
        "question_text": data.get("question_text") or "No question generated.",
        "options": [{"id": str(o.get("id", chr(97 + i))).lower()[:1], "text": str(o.get("text", ""))} for i, o in enumerate(options[:4])],
        "correct_id": correct_id,
        "difficulty": data.get("difficulty") or difficulty,
        "explanation": data.get("explanation") or "",
    }


def generate_question_adaptive(
    topics: list[str],
    difficulty: str,
    history_summary: str,
    exclude_questions: list[str],
) -> dict[str, Any] | None:
    """
    Generate one MCQ adapted to user's learning history: no repeats, difficulty from history.
    """
    prompt = _build_topics_prompt(topics)
    prompt += f"\nRequested difficulty (based on their last answer): {difficulty}."
    prompt += f"\n\nUser learning context:\n{history_summary}"
    if exclude_questions:
        prompt += "\n\nDo not repeat these questions (generate something different):\n"
        for q in exclude_questions[:20]:
            if q:
                prompt += f"- {q[:120]}\n"
    prompt += "\nGenerate one new question."
    text = _call_gemini(prompt, ADAPTIVE_QUESTION_SYSTEM)
    if not text:
        return None
    data = _parse_json_from_text(text)
    if not data:
        return None
    options = data.get("options") or []
    correct_id = (data.get("correct_id") or "a").lower()
    if correct_id not in ("a", "b", "c", "d"):
        correct_id = "a"
    return {
        "question_text": data.get("question_text") or "No question generated.",
        "options": [{"id": str(o.get("id", chr(97 + i))).lower()[:1], "text": str(o.get("text", ""))} for i, o in enumerate(options[:4])],
        "correct_id": correct_id,
        "difficulty": data.get("difficulty") or difficulty,
        "explanation": data.get("explanation") or "",
    }


def generate_follow_up_question(topics: list[str], previous_question: str) -> dict[str, Any] | None:
    """
    Generate a simpler follow-up question after the user answered incorrectly.
    """
    prompt = _build_topics_prompt(topics) + f"\nPrevious question (user got it wrong): {previous_question}\nGenerate a simpler follow-up."
    text = _call_gemini(prompt, FOLLOW_UP_SYSTEM)
    if not text:
        return None
    data = _parse_json_from_text(text)
    if not data:
        return None
    options = data.get("options") or []
    correct_id = (data.get("correct_id") or "a").lower()
    if correct_id not in ("a", "b", "c", "d"):
        correct_id = "a"
    return {
        "question_text": data.get("question_text") or "No follow-up generated.",
        "options": [{"id": str(o.get("id", chr(97 + i))).lower()[:1], "text": str(o.get("text", ""))} for i, o in enumerate(options[:4])],
        "correct_id": correct_id,
        "difficulty": "easy",
        "explanation": data.get("explanation") or "",
    }
