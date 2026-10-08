export type NdisUpdateKind = "policy" | "general"

export type NdisUpdate = {
  id: string
  title: string
  href: string
  publishedOn: string
  kind: NdisUpdateKind
  summary: string
}

export const ndisUpdates: NdisUpdate[] = [
  {
    id: "securing-the-ndis",
    title: "Securing the NDIS for future generations",
    href: "https://www.ndis.gov.au/ndis-laws/securing-ndis-future-generations",
    publishedOn: "2026-08-20",
    kind: "policy",
    summary:
      "Parliament passed the Securing the NDIS for Future Generations Bill on 19 August 2026, and it was signed the next day. Plan reassessments before the scheduled date can now be requested only by the participant, their plan nominee, or a child representative, and only for a significant ongoing change. From October 2026, budgets for social, civic and community participation and for capacity-building daily activities are reset as plans are reassessed or renewed. Funding for education, employment, and disability-related health supports is not part of that reset.",
  },
  {
    id: "sil-claims",
    title: "SIL claims and payment changes from 1 July 2026",
    href: "https://www.ndis.gov.au/news/11576-sil-claims-and-payment-changes-1-july-2026",
    publishedOn: "2026-07-01",
    kind: "general",
    summary:
      "Supported independent living delivered from 1 July 2026 is claimed under registration group 0138, not 0115. Supports delivered before that date stay on 0115. From 1 October 2026, a provider who was delivering SIL and has not registered or applied under 0138 can only claim services up to 30 September 2026.",
  },
  {
    id: "sil-practice-standards",
    title: "Supported independent living Practice Standards",
    href: "https://www.ndiscommission.gov.au/practice-standards",
    publishedOn: "2026-07-01",
    kind: "policy",
    summary:
      "SIL providers must follow new NDIS Practice Standards for supported independent living from 1 July 2026, as well as the Core module. The new standards focus on the participant's voice, rights, and freedoms in the home. The wider Practice Standards review is still being considered.",
  },
  {
    id: "mandatory-registration",
    title: "Mandatory registration for SIL and digital platforms",
    href: "https://www.ndis.gov.au/news/11561-mandatory-registration-supported-independent-living-sil-and-ndis-digital-platform-providers",
    publishedOn: "2026-06-09",
    kind: "policy",
    summary:
      "SIL providers and NDIS digital platform providers must be registered, or have applied to register, by 1 October 2026. A participant's plan and funding do not change. If their SIL provider does not register, they need a registered provider. Choosing and rostering your own support workers is not SIL. Mandatory registration of support coordination is paused.",
  },
  {
    id: "federal-budget-2026",
    title: "Federal Budget and NDIS laws update",
    href: "https://www.ndis.gov.au/news/11545-federal-budget-and-ndis-laws-update",
    publishedOn: "2026-05-14",
    kind: "general",
    summary:
      "The 2026–27 Budget announced clearer eligibility through functional capacity assessments, a $200 million Inclusive Communities Fund, and work to slow cost growth and fraud. New framework planning is delayed until 1 April 2027. Thriving Kids is a joint program for children aged 8 and under with developmental delay or autism and low to moderate support needs.",
  },
]

export function ndisUpdate(id: string | undefined) {
  if (!id) return null
  return ndisUpdates.find((update) => update.id === id) ?? null
}

export function ndisUpdateKindLabel(kind: NdisUpdateKind) {
  switch (kind) {
    case "policy":
      return "Policy"
    case "general":
      return "General"
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

export function ndisUpdatePrompt(update: NdisUpdate) {
  return [
    "How does this NDIS update affect our organisation?",
    "",
    update.title,
    update.href,
    "",
    update.summary,
  ].join("\n")
}
