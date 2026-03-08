"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { motion, AnimatePresence } from "framer-motion";

interface Answer {
  id: string;
  questionText: string;
  correctAnswer: string | null;
  elderAnswer: string | null;
  result: string | null;
  audioUrl: string | null;
  orderIndex: number;
}

interface QuestionListProps {
  answers: Answer[];
}

export function QuestionList({ answers }: QuestionListProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (answers.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-4">
        No questions in this session
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {answers.map((answer) => (
        <div
          key={answer.id}
          className="rounded-xl border border-white/5 bg-white/[0.03] overflow-hidden"
        >
          <button
            onClick={() =>
              setExpanded(expanded === answer.id ? null : answer.id)
            }
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs text-gray-500 shrink-0">
                Q{answer.orderIndex + 1}
              </span>
              <span className="text-sm text-gray-300 truncate">
                {answer.questionText}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              {answer.result && (
                <Badge
                  variant={
                    answer.result === "CORRECT"
                      ? "success"
                      : answer.result === "WRONG"
                      ? "danger"
                      : "warning"
                  }
                >
                  {answer.result}
                </Badge>
              )}
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${
                  expanded === answer.id ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m19.5 8.25-7.5 7.5-7.5-7.5"
                />
              </svg>
            </div>
          </button>

          <AnimatePresence>
            {expanded === answer.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-3 border-t border-white/5 pt-3 space-y-2">
                  {answer.elderAnswer && (
                    <div>
                      <span className="text-xs text-gray-500">
                        Elder&apos;s answer:
                      </span>
                      <p className="text-sm text-gray-300">
                        {answer.elderAnswer}
                      </p>
                    </div>
                  )}
                  {answer.correctAnswer && (
                    <div>
                      <span className="text-xs text-gray-500">
                        Correct answer:
                      </span>
                      <p className="text-sm text-emerald-400">
                        {answer.correctAnswer}
                      </p>
                    </div>
                  )}
                  {answer.audioUrl && (
                    <audio
                      controls
                      src={answer.audioUrl}
                      className="w-full h-8 mt-2"
                    />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
