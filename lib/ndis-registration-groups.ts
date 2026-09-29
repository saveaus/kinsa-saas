/** Official NDIS registration groups / classes of support (Commission list, July 2026). */
export const NDIS_REGISTRATION_GROUPS = [
  { code: "0101", name: "Accommodation/tenancy assistance" },
  { code: "0102", name: "Assistance to access and maintain employment or higher education" },
  { code: "0103", name: "Assistive products for personal care and safety" },
  { code: "0104", name: "High Intensity Daily Personal Activities" },
  { code: "0105", name: "Personal mobility equipment" },
  { code: "0106", name: "Assistance in coordinating or managing life stages, transitions and supports" },
  { code: "0107", name: "Assistance with daily personal activities" },
  { code: "0108", name: "Assistance with travel/transport arrangements" },
  { code: "0109", name: "Vehicle modifications" },
  { code: "0110", name: "Specialist positive behaviour support" },
  { code: "0111", name: "Home modifications" },
  { code: "0112", name: "Assistive equipment for recreation" },
  { code: "0113", name: "Vision equipment" },
  { code: "0114", name: "Community nursing care" },
  { code: "0115", name: "Assistance with daily life tasks in a group or shared living arrangement" },
  { code: "0116", name: "Innovative community participation" },
  { code: "0117", name: "Development of daily living and life skills" },
  { code: "0118", name: "Early intervention supports for early childhood" },
  { code: "0119", name: "Specialised hearing services" },
  { code: "0120", name: "Household tasks" },
  { code: "0121", name: "Interpreting and translation" },
  { code: "0122", name: "Hearing equipment" },
  { code: "0123", name: "Assistive products for household tasks" },
  { code: "0124", name: "Communication and information equipment" },
  { code: "0125", name: "Participation in community, social and civic activities" },
  { code: "0126", name: "Exercise physiology and personal training" },
  { code: "0127", name: "Management of funding for supports in participant plans" },
  { code: "0128", name: "Therapeutic supports" },
  { code: "0129", name: "Specialised driver training" },
  { code: "0130", name: "Assistance animals" },
  { code: "0131", name: "Specialist disability accommodation" },
  { code: "0132", name: "Specialised support coordination" },
  { code: "0133", name: "Specialised supported employment" },
  { code: "0134", name: "Hearing services" },
  { code: "0135", name: "Customised prosthetics" },
  { code: "0136", name: "Group and centre-based activities" },
  { code: "0137", name: "Providing an NDIS digital platform service" },
  { code: "0138", name: "Assistance with supported independent living" },
] as const

export type NdisRegistrationGroupCode = (typeof NDIS_REGISTRATION_GROUPS)[number]["code"]

const codeSet = new Set<string>(NDIS_REGISTRATION_GROUPS.map((group) => group.code))

export function isNdisRegistrationGroupCode(value: string): value is NdisRegistrationGroupCode {
  return codeSet.has(value)
}

export function parseRegistrationGroups(formData: FormData): NdisRegistrationGroupCode[] {
  const values = formData
    .getAll("registration_groups")
    .map((value) => String(value))
    .filter(isNdisRegistrationGroupCode)
  return NDIS_REGISTRATION_GROUPS.map((group) => group.code).filter((code) => values.includes(code))
}

export function registrationGroupLabel(code: string) {
  const group = NDIS_REGISTRATION_GROUPS.find((item) => item.code === code)
  return group ? `${group.code} · ${group.name}` : code
}

export function asRegistrationGroups(value: unknown): NdisRegistrationGroupCode[] {
  if (!Array.isArray(value)) return []
  return value.map(String).filter(isNdisRegistrationGroupCode)
}
