import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer"
import { format } from "date-fns"

import type { WorkerCompliance } from "@/modules/documents/compliance"
import type { EvidenceSection, OrganisationEvidence } from "@/modules/reports/dossier"
import { today } from "@/lib/today"

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 16, marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#555", marginBottom: 16 },
  heading: { fontSize: 12, marginTop: 12, marginBottom: 6 },
  row: { flexDirection: "row", marginBottom: 3, gap: 8 },
  label: { width: 90, color: "#555" },
  cell: { flex: 1 },
  tableHeader: { flexDirection: "row", borderBottom: "1 solid #222", paddingBottom: 3, marginBottom: 4 },
  tableRow: { flexDirection: "row", marginBottom: 3 },
  col: { flex: 1 },
})

type WorkerRow = {
  first_name: string
  last_name: string
  email: string
}

function EvidenceHeader({ organisationName, subtitle }: { organisationName: string; subtitle: string }) {
  return (
    <View>
      <Text style={styles.title}>Compliance evidence</Text>
      <Text style={styles.subtitle}>
        {organisationName} · {subtitle} · Generated {format(today(), "d MMM yyyy")}. This is evidence,
        not an audit certificate.
      </Text>
    </View>
  )
}

function EvidenceSectionView({ section }: { section: EvidenceSection }) {
  return (
    <View>
      <Text style={styles.heading}>{section.title}</Text>
      {section.rows.length === 0 ? (
        <Text>{section.empty}</Text>
      ) : (
        <View>
          <View style={styles.tableHeader}>
            {section.columns.map((column) => (
              <Text key={column} style={styles.col}>
                {column}
              </Text>
            ))}
          </View>
          {section.rows.map((row, index) => (
            <View key={`${section.title}-${index}`} style={styles.tableRow} wrap={false}>
              {row.map((cell, cellIndex) => (
                <Text key={`${section.title}-${index}-${cellIndex}`} style={styles.col}>
                  {cell}
                </Text>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

export async function organisationPdf(evidence: OrganisationEvidence) {
  return renderToBuffer(
    <Document title="Compliance evidence">
      <Page size="A4" orientation="landscape" style={styles.page}>
        <EvidenceHeader
          organisationName={evidence.organisationName}
          subtitle="Organisation pack"
        />
        <Text style={styles.subtitle}>
          Registration groups: {evidence.groups}. Audit pack {evidence.readiness}.
        </Text>
        {evidence.sections.map((section) => (
          <EvidenceSectionView key={section.title} section={section} />
        ))}
      </Page>
    </Document>
  )
}

export async function workerPdf(input: {
  worker: WorkerRow
  organisationName: string
  compliance: WorkerCompliance
  documents: Array<{
    typeName: string
    approval_status: string
    expires_on: string | null
    original_filename: string
    reviewer: string | null
  }>
}) {
  const workerName = `${input.worker.first_name} ${input.worker.last_name}`
  return renderToBuffer(
    <Document title="Compliance evidence">
      <Page size="A4" style={styles.page}>
        <EvidenceHeader organisationName={input.organisationName} subtitle={workerName} />
        <Text style={styles.heading}>Identity summary</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Worker</Text>
          <Text style={styles.cell}>{workerName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.cell}>{input.worker.email}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Overall</Text>
          <Text style={styles.cell}>
            {input.compliance.overall} · {input.compliance.percent}%
          </Text>
        </View>

        <Text style={styles.heading}>Required items</Text>
        {input.compliance.items.map((item) => (
          <View key={item.key} style={styles.row}>
            <Text style={styles.label}>{item.kind}</Text>
            <Text style={styles.cell}>
              {item.label} — {item.status}
              {item.expiresOn ? ` · ${item.expiresOn}` : ""}
            </Text>
          </View>
        ))}

        <Text style={styles.heading}>Documents</Text>
        {input.documents.length === 0 ? <Text>No documents on file.</Text> : null}
        {input.documents.map((doc) => (
          <View key={`${doc.typeName}-${doc.original_filename}`} style={styles.row} wrap={false}>
            <Text style={styles.cell}>
              {doc.typeName} · {doc.approval_status} · expiry {doc.expires_on ?? "none"} · reviewer{" "}
              {doc.reviewer ?? "—"} · {doc.original_filename}
            </Text>
          </View>
        ))}
      </Page>
    </Document>
  )
}
