"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UploadCloud } from "lucide-react";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "YOUR_API_KEY";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Changed from gemini-pro

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [quiz, setQuiz] = useState<
    { question: string; options: string[]; correctOption: string }[]
  >([]);
  const [quizResults, setQuizResults] = useState<
    | null
    | {
        question: string;
        selected: string;
        correct: string;
        explanation: string;
      }[]
  >(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [score, setScore] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      setFile(droppedFiles[0]);
      setErrorMessage("");
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMessage("");
    }
  };

  const handleUpload = async () => {
    setErrorMessage("");

    if (!API_KEY || API_KEY === "YOUR_GEMINI_API_KEY") {
      setErrorMessage("Please enter your Gemini API key in the code.");
      return;
    }
    if (!file) {
      setErrorMessage("Please select or drop a file to upload.");
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage("Unsupported file format. Please upload a PDF, DOCX, PPT, or PPTX file.");
      return;
    }
    setUploading(true);
    setQuiz([]);
    setQuizResults(null);
    setScore(0);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await axios.post("/api/upload", formData);
      
      if (!response.data || typeof response.data.content !== "string") {
        throw new Error("Uploaded file content was not returned");
      }

      const fileContent = response.data.content;
      const promptText = `Generate a multiple-choice quiz strictly based on the exact content provided below. Follow these instructions precisely to ensure accuracy and prevent hallucinations:

Respond ONLY with a valid JSON array of question objects. No additional text, explanations, or formatting.

Each question object must have this exact structure and key names (case-sensitive):
      {
        "question": "What is the question?",
        "options": ["option 1", "option 2", "option 3", "option 4"],
        "correctOption": "option 1"
      }
      
      Important:
      1. Return ONLY the JSON array, no other text
      2. Each question must have exactly 4 distinct options.
      3. The correctOption must match one of the options exactly
      4. Generate 10 - 20 questions based on the content
      5. Ensure the questions are relevant and accurate to the content
      6. Do not include any additional text or explanations
      7. Do not use any other format or structure
      8. Do not include any metadata or comments
      9.All questions and options must be based exclusively on the provided content, with no assumptions, extrapolations, or outside knowledge.
      10. Avoid repeating questions or options.
      Content to analyze:
      ${fileContent}`;

      const aiResponse = await model.generateContent({
        contents: [{
          role: "user",
          parts: [{ text: promptText }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096, // Try 2048, 3072, or 4096
        }
      });

      const result = await aiResponse.response;
      const aiText = result.text();
      
      let parsedQuiz;
      try {
          // Remove Markdown code block if present
        let cleaned = aiText.trim();
        if (cleaned.startsWith("```json")) {
          cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "").trim();
        } else if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```/, "").replace(/```$/, "").trim();
        }
        // Try to extract JSON array if there's any surrounding text
        const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
        const jsonString = jsonMatch ? jsonMatch[0] : cleaned;
        parsedQuiz = JSON.parse(jsonString);
      } catch (_) { // changed from (parseError)
        console.error("Raw AI response:", aiText);
        throw new Error("Failed to parse AI response as JSON");
      }

      if (!Array.isArray(parsedQuiz)) {
        throw new Error("Expected array of questions");
      }

      // Validate the quiz format
      const isValidQuiz = parsedQuiz.every(q => 
        q.question && 
        Array.isArray(q.options) && 
        q.options.length === 4 &&
        q.correctOption &&
        q.options.includes(q.correctOption)
      );

      if (!isValidQuiz) {
        throw new Error("Quiz format is invalid");
      }

      setQuiz(parsedQuiz);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error:", error);
      setErrorMessage(message || "An unexpected error occurred");
    } finally {
      setUploading(false);
    }
  };

  const handleQuizSubmit = async (answers: string[]) => {
    if (!Array.isArray(quiz) || quiz.length === 0) return;
    let correctCount = 0;
    quiz.forEach((q, idx) => {
      if (answers[idx] === q.correctOption) correctCount++;
    });
    setScore(correctCount);
    const explanations: string[] = [];
    for (let idx = 0; idx < quiz.length; idx++) {
      const q = quiz[idx];
      const selected = answers[idx] || "";
      const explanationPrompt = `Question: ${q.question}
Options: ${q.options.join(", ")}
Selected: ${selected}
Correct: ${q.correctOption}
Provide a clear, concise explanation for the correct answer. Limit your explanation to 100 words or fewer. Including No special characters like "**" or "[]". etc. and avoid any additional text or formatting.`;
      try {
        const aiResponse = await model.generateContent({
          contents: [{
            role: "user",
            parts: [{ text: explanationPrompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          }
        });
        const result = await aiResponse.response;
        const text = result.text();
        explanations.push(
          typeof text === "string" ? text.trim() : "Explanation unavailable."
        );
      } catch (ex) {
        console.error("Error generating explanation:", ex);
        explanations.push("Explanation unavailable.");
      }
    }
    const resultsArray = quiz.map((q, idx) => ({
      question: q.question,
      selected: answers[idx] || "",
      correct: q.correctOption,
      explanation: explanations[idx] || "Explanation unavailable.",
    }));
    setQuizResults(resultsArray);
  };

  const handleRestart = () => {
    setFile(null);
    setQuiz([]);
    setQuizResults(null);
    setErrorMessage("");
    setScore(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Get the PDF name (or file name) for the quiz heading
  const fileName = file?.name ? file.name.replace(/\.[^/.]+$/, "") : "";

  //UI
  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-10 flex flex-col items-center justify-center">
      {/* Show heading/subheading only before quiz starts */}
      {quiz.length === 0 && quizResults == null && (
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-6xl font-extrabold tracking-tight drop-shadow-lg">
            Bells <span className="text-purple-500 text-6xl">Study</span>
          </h1>
          <p className="text-gray-300 text-2xl max-w-2xl mx-auto">
            Upload your notes and instantly generate a quiz powered by <span className="font-semibold text-purple-400">Gemini AI</span>.
          </p>
        </div>
      )}

      {/* Quiz Stepper with PDF name as heading */}
      {Array.isArray(quiz) && quiz.length > 0 && quizResults == null && (
        <div className="flex flex-col items-center w-full">
          <div className="flex items-center justify-between w-full max-w-xl mb-4">
            <h2 className="text-3xl font-bold text-purple-500 drop-shadow">
              {fileName ? `${fileName} Quiz` : "Quiz"}
            </h2>
            <Button
              onClick={handleRestart}
              className="ml-auto px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-base font-semibold transition"
              type="button"
            >
              Exit Quiz
            </Button>
          </div>
          <QuizStepper
            quiz={quiz}
            onSubmit={handleQuizSubmit}
          />
        </div>
      )}

      {/* Upload card */}
      {quiz.length === 0 && quizResults == null && (
        <Card className="w-full max-w-2xl bg-gradient-to-br from-gray-900 via-gray-950 to-gray-900 border-2 border-purple-700/40 rounded-3xl shadow-2xl">
          <CardContent className="p-10 space-y-8">
            <div
              className="flex flex-col items-center justify-center w-full p-10 border-4 border-dashed border-purple-700/40 rounded-2xl hover:border-purple-500/80 transition cursor-pointer text-center text-gray-300 bg-gray-950/60"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              style={{ minHeight: 200 }}>
              <UploadCloud className="mb-4 h-14 w-14 text-purple-400 drop-shadow" />
              <p className="text-lg font-medium">
              {file ? file.name : "Click or drag your file here"}
              </p>
              <p className="text-base text-gray-500 mt-2">
              Supported: <span className="font-semibold">PDF, DOCX, PPT, PPTX</span>
              </p>
              <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.ppt,.pptx"
              className="hidden"
              onChange={handleFileChange}
              />
            </div>
            <Button
              onClick={handleUpload}
              disabled={uploading || !file}
              className="w-full mt-4 py-5 text-xl font-semibold rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 transition"
            >
              {uploading ? (
              <span>
                <span className="animate-spin inline-block mr-2 align-middle">&#9696;</span>
                Generating Quiz...
              </span>
              ) : (
              "Generate Quiz"
              )}
            </Button>
            {errorMessage && (
              <p className="text-lg text-red-400 mt-4">{errorMessage}</p>
            )}
            </CardContent>
          </Card>
      )}

      {/* Quiz results */}
      {Array.isArray(quizResults) && (
        <ReviewStepper
          quizResults={quizResults}
          quiz={quiz}
          score={score}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
}

// Move QuizStepper OUTSIDE of Home!
function QuizStepper({
  quiz,
  onSubmit,
}: {
  quiz: { question: string; options: string[]; correctOption: string }[];
  onSubmit: (answers: string[]) => Promise<void>;
}) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<string[]>(Array(quiz.length).fill(""));
  const [submitting, setSubmitting] = useState(false);

  const handleOptionSelect = (value: string) => {
    const updated = [...answers];
    updated[current] = value;
    setAnswers(updated);
  };

  const handleNext = () => {
    if (answers[current]) {
      setCurrent((c) => c + 1);
    }
  };

  const handlePrev = () => {
    setCurrent((c) => Math.max(0, c - 1));
  };

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    await onSubmit(answers);
    setSubmitting(false);
  };

  return (
    <div className="mt-10 w-full max-w-xl flex flex-col items-center">
      <Card className="w-full bg-gradient-to-br from-gray-900 via-gray-950 to-gray-900 border-2 border-purple-700/40 rounded-3xl shadow-xl">
        <CardContent className="p-8 flex flex-col items-center">
          <div className="w-full">
            <div className="flex items-center justify-between mb-6">
              <span className="text-purple-400 font-semibold text-lg">
                Question {current + 1} <span className="text-gray-400">/ {quiz.length}</span>
              </span>
              <div className="flex-1 max-w-xs flex space-x-0.5 overflow-hidden rounded-full bg-gray-800 h-2">
                {quiz.map((_, idx) => (
                  <span
                    key={idx}
                    className={`
                      transition-all duration-200
                      ${idx === current
                        ? "bg-purple-500"
                        : answers[idx]
                        ? "bg-purple-700/70"
                        : "bg-gray-700"}
                    `}
                    style={{
                      flex: 1,
                      minWidth: 4, // minimum width for visibility
                      borderRadius: idx === 0 ? "9999px 0 0 9999px" : idx === quiz.length - 1 ? "0 9999px 9999px 0" : "0",
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-white mb-4">{quiz[current].question}</h3>
              <div className="grid gap-4">
                {quiz[current].options.map((opt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleOptionSelect(opt)}
                    className={`w-full flex items-center px-5 py-4 rounded-xl border-2 transition-all duration-150 text-lg font-medium
                      ${
                        answers[current] === opt
                          ? "bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-500 text-white shadow-lg scale-105"
                          : "bg-gray-900 border-gray-800 text-gray-300 hover:border-purple-400 hover:bg-gray-800"
                      }
                    `}
                    aria-pressed={answers[current] === opt}
                  >
                    <span className="mr-3 flex-shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center
                      transition-all duration-150
                      "
                      style={{
                        borderColor:
                          answers[current] === opt
                            ? "#a78bfa"
                            : "#4b5563",
                        background:
                          answers[current] === opt
                            ? "linear-gradient(90deg,#a78bfa,#6366f1)"
                            : "transparent",
                      }}
                    >
                      {answers[current] === opt && (
                        <span className="block h-3 w-3 rounded-full bg-white" />
                      )}
                    </span>
                    <span className="flex-1 text-left">{opt}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-between items-center w-full mt-4">
              <Button
                type="button"
                className="rounded-lg px-6 py-2 text-base font-semibold bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                onClick={handlePrev}
                disabled={current === 0}
              >
                Previous
              </Button>
              {current < quiz.length - 1 ? (
                <Button
                  type="button"
                  className="rounded-lg px-8 py-2 text-base font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                  onClick={handleNext}
                  disabled={!answers[current]}
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="button"
                  className="rounded-lg px-8 py-2 text-base font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                  onClick={handleFinalSubmit}
                  disabled={answers.some((a) => !a) || submitting}
                >
                  {submitting ? (
                    <span>
                      <span className="animate-spin inline-block mr-2 align-middle">&#9696;</span>
                      Submitting...
                    </span>
                  ) : (
                    "Submit Quiz"
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ReviewStepper component for reviewing quiz results
function ReviewStepper({
  quizResults,
  quiz,
  score,
  onRestart,
}: {
  quizResults: {
    question: string;
    selected: string;
    correct: string;
    explanation: string;
  }[];
  quiz: { question: string; options: string[]; correctOption: string }[];
  score: number;
  onRestart: () => void;
}) {
  const [current, setCurrent] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        setCurrent((idx) => Math.min(idx + 1, quizResults.length - 1));
      } else if (e.key === "ArrowLeft") {
        setCurrent((idx) => Math.max(idx - 1, 0));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [quizResults.length]);

  // Scroll to current card (for accessibility)
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [current]);

  const res = quizResults[current];
  const q = quiz[current];

  return (
    <div className="mt-10 w-full max-w-xl flex flex-col items-center">
      <Card className="w-full bg-gradient-to-br from-gray-900 via-gray-950 to-gray-900 border-2 border-purple-700/40 rounded-3xl shadow-xl">
        <CardContent className="p-8 flex flex-col items-center">
          <div className="w-full">
            <div className="flex items-center justify-between mb-6">
              <span className="text-purple-400 font-semibold text-lg">
                Review {current + 1} <span className="text-gray-400">/ {quiz.length}</span>
              </span>
              <span className="text-lg font-bold text-purple-400">
                Score: <span className="text-white">{score}</span>
              </span>
            </div>
            <div ref={containerRef} className="mb-8">
              <h3 className="text-2xl font-extrabold text-white mb-4">{res.question}</h3>
              <div className="grid gap-4">
                {q.options.map((opt, idx) => {
                  const isCorrect = opt === res.correct;
                  const isSelected = opt === res.selected;
                  return (
                    <div
                      key={idx}
                      className={`
                        w-full flex items-center px-5 py-4 rounded-xl border-2 text-lg font-bold
                        ${isCorrect
                          ? "bg-green-700/30 border-green-500 text-green-300"
                          : isSelected
                          ? "bg-red-700/30 border-red-500 text-red-300"
                          : "bg-gray-900 border-gray-800 text-gray-300"}
                        ${isSelected ? "ring-2 ring-purple-400/60" : ""}
                        transition-all duration-150
                      `}
                    >
                      <span className="mr-3 flex-shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center
                        transition-all duration-150
                        "
                        style={{
                          borderColor: isCorrect
                            ? "#22c55e"
                            : isSelected
                            ? "#ef4444"
                            : "#4b5563",
                          background: isCorrect
                            ? "#166534"
                            : isSelected
                            ? "#7f1d1d"
                            : "transparent",
                        }}
                      >
                        {isCorrect && (
                          <span className="block h-3 w-3 rounded-full bg-green-400" />
                        )}
                        {isSelected && !isCorrect && (
                          <span className="block h-3 w-3 rounded-full bg-red-400" />
                        )}
                      </span>
                      <span className="flex-1 text-left">{opt}</span>
                      {isCorrect && (
                        <span className="ml-2 text-green-400 font-extrabold text-xl">✓</span>
                      )}
                      {isSelected && !isCorrect && (
                        <span className="ml-2 text-red-400 font-extrabold text-xl">✗</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <span className={`inline-block px-3 py-1 rounded text-base font-mono font-bold
                  ${res.selected === res.correct
                    ? "bg-green-900/40 text-green-300"
                    : "bg-red-900/40 text-red-300"}
                `}>
                  {res.selected === res.correct ? "Correct" : "Incorrect"}
                </span>
                {res.selected !== res.correct && (
                  <span className="inline-block px-3 py-1 rounded bg-green-900/40 text-green-300 text-base font-mono font-bold">
                    Correct: {res.correct}
                  </span>
                )}
              </div>
              <div className="mt-6 bg-gray-900/70 border border-gray-800 rounded-lg p-4 text-gray-200 text-base">
                <span className="block font-bold text-purple-300 mb-1">Explanation:</span>
                {res.explanation}
              </div>
            </div>
            <div className="flex justify-between items-center w-full mt-4">
              <Button
                type="button"
                className="rounded-lg px-6 py-2 text-base font-semibold bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                disabled={current === 0}
              >
                Previous
              </Button>
              {current < quiz.length - 1 ? (
                <Button
                  type="button"
                  className="rounded-lg px-8 py-2 text-base font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                  onClick={() => setCurrent((c) => c + 1)}
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="button"
                  className="rounded-lg px-8 py-2 text-base font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                  onClick={onRestart}
                >
                  Finish Review
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}