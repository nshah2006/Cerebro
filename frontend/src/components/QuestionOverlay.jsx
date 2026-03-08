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

  const loadQuestion = useCallback(async (difficulty = "medium") => {
    setError(null);
    setPhase("loading");
    try {
      const q = await getQuestion(topicList, difficulty, userId);
      setQuestion(q);
      setSelectedId(null);
      setCorrectId(null);
      setExplanation("");
      setNextFollowUp(null);
      setQuestionDepth((d) => (difficulty === "easy" ? d + 1 : d));
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
    if (!isOpen) {
      setPhase("idle");
      setQuestionDepth(0);
    }
  }, [isOpen, phase, loadQuestion]);

  const handleSelect = async (optionId) => {
    if (phase !== "question" || !question || submitting) return;
    const knownCorrectId = question.correct_option_id || question._correctId || question.options?.[0]?.id;
    setSelectedId(optionId);
    setCorrectId(knownCorrectId);
    setSubmitting(true);
    const isCorrect = optionId === knownCorrectId;
    if (isCorrect) {
      setExplanation("That's correct!");
    } else {
      setExplanation("That's not quite right.");
      setPhase("wrong-reveal");
    }
    try {
      const result = await submitAnswer({
        user_id: userId,
        question_id: question.question_id,
        selected_option_id: optionId,
      });
      setExplanation(result.explanation || (isCorrect ? "That's correct!" : "That's not quite right."));

      if (result.correct) {
        setPhase("closing");
        return;
      }

      setNextFollowUp(result.follow_up_question || null);
      setPhase("wrong-reveal");
    } catch (e) {
      setError(e.message || "Submit failed");
      setPhase("wrong-reveal");
    } finally {
      setSubmitting(false);
    }
  };

  // Try another question: use API follow-up (simpler) if we have it, else fetch a new easier question
  const tryAnotherQuestion = () => {
    if (nextFollowUp) {
      setQuestion(nextFollowUp);
      setSelectedId(null);
      setCorrectId(null);
      setExplanation("");
      setNextFollowUp(null);
      setQuestionDepth((d) => d + 1);
      setPhase("question");
    } else {
      loadQuestion("easy");
    }
  };

  if (!isOpen) return null;

  const opts = question?.options || [];
  const answered = selectedId != null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#2C3E2C]/80 backdrop-blur-md animate-in fade-in duration-300">
      <div
        className="bg-white/90 backdrop-blur-2xl p-8 rounded-[2.5rem] shadow-2xl border border-white/50 max-w-md w-full transform animate-in zoom-in-95 duration-300"
      >
        {/* Loading */}
        {phase === "loading" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 border-4 border-[#8B9D8B]/30 border-t-[#8B9D8B] rounded-full animate-spin mb-4" />
            <p className="text-[#2C3E2C] font-semibold">Loading question...</p>
          </div>
        )}

        {/* Single card: question + options; color-code red/green when answered, no flip */}
        {phase !== "loading" && phase !== "closing" && question && (
          <div className="relative min-h-[200px]">
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
                  if (answered) {
                    if (opt.id === correctId) {
                      buttonStyle = "bg-green-100 border-green-500 text-green-700 shadow-[0_0_15px_rgba(34,197,94,0.3)] scale-105";
                    } else if (opt.id === selectedId) {
                      buttonStyle = "bg-red-100 border-red-500 text-red-700";
                    } else {
                      buttonStyle = "bg-gray-50 border-gray-100 text-gray-400 opacity-60";
                    }
                  }
                  return (
                    <button
                      key={opt.id}
                      disabled={selectedId !== null}
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
              {answered && phase === "wrong-reveal" && (
                <>
                  <p className="mt-6 text-gray-600 text-sm">{explanation}</p>
                  <div className="mt-6">
                    <button
                      onClick={tryAnotherQuestion}
                      className="px-6 py-3 bg-[#8B9D8B] hover:bg-[#6b7c6b] text-white font-bold rounded-xl transition-colors"
                    >
                      Try another question
                    </button>
                  </div>
                </>
              )}
              {!answered && (
                <div className="mt-8 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Correct answers earn +10 SGA Coins
                </div>
              )}
            </div>
          </div>
        )}

        {/* Closing (correct answer) — show Continue button */}
        {phase === "closing" && (
          <div className="flex flex-col items-center py-8">
            <div className="w-20 h-20 bg-green-200 rounded-full flex items-center justify-center mb-4">
              <span className="text-4xl">✓</span>
            </div>
            <p className="text-xl font-bold text-[#2C3E2C] mb-6">Correct! +10 coins</p>
            <button
              onClick={() => onAnswer(true)}
              className="px-8 py-3 bg-[#8B9D8B] hover:bg-[#6b7c6b] text-white font-bold rounded-xl transition-colors"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
