import { useState, useEffect, useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { getQuestion, submitAnswer, getUserId } from "../services/api";

export default function QuestionOverlay({ isOpen, onAnswer, topics = [], topicLabel = "Challenge" }) {
  const { user } = useAuth0();
  const userId = getUserId(user);
  // Phase: idle | loading | question | wrong-reveal | closing
  const [phase, setPhase] = useState("idle");
  const [question, setQuestion] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [correctId, setCorrectId] = useState(null);
  const [explanation, setExplanation] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState(null);
  const [questionDepth, setQuestionDepth] = useState(0); // 0 = initial, 1+ = follow-ups
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const topicList = Array.isArray(topics) ? topics : (topics ? [topics] : []);

  const loadQuestion = useCallback(async () => {
    setError(null);
    setPhase("loading");
    try {
      const q = await getQuestion(topicList, "medium", userId);
      setQuestion(q);
      setSelectedId(null);
      setCorrectId(null);
      setExplanation("");
      setNextFollowUp(null);
      setQuestionDepth(0);
      setPhase("question");
    } catch (e) {
      setError(e.message || "Could not load question");
      setPhase("question");
      const fallbacks = [
        { question_text: "What is the time complexity of binary search?", options: [{ id: "a", text: "O(n)" }, { id: "b", text: "O(log n)" }, { id: "c", text: "O(n log n)" }, { id: "d", text: "O(1)" }], _correctId: "b" },
        { question_text: "Which data structure uses LIFO?", options: [{ id: "a", text: "Queue" }, { id: "b", text: "Stack" }, { id: "c", text: "Array" }, { id: "d", text: "Linked List" }], _correctId: "b" },
        { question_text: "In REST APIs, which method usually creates a resource?", options: [{ id: "a", text: "GET" }, { id: "b", text: "PUT" }, { id: "c", text: "POST" }, { id: "d", text: "DELETE" }], _correctId: "c" },
      ];
      const fb = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      setQuestion({
        question_id: "fallback",
        question_text: fb.question_text,
        options: fb.options,
        difficulty: "medium",
        _correctId: fb._correctId,
      });
    }
  }, [topicList.join(","), userId]);

  useEffect(() => {
    if (isOpen && phase === "idle") loadQuestion();
    if (!isOpen) setPhase("idle");
  }, [isOpen, phase, loadQuestion]);

  // Handle answer selection for the current question (works for both initial and follow-ups)
  const handleSelect = async (optionId) => {
    if (phase !== "question" || !question || submitting) return;
    setSubmitting(true);
    try {
      const result = await submitAnswer({
        user_id: userId,
        question_id: question.question_id,
        selected_option_id: optionId,
      });
      setExplanation(result.explanation || (result.correct ? "That's correct!" : "That's not quite right."));

      if (result.correct) {
        setPhase("closing");
        setTimeout(() => onAnswer(true), 1200);
        return;
      }

      setSelectedId(optionId);
      setCorrectId(result.correct_option_id);
      setNextFollowUp(result.follow_up_question || null);
      setPhase("wrong-reveal");
    } catch (e) {
      setError(e.message || "Submit failed");
      setSelectedId(optionId);
      setCorrectId(question._correctId ?? question.options?.[0]?.id ?? "a");
      setPhase("wrong-reveal");
    } finally {
      setSubmitting(false);
    }
  };

  // User clicks "Try a simpler question" — load the follow-up as the new current question
  const goToNextFollowUp = () => {
    if (nextFollowUp) {
      setQuestion(nextFollowUp);
      setSelectedId(null);
      setCorrectId(null);
      setExplanation("");
      setNextFollowUp(null);
      setQuestionDepth((d) => d + 1);
      setPhase("question");
    } else {
      // No follow-up available — just close
      onAnswer(false);
    }
  };

  if (!isOpen) return null;

  const opts = question?.options || [];
  const showWrongReveal = phase === "wrong-reveal" && selectedId != null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#2C3E2C]/80 backdrop-blur-md animate-in fade-in duration-300">
      <div
        className="bg-white/90 backdrop-blur-2xl p-8 rounded-[2.5rem] shadow-2xl border border-white/50 max-w-md w-full transform animate-in zoom-in-95 duration-300"
        style={{ perspective: "1000px" }}
      >
        {/* Loading */}
        {phase === "loading" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 border-4 border-[#8B9D8B]/30 border-t-[#8B9D8B] rounded-full animate-spin mb-4" />
            <p className="text-[#2C3E2C] font-semibold">Loading question...</p>
          </div>
        )}

        {/* Question card (front) / Wrong-reveal card (back) — flip animation */}
        {phase !== "loading" && phase !== "closing" && question && (
          <div
            className="relative min-h-[200px]"
            style={{ perspective: "1000px" }}
          >
            <div
              className="relative w-full transition-transform duration-500"
              style={{
                transformStyle: "preserve-3d",
                transform: showWrongReveal ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              {/* Front: question */}
              <div
                className="w-full"
                style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-[#8B9D8B]/20 rounded-2xl flex items-center justify-center mb-6">
                    <span className="text-3xl">{questionDepth === 0 ? "🧠" : "🔄"}</span>
                  </div>
                  <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#8B9D8B] mb-2">
                    {questionDepth === 0 ? `Cerebro Challenge: ${topicLabel}` : `Simpler Follow-up #${questionDepth}`}
                  </h2>
                  {error && (
                    <p className="text-amber-600 text-sm mb-2">{error}</p>
                  )}
                  <h3 className="text-xl font-bold text-[#2C3E2C] mb-8 leading-tight">
                    {question.question_text}
                  </h3>
                  <div className="grid grid-cols-1 gap-3 w-full">
                    {opts.map((opt) => {
                      let buttonStyle = "bg-gray-50 border-gray-100 text-gray-700 hover:bg-[#8B9D8B]/10 hover:border-[#8B9D8B]/30";
                      if (selectedId !== null) {
                        if (opt.id === correctId) {
                          buttonStyle = "bg-green-100 border-green-500 text-green-700 shadow-[0_0_15px_rgba(34,197,94,0.3)] scale-105";
                        } else if (opt.id === selectedId) {
                          buttonStyle = "bg-red-100 border-red-500 text-red-700 opacity-80";
                        } else {
                          buttonStyle = "bg-gray-50 border-gray-100 text-gray-400 opacity-50";
                        }
                      }
                      return (
                        <button
                          key={opt.id}
                          disabled={selectedId !== null || submitting}
                          onClick={() => handleSelect(opt.id)}
                          className={`px-6 py-4 rounded-2xl border-2 font-semibold text-left transition-all duration-300 ${buttonStyle}`}
                        >
                          <div className="flex items-center gap-4">
                            <span className="w-8 h-8 rounded-lg bg-white/50 flex items-center justify-center text-xs font-bold border border-black/5">
                              {opt.id.toUpperCase()}
                            </span>
                            {opt.text}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-8 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Correct answers earn +10 SGA Coins
                  </div>
                </div>
              </div>

              {/* Back: correct answer + explanation (flipped) */}
              <div
                className="absolute inset-0 w-full flex flex-col items-center justify-center text-center"
                style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-4">
                  <span className="text-3xl">📖</span>
                </div>
                <h3 className="text-lg font-bold text-[#2C3E2C] mb-2">Correct answer</h3>
                <p className="text-[#8B9D8B] font-semibold mb-4">
                  {opts.find((o) => o.id === correctId)?.text ?? correctId}
                </p>
                <p className="text-gray-600 text-sm mb-6">{explanation}</p>
                {nextFollowUp ? (
                  <button
                    onClick={goToNextFollowUp}
                    className="px-6 py-3 bg-[#8B9D8B] hover:bg-[#6b7c6b] text-white font-bold rounded-xl transition-colors"
                  >
                    Try a simpler follow-up question
                  </button>
                ) : (
                  <button
                    onClick={() => onAnswer(false)}
                    className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-colors"
                  >
                    Continue
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Closing (correct answer) */}
        {phase === "closing" && (
          <div className="flex flex-col items-center py-8">
            <div className="w-20 h-20 bg-green-200 rounded-full flex items-center justify-center mb-4">
              <span className="text-4xl">✓</span>
            </div>
            <p className="text-xl font-bold text-[#2C3E2C]">Correct! +10 coins</p>
          </div>
        )}
      </div>
    </div>
  );
}
