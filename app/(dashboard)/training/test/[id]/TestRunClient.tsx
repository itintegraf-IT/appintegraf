"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, CheckCircle, XCircle } from "lucide-react";

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
};

type TestData = {
  id: number;
  name: string;
  time_limit: number;
  pass_percentage: number;
  test_questions: TestQuestion[];
};

type Props = {
  testId: number;
  testName: string;
  timeLimit: number;
  passPercentage: number;
  questionCount: number;
};

export function TestRunClient({
  testId,
  testName,
  timeLimit,
  passPercentage,
  questionCount,
}: Props) {
  const router = useRouter();
  const [test, setTest] = useState<TestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
    correct: number;
    total: number;
  } | null>(null);
  const [timeLeft, setTimeLeft] = useState(timeLimit * 60);
  const submittedRef = useRef(false);

  useEffect(() => {
    fetch(`/api/training/test/${testId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.id) setTest(data);
        else setError("Test nenalezen");
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
  }, [timeLeft, result, submitting, test]);

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
          answers: Object.fromEntries(
            test.test_questions.map((tq) => [
              tq.question_id,
              answers[tq.question_id] ?? "",
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
          <Link
            href="/training"
            className="mt-6 inline-block rounded-lg bg-red-600 px-6 py-2 font-medium text-white hover:bg-red-700"
          >
            Zpět na školení
          </Link>
        </div>
      </div>
    );
  }

  if (!test) return null;

  const questions = test.test_questions;
  const current = questions[currentIndex];
  const currentQuestion = current?.questions;

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
        <div className="text-sm text-gray-500">
          Otázka {currentIndex + 1} / {questions.length}
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {currentQuestion && (
          <>
            <h3 className="mb-4 text-lg font-medium text-gray-900">
              {currentQuestion.question}
            </h3>
            <div className="space-y-3">
              {(["A", "B", "C", "D"] as const).map((key) => {
                const opt = currentQuestion[`option_${key.toLowerCase()}` as keyof Question];
                if (!opt || typeof opt !== "string") return null;
                return (
                  <label
                    key={key}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
                      answers[currentQuestion.id] === key
                        ? "border-red-600 bg-red-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${currentQuestion.id}`}
                      value={key}
                      checked={answers[currentQuestion.id] === key}
                      onChange={() =>
                        setAnswers((prev) => ({
                          ...prev,
                          [currentQuestion.id]: key,
                        }))
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
                  : answers[tq.question_id]
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
              className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? "Odevzdávám…" : "Odevzdat test"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
