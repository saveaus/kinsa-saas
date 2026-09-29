import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer"
import { format, parseISO } from "date-fns"

import type { CourseCertificate } from "@/modules/training/certificate"

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: "Helvetica",
    color: "#111",
  },
  frame: {
    flex: 1,
    border: "2 solid #111",
    padding: 28,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    marginBottom: 24,
  },
  logo: {
    width: 64,
    height: 64,
    objectFit: "contain",
  },
  logoFallback: {
    width: 64,
    height: 64,
    backgroundColor: "#EEEEEE",
    alignItems: "center",
    justifyContent: "center",
  },
  logoFallbackText: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#555555",
  },
  orgName: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  meta: { fontSize: 9, color: "#444", marginTop: 4 },
  kicker: { fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 18 },
  body: { fontSize: 12, lineHeight: 1.5 },
  name: { fontSize: 20, fontFamily: "Helvetica-Bold", marginVertical: 10 },
  course: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 4 },
  footer: { fontSize: 8, color: "#555", marginTop: 24, lineHeight: 1.4 },
})

export async function courseCertificatePdf(certificate: CourseCertificate) {
  const completed = format(parseISO(certificate.completedOn), "d MMMM yyyy")
  return renderToBuffer(
    <Document title={`${certificate.courseTitle} certificate`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.frame}>
          <View>
            <View style={styles.header}>
              {certificate.logoDataUri ? (
                <Image src={certificate.logoDataUri} style={styles.logo} />
              ) : (
                <View style={styles.logoFallback}>
                  <Text style={styles.logoFallbackText}>
                    {certificate.organisationName
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0] ?? "")
                      .join("")
                      .toUpperCase() || "ORG"}
                  </Text>
                </View>
              )}
              <View>
                <Text style={styles.orgName}>{certificate.organisationName}</Text>
                <Text style={styles.meta}>
                  ABN {certificate.abnLabel} · {certificate.registrationLabel}
                </Text>
              </View>
            </View>
            <Text style={styles.kicker}>Certificate of completion</Text>
            <Text style={styles.title}>Training certificate</Text>
            <Text style={styles.body}>This certifies that</Text>
            <Text style={styles.name}>{certificate.workerName}</Text>
            <Text style={styles.body}>has completed</Text>
            <Text style={styles.course}>{certificate.courseTitle}</Text>
            <Text style={styles.body}>
              on {completed}
              {certificate.score != null ? ` with a score of ${certificate.score}%` : ""}.
              {certificate.validUntil ? ` Valid until ${certificate.validUntil}.` : ""}
            </Text>
          </View>
          <Text style={styles.footer}>
            Issued by {certificate.organisationName} in Kinsa. This records an in-app training pass. It does not
            replace a registered training organisation certificate, NDIS Worker Screening, the NDIS Worker Orientation
            Module, a Working with Children Check, first aid, CPR, or a practical competency sign-off.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
