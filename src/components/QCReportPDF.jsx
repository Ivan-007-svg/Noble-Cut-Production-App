import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

// Main styles: all Arial replaced with Helvetica
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#111',
    backgroundColor: '#fff',
    padding: 32,
  },
  logoContainer: {
    textAlign: 'center',
    marginBottom: 18,
  },
  logo: {
    height: 80,
    width: 240,
    objectFit: "contain",
    alignSelf: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 16,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoBox: {
    width: '48%',
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#444',
  },
  infoValue: {
    backgroundColor: '#f2f2f2',
    padding: 4,
    borderRadius: 4,
    color: '#222',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
    marginBottom: 4,
  },
  visualGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  visualItem: {
    width: '50%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f2f2f2',
    padding: 2,
    borderRadius: 4,
    marginBottom: 2,
  },
  visualLabel: {
    color: '#222',
  },
  visualPass: {
    color: '#23a440',
    fontWeight: 'bold',
  },
  visualFail: {
    color: '#c82333',
    fontWeight: 'bold',
  },
  visualRecheckLabel: {
    color: '#c82333',
    fontWeight: 'bold',
    marginTop: 8,
  },
  measureHeader: {
    flexDirection: 'row',
    backgroundColor: '#ddd',
    padding: 2,
    borderRadius: 4,
    marginBottom: 1,
  },
  measureHeaderText: {
    flex: 1,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#222',
  },
  measureRow: {
    flexDirection: 'row',
    backgroundColor: '#f2f2f2',
    padding: 4,
    borderRadius: 4,
    marginBottom: 2,
  },
  measureText: {
    flex: 1,
    fontSize: 10,
    color: '#222',
  },
  overall: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333',
  },
});

// Visual checks translation
const labelsEn = {
  stitchingClean: "Stitching clean?",
  threadsCut: "Threads cut?",
  collarAligned: "Collar aligned?",
  finalIroning: "Final ironing OK?",
  buttonsAligned: "Buttons aligned properly?",
  pocketPositioned: "Pocket positioned correctly?",
  labelPlacement: "Label placement OK?",
  packagingComplete: "Packaging complete?",
  monogramCorrect: "Monogram correct?",
  placketAligned: "Placket aligned properly?",
  buttonholesClean: "Buttonholes clean & sized?",
  cuffFusingOk: "Cuff & collar fusing OK?",
  sideSeamsStraight: "Side seams aligned & straight?",
  shirtSymmetry: "Shirt symmetry OK?",
};
const labelsRs = {
  stitchingClean: "Šavovi čisti?",
  threadsCut: "Konci odsečeni?",
  collarAligned: "Kragna poravnata?",
  finalIroning: "Završno peglanje OK?",
  buttonsAligned: "Dugmad poravnata?",
  pocketPositioned: "Džep pravilno postavljen?",
  labelPlacement: "Etiketa postavljena OK?",
  packagingComplete: "Pakovanje završeno?",
  monogramCorrect: "Monogram tačan?",
  placketAligned: "Lajsna poravnata?",
  buttonholesClean: "Rupice uredne?",
  cuffFusingOk: "Lepljenje kragne/manžetni OK?",
  sideSeamsStraight: "Bočni šavovi ravni?",
  shirtSymmetry: "Simetrija košulje OK?",
};

// Tolerances and fields
const tolerances = {
  neck: 0.5,
  chest: 1.0,
  waist: 1.0,
  hips: 1.0,
  shoulderWidth: 0.3,
  acrossShoulder: 1.0,
  backWidth: 1.0,
  sleeveLength: 0.7,
  bicep: 0.5,
  underElbow: 0.5,
  wristLeft: 0.3,
  wristRight: 0.3,
  shirtLength: 1.0,
};
const measureFields = Object.keys(tolerances);

const QCReportPDF = ({ order, language }) => {
  const isRS = language === "rs";
  const labelsMap = isRS ? labelsRs : labelsEn;

  const {
    'Order ID': orderId = '',
    'Client Name': clientName = '',
    expectedMeasurements = {},
    measurements = {},
    recheckedMeasurements = {},
    visualChecks = {},
    recheckedVisuals = {},
    qcDate = '',
    qcOperator = '',
    qcComments = '',
    qcApproved = false,
    recontrolAttempt = null,
  } = order || {};

  // Visual failed keys
  const visualFailedKeys = Object.keys(visualChecks).filter(
    (key) => visualChecks[key] === "FAIL"
  );

  return (
    <Document>
      <Page style={styles.page}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image style={styles.logo} src="/logo-dark.png" />
        </View>

        {/* Title */}
        <Text style={styles.title}>
          {(isRS ? "QC Izveštaj" : "QC Report") + " – " + orderId + " | " + clientName}
        </Text>

        {/* Info */}
        <View style={styles.infoRow}>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>{isRS ? "QC Datum odobrenja" : "QC Approval Date"}</Text>
            <Text style={styles.infoValue}>{qcDate || "—"}</Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>{isRS ? "Operater" : "Operator"}</Text>
            <Text style={styles.infoValue}>{qcOperator || "—"}</Text>
          </View>
        </View>

        {/* Status */}
        <Text style={styles.infoLabel}>
          {isRS ? "Status" : "Status"}:{" "}
          <Text
            style={{
              color: qcApproved
                ? "#23a440"
                : recontrolAttempt
                ? "#ffa500"
                : "#c82333",
            }}
          >
            {qcApproved
              ? isRS
                ? "Odobreno"
                : "Approved"
              : recontrolAttempt !== null
              ? isRS
                ? `Rekontrola pokušaj #${recontrolAttempt}`
                : `Recontrol Attempt #${recontrolAttempt}`
              : isRS
              ? "Nije odobreno"
              : "Not Approved"}
          </Text>
        </Text>

        {/* Comments */}
        <Text style={styles.infoLabel}>{isRS ? "Komentari" : "Comments"}</Text>
        <Text style={styles.infoValue}>{qcComments || "—"}</Text>

        {/* Visual Inspection */}
        <Text style={styles.sectionTitle}>
          {isRS ? "Vizuelna kontrola" : "Visual Inspection"}
        </Text>
        <View style={styles.visualGrid}>
          {Object.entries(labelsMap).map(([key, label]) => {
            const result = visualChecks[key];
            const isPass = result === "PASS";
            const isFail = result === "FAIL";
            return (
              <View key={key} style={styles.visualItem}>
                <Text style={styles.visualLabel}>{label}</Text>
                <Text style={isPass ? styles.visualPass : isFail ? styles.visualFail : {}}>
                  {isPass
                    ? isRS
                      ? "PROŠLO"
                      : "PASS"
                    : isFail
                    ? isRS
                      ? "NE PROŠLO"
                      : "FAIL"
                    : "—"}
                </Text>
              </View>
            );
          })}
        </View>
        {/* Visual Recheck */}
        {visualFailedKeys.length > 0 && (
          <>
            <Text style={styles.visualRecheckLabel}>
              {isRS ? "Rekontrola vizuelnih tačaka" : "Visual Recheck"}
            </Text>
            {visualFailedKeys.map((key) => {
              const reRes = typeof recheckedVisuals[key] !== "undefined" ? recheckedVisuals[key] : null;
              return (
                <View key={key} style={styles.visualItem}>
                  <Text style={styles.visualLabel}>{labelsMap[key]}</Text>
                  <Text
                    style={
                      reRes === "Corrected"
                        ? styles.visualPass
                        : reRes === "Not Corrected"
                        ? styles.visualFail
                        : { color: "#aaa" }
                    }
                  >
                    {reRes === "Corrected"
                      ? isRS
                        ? "Ispravljeno"
                        : "Corrected"
                      : reRes === "Not Corrected"
                      ? isRS
                        ? "Nije ispravljeno"
                        : "Not Corrected"
                      : isRS
                      ? "Nije provereno"
                      : "Not Checked"}
                  </Text>
                </View>
              );
            })}
          </>
        )}

        {/* Measurements Table */}
        <Text style={styles.sectionTitle}>
          {isRS ? "Merenja i tolerancije" : "Measurements & Tolerances"}
        </Text>
        <View style={styles.measureHeader}>
          <Text style={styles.measureHeaderText}>{isRS ? "Polje" : "Field"}</Text>
          <Text style={styles.measureHeaderText}>{isRS ? "Očekivano" : "Expected"}</Text>
          <Text style={styles.measureHeaderText}>{isRS ? "Tolerancija" : "Tolerance"}</Text>
          <Text style={styles.measureHeaderText}>{isRS ? "Izmereno" : "Measured"}</Text>
          <Text style={styles.measureHeaderText}>Δ</Text>
          <Text style={styles.measureHeaderText}>{isRS ? "Prošlo?" : "Pass?"}</Text>
        </View>
        {measureFields.map((field) => {
          const recheckedVal = recheckedMeasurements && typeof recheckedMeasurements[field] !== 'undefined'
            ? parseFloat(recheckedMeasurements[field])
            : undefined;
          const actualVal = (typeof recheckedVal !== 'undefined' && !isNaN(recheckedVal))
            ? recheckedVal
            : (parseFloat(measurements[field] || 0) || 0);
          const expectedVal = parseFloat(expectedMeasurements?.[field] || 0) || 0;
          const diff = parseFloat((actualVal - expectedVal).toFixed(2));
          const passes = Math.abs(diff) <= tolerances[field];
          const displayField = field.replace(/([A-Z])/g, " $1").trim();
          return (
            <View key={field} style={styles.measureRow}>
              <Text style={styles.measureText}>{displayField}</Text>
              <Text style={styles.measureText}>{!isNaN(expectedVal) ? expectedVal : "—"}</Text>
              <Text style={styles.measureText}>±{tolerances[field]}</Text>
              <Text style={styles.measureText}>{!isNaN(actualVal) ? actualVal : "—"}</Text>
              <Text style={styles.measureText}>{!isNaN(diff) ? diff : "—"}</Text>
              <Text
                style={[
                  styles.measureText,
                  { fontWeight: 'bold', color: passes ? "#23a440" : "#c82333" },
                ]}
              >
                {!isNaN(diff)
                  ? passes
                    ? isRS
                      ? "DA"
                      : "YES"
                    : isRS
                    ? "NE"
                    : "NO"
                  : "—"}
              </Text>
            </View>
          );
        })}

        {/* Overall QC Status */}
        <Text style={styles.overall}>
          {isRS ? "Ukupni QC status:" : "Overall QC status:"}{" "}
          <Text style={{ color: qcApproved ? "#23a440" : "#c82333" }}>
            {qcApproved
              ? isRS
                ? "Odobreno"
                : "Approved"
              : isRS
              ? "Nije odobreno"
              : "Not Approved"}
          </Text>
        </Text>
      </Page>
    </Document>
  );
};

export default QCReportPDF;
