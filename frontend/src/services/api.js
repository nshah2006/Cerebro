const BASE = import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? "http://localhost:8000" : "");

function url(path, params = {}) {
  const base = BASE || (typeof window !== "undefined" ? window.location.origin : "http://localhost:8000");
  const u = new URL(path, base);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") u.searchParams.set(k, String(v));
  });
  return u.toString();
}

/**
 * GET /questions/next?topics=Topic1,Topic2&difficulty=medium
 * @param {string[]} topics
 * @param {string} [difficulty]
 * @returns {Promise<{ question_id: string, question_text: string, options: { id: string, text: string }[], difficulty?: string }>}
 */
export async function getQuestion(topics = [], difficulty = "medium") {
  const res = await fetch(url("/questions/next", {
    topics: Array.isArray(topics) ? topics.join(",") : topics,
    difficulty,
  }));
  if (!res.ok) throw new Error("Failed to load question");
  return res.json();
}

/**
 * POST /questions/submit
 * @param {{ user_id: string, question_id: string, selected_option_id: string }} body
 * @returns {Promise<{ correct: boolean, correct_option_id: string, explanation: string, score_delta: number, follow_up_question?: import("./api").QuestionResponse }>}
 */
export async function submitAnswer(body) {
  const res = await fetch(url("/questions/submit"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to submit answer");
  }
  return res.json();
}
