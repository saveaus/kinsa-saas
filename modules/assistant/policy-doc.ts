import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from "docx"

import type { AssistantPolicyDraft } from "@/modules/assistant/policy"

const draftNote = "Draft. This policy has not been filed."

function heading(text: string) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 280, after: 80 } })
}

function body(text: string) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 22 })],
  })
}

export function policyDocument(draft: AssistantPolicyDraft) {
  return new Document({
    creator: draft.organisation,
    title: draft.title,
    description: draftNote,
    numbering: {
      config: [
        {
          reference: "policy-duties",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
        {
          reference: "policy-steps",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            spacing: { after: 80 },
            children: [new TextRun({ text: draft.title })],
          }),
          new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: draft.organisation, italics: true, size: 22 })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: draftNote, italics: true, size: 20, color: "666666" })],
          }),
          heading("Purpose"),
          body(draft.purpose),
          heading("Scope"),
          body(draft.scope),
          heading("Policy"),
          body(draft.statement),
          heading("Responsibilities"),
          ...draft.responsibilities.map(
            (item) =>
              new Paragraph({
                numbering: { reference: "policy-duties", level: 0 },
                spacing: { after: 60 },
                children: [new TextRun({ text: item, size: 22 })],
              })
          ),
          heading("Procedure"),
          ...draft.procedure.map(
            (item) =>
              new Paragraph({
                numbering: { reference: "policy-steps", level: 0 },
                spacing: { after: 80 },
                children: [new TextRun({ text: item, size: 22 })],
              })
          ),
        ],
      },
    ],
  })
}

export function policyDocxBlob(draft: AssistantPolicyDraft) {
  return Packer.toBlob(policyDocument(draft))
}

export function policyDocxBuffer(draft: AssistantPolicyDraft) {
  return Packer.toBuffer(policyDocument(draft))
}
