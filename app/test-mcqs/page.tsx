"use client";

import React, { useState } from "react";

const sampleMcqs = [
  {
    question: "Which planet is known as the Red Planet?",
    options: ["Earth", "Mars", "Jupiter", "Saturn"],
    answer: 1,
  },
  {
    question: "Who wrote 'Romeo and Juliet'?",
    options: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"],
    answer: 1,
  },
  {
    question: "What is the capital of France?",
    options: ["Berlin", "Madrid", "Paris", "Lisbon"],
    answer: 2,
  },
];

export default function TestMcqsPage() {
  const [selected, setSelected] = useState<number[]>(Array(sampleMcqs.length).fill(null));
  const [submitted, setSubmitted] = useState(false);

  const handleOptionChange = (qIdx: number, oIdx: number) => {
    const updated = [...selected];
    updated[qIdx] = oIdx;
    setSelected(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="max-w-xl mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">MCQ Test Page</h1>
      <form onSubmit={handleSubmit}>
        {sampleMcqs.map((mcq, qIdx: number) => (
          <div key={qIdx} className="mb-6 p-4 border rounded-lg">
            <div className="font-medium mb-2">{qIdx + 1}. {mcq.question}</div>
            <div className="space-y-2">
              {mcq.options.map((opt, oIdx) => (
                <label key={oIdx} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name={`mcq-${qIdx}`}
                    value={oIdx}
                    checked={selected[qIdx] === oIdx}
                    onChange={() => handleOptionChange(qIdx, oIdx)}
                    disabled={submitted}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
            {submitted && (
              <div className={`mt-2 text-sm ${selected[qIdx] === mcq.answer ? "text-green-600" : "text-red-600"}`}>
                {selected[qIdx] === mcq.answer ? "Correct!" : `Wrong. Correct answer: ${mcq.options[mcq.answer]}`}
              </div>
            )}
          </div>
        ))}
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          disabled={submitted}
        >
          Submit
        </button>
      </form>
    </div>
  );
}
