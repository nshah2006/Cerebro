const BASE = import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? "http://localhost:8000" : "");

const ANON_USER_KEY = "hackai_anon_user_id";

function url(path, params = {}) {
  const base = BASE || (typeof window !== "undefined" ? window.location.origin : "http://localhost:8000");
  const u = new URL(path, base);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") u.searchParams.set(k, String(v));
  });
  return u.toString();
}

/** Get a stable user id: Auth0 sub if logged in, else a persistent anonymous id in localStorage. */
export function getUserId(auth0User) {
  if (auth0User?.sub) return auth0User.sub;
  if (typeof window === "undefined") return "anonymous";
  let id = localStorage.getItem(ANON_USER_KEY);
  if (!id) {
    id = "anon-" + Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
    localStorage.setItem(ANON_USER_KEY, id);
  }
  return id;
}

/**
 * GET /questions/next?topics=...&difficulty=...&user_id=...
 * @param {string[]} topics
 * @param {string} [difficulty]
 * @param {string} [userId] - optional; when provided, backend uses MongoDB history for adaptive questions and no-repeat
 */
export async function getQuestion(topics = [], difficulty = "medium", userId = null) {
  const params = {
    topics: Array.isArray(topics) ? topics.join(",") : topics,
    difficulty,
  };
  if (userId) params.user_id = userId;
  const res = await fetch(url("/questions/next", params));
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
