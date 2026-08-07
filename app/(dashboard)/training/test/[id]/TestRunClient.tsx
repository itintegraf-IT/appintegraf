"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Clock, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";

type Question = {
  id: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string | null;
  option_d: string | null;
};

type TestQuestion = {
  id: number;
  question_id: number;
  questions: Question;
  /** Počet správných odpovědí (1 = radio, více = checkboxy) */
  correct_count: number;
};

type TestData = {
  id: number;
  name: string;
  time_limit: number;
  pass_percentage: number;
  test_questions: TestQuestion[];
  attempts_remaining: number | null;
  end_date: string | null;
};

type ReviewItem = {
  question_id: number;
  question: string;
  options: { A: string; B: string; C: string | null; D: string | null };
  user_answers: string[];
  correct_answers: string[];
  is_correct: boolean;
  explanation: string | null;
};

type Result = {
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  attempts_remaining: number | null;
  review: ReviewItem[] | null;
};

type Props = {
  testId: number;
  timeLimit: number;
  passPercentage: number;
};

export function TestRunClient({ testId, timeLimit, passPercentage }: Props) {
  const [test, setTest] = useState<TestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timeLimit * 60);
  const submittedRef = useRef(false);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    fetch(`/api/training/test/${testId}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (r.ok && data?.id) {
          setTest(data);
          startedAtRef.current = Date.now();
        } else {
          setError(data?.error ?? "Test nenalezen");
        }
      })
      .catch(() => setError("Chyba při načítání"))
      .finally(() => setLoading(false));
  }, [testId]);

  useEffect(() => {
    if (result || timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [result, timeLeft]);

  useEffect(() => {
    if (timeLeft === 0 && !result && !submitting && !submittedRef.current && test) {
      submittedRef.current = true;
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, result, submitting, test]);

  const selectSingle = (questionId: number, key: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: [key] }));
  };

  const toggleMulti = (questionId: number, key: string) => {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      const next = current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key];
      return { ...prev, [questionId]: next };
    });
  };

  const handleSubmit = async () => {
    if (!test || submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/training/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          test_id: testId,
          time_spent: Math.round((Date.now() - startedAtRef.current) / 1000),
          answers: Object.fromEntries(
            test.test_questions.map((tq) => [
              tq.question_id,
              answers[tq.question_id] ?? [],
            ])
          ),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Chyba při odevzdání");
        setSubmitting(false);
        return;
      }

      setResult({
        score: data.score,
        passed: data.passed,
        correct: data.correct,
        total: data.total,
        attempts_remaining: data.attempts_remaining ?? null,
        review: data.review ?? null,
      });
    } catch {
      setError("Chyba při odevzdání");
    }
    setSubmitting(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">Načítání testu…</p>
      </div>
    );
  }

  if (error && !test) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="text-red-700">{error}</p>
        <Link href="/training" className="mt-4 inline-block text-red-600 hover:underline">
          Zpět na školení
        </Link>
      </div>
    );
  }

  if (result) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="text-center">
            {result.passed ? (
              <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
            ) : (
              <XCircle className="mx-auto h-16 w-16 text-red-500" />
            )}
            <h2 className="mt-4 text-xl font-bold text-gray-900">
              {result.passed ? "Test splněn!" : "Test nesplněn"}
            </h2>
            <p className="mt-2 text-gray-600">
              Skóre: {result.correct} / {result.total} ({result.score}%)
            </p>
            <p className="text-sm text-gray-500">
              Pro splnění bylo potřeba {passPercentage}%
            </p>
            {result.attempts_remaining !== null && (
              <p className="mt-1 text-sm text-gray-500">
                Zbývající pokusy: {result.attempts_remaining}
              </p>
            )}
            <div className="mt-6 flex items-center justify-center gap-3">
              {result.review && result.review.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowReview((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
                >
                  {showReview ? (
                    <>
                      Skrýt odpovědi <ChevronUp className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Zobrazit správné odpovědi <ChevronDown className="h-4 w-4" />
                    </>
                  )}
                </button>
              )}
              <Link
                href="/training"
                className="inline-block rounded-lg bg-red-600 px-6 py-2 font-medium text-white hover:bg-red-700"
              >
                Zpět na školení
              </Link>
            </div>
          </div>
        </div>

        {showReview && result.review && (
          <div className="space-y-4">
            {result.review.map((item, idx) => (
              <div
                key={item.question_id}
                className={`rounded-xl border bg-white p-5 shadow-sm ${
                  item.is_correct ? "border-green-200" : "border-red-200"
                }`}
              >
                <div className="flex items-start gap-2">
                  {item.is_correct ? (
                    <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {idx + 1}. {item.question}
                    </p>
                    <div className="mt-3 space-y-1.5">
                      {(["A", "B", "C", "D"] as const).map((key) => {
                        const option = item.options[key];
                        if (!option) return null;
                        const isCorrect = item.correct_answers.includes(key);
                        const isUser = item.user_answers.includes(key);
                        return (
                          <div
                            key={key}
                            className={`rounded-lg border px-3 py-2 text-sm ${
                              isCorrect
                                ? "border-green-300 bg-green-50 text-green-800"
                                : isUser
                                  ? "border-red-300 bg-red-50 text-red-800"
                                  : "border-gray-200 text-gray-600"
                            }`}
                          >
                            <span className="font-semibold">{key})</span> {option}
                            {isCorrect && <span className="ml-2 text-xs">(správně)</span>}
                            {isUser && !isCorrect && (
                              <span className="ml-2 text-xs">(vaše odpověď)</span>
                            )}
                          </div>
                        );
                      })}
                      {item.user_answers.length === 0 && (
                        <p className="text-xs text-gray-500">Bez odpovědi</p>
                      )}
                    </div>
                    {item.explanation && (
                      <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
                        {item.explanation}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!test) return null;

  const questions = test.test_questions;
  const current = questions[currentIndex];
  const currentQuestion = current?.questions;
  const isMulti = (current?.correct_count ?? 1) > 1;
  const currentAnswers = currentQuestion ? (answers[currentQuestion.id] ?? []) : [];

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-500" />
          <span className="font-medium">
            Čas: {formatTime(timeLeft)}
            {timeLeft <= 60 && timeLeft > 0 && (
              <span className="ml-2 text-red-600">Zbývá méně než minuta!</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          {test.attempts_remaining !== null && (
            <span>Pokus {"("}zbývá {test.attempts_remaining}{")"}</span>
          )}
          <span>
            Otázka {currentIndex + 1} / {questions.length}
          </span>
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {currentQuestion && (
          <>
            <h3 className="mb-1 text-lg font-medium text-gray-900">
              {currentQuestion.question}
            </h3>
            {isMulti && (
              <p className="mb-4 text-sm text-amber-600">
                Vyberte {current.correct_count} odpovědi
              </p>
            )}
            {!isMulti && <div className="mb-4" />}
            <div className="space-y-3">
              {(["A", "B", "C", "D"] as const).map((key) => {
                const opt = currentQuestion[`option_${key.toLowerCase()}` as keyof Question];
                if (!opt || typeof opt !== "string") return null;
                const checked = currentAnswers.includes(key);
                return (
                  <label
                    key={key}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
                      checked
                        ? "border-red-600 bg-red-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type={isMulti ? "checkbox" : "radio"}
                      name={`q-${currentQuestion.id}`}
                      value={key}
                      checked={checked}
                      onChange={() =>
                        isMulti
                          ? toggleMulti(currentQuestion.id, key)
                          : selectSingle(currentQuestion.id, key)
                      }
                      className="h-4 w-4"
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {questions.map((tq, i) => (
            <button
              key={tq.id}
              type="button"
              onClick={() => setCurrentIndex(i)}
              className={`rounded px-3 py-1 text-sm ${
                currentIndex === i
                  ? "bg-red-600 text-white"
                  : (answers[tq.question_id]?.length ?? 0) > 0
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 disabled:opacity-50"
          >
            Předchozí
          </button>
          {currentIndex < questions.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => i + 1)}
              className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Další
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-lg bg-green-600 px-6 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? "Odevzdávám…" : "Odevzdat test"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
