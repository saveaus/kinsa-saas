import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { matchEvidence, type EvidenceType, type EvidenceWorker } from "@/modules/migration/match"

const workers: EvidenceWorker[] = [
  { id: "jordan", firstName: "Jordan", lastName: "Hale" },
  { id: "sam", firstName: "Sam", lastName: "Okonkwo" },
  { id: "lee", firstName: "Sam", lastName: "Lee" },
]

const types: EvidenceType[] = [
  { id: "aid", code: "first_aid", name: "First Aid" },
  { id: "cpr", code: "cpr", name: "CPR" },
  { id: "police", code: "police_check", name: "National Police Check" },
  { id: "screen", code: "ndis_worker_screening", name: "NDIS Worker Screening Check" },
  { id: "orient", code: "ndis_orientation", name: "NDIS Worker Orientation Module" },
]

describe("matchEvidence", () => {
  it("files a certificate from the file name", () => {
    const match = matchEvidence("Jordan Hale - First Aid 01.05.2027.pdf", workers, types)
    assert.equal(match.workerId, "jordan")
    assert.equal(match.typeId, "aid")
    assert.equal(match.expiresOn, "2027-05-01")
  })

  it("keeps a police check off CPR and orientation", () => {
    const match = matchEvidence("Sam Okonkwo National Police Check.pdf", workers, types)
    assert.equal(match.workerId, "sam")
    assert.equal(match.typeId, "police")
  })

  it("leaves a scan for a person when the name or type is missing", () => {
    assert.equal(matchEvidence("scan.pdf", workers, types).workerId, null)
    assert.equal(matchEvidence("Jordan Hale.pdf", workers, types).workerId, "jordan")
    assert.equal(matchEvidence("Jordan Hale.pdf", workers, types).typeId, null)
    assert.equal(matchEvidence("Sam First Aid.pdf", workers, types).workerId, null)
  })

  it("uses the screening phrase rather than orientation", () => {
    const match = matchEvidence("Jordan Hale NDIS Worker Screening.pdf", workers, types)
    assert.equal(match.typeId, "screen")
  })
})
