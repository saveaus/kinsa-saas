import assert from "node:assert/strict"
import { test } from "node:test"

import {
  interviewInstructions,
  interviewWelcome,
  priorQuestionPhrases,
} from "@/modules/internal-audits/prompt"

const complaints = {
  code: "core.complaints",
  name: "Feedback and complaints management",
  module: "Core module",
  category: "Provider governance and operational management",
}

test("the welcome names the criterion and the three steps", () => {
  const welcome = interviewWelcome(complaints)
  assert.match(welcome, /Feedback and complaints management/)
  assert.match(welcome, /1\. Answer/)
  assert.match(welcome, /2\. Get feedback/)
  assert.match(welcome, /3\. Receive a summary/)
  assert.match(welcome, /asked differently/)
})

test("earlier questions are skipped when they are the welcome", () => {
  assert.deepEqual(
    priorQuestionPhrases([
      [
        "Welcome! Great to have you here, let's get your internal audit underway.",
        "How do you record a complaint today?",
      ],
    ]),
    ["How do you record a complaint today?"]
  )
})

test("earlier wording is handed to the interviewer", () => {
  const text = interviewInstructions({
    criterion: complaints,
    policyOnFile: false,
    priorPhrases: ["How do you record a complaint today?"],
    recorded: null,
  })
  assert.match(text, /How do you record a complaint today\?/)
  assert.match(text, /different words/)
})

test("an administrator rating tells the interviewer not to record another", () => {
  const text = interviewInstructions({
    criterion: complaints,
    policyOnFile: true,
    priorPhrases: [],
    recorded: { rating: "met", source: "admin" },
  })
  assert.match(text, /Do not call record_assessment/)
  assert.match(text, /An accepted policy is on file/)
})
