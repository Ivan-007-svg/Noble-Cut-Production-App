import React, { useState, forwardRef, useRef } from 'react';
import { Dialog } from '@headlessui/react';
import { Printer, Download, Mail } from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import QCReportPDF from './QCReportPDF';

// --- LABELS/TOLERANCES ---
const labelsEn = {
  stitchingClean: 'Stitching clean?',
  threadsCut: 'Threads cut?',
  collarAligned: 'Collar aligned?',
  finalIroning: 'Final ironing OK?',
  buttonsAligned: 'Buttons aligned properly?',
  pocketPositioned: 'Pocket positioned correctly?',
  labelPlacement: 'Label placement OK?',
  packagingComplete: 'Packaging complete?',
  monogramCorrect: 'Monogram correct?',
  placketAligned: 'Placket aligned properly?',
  buttonholesClean: 'Buttonholes clean & sized?',
  cuffFusingOk: 'Cuff & collar fusing OK?',
  sideSeamsStraight: 'Side seams aligned & straight?',
  shirtSymmetry: 'Shirt symmetry OK?'
};
const labelsRs = {
  stitchingClean: 'Šavovi čisti?',
  threadsCut: 'Konci odsečeni?',
  collarAligned: 'Kragna poravnata?',
  finalIroning: 'Završno peglanje OK?',
  buttonsAligned: 'Dugmad poravnata?',
  pocketPositioned: 'Džep pravilno postavljen?',
  labelPlacement: 'Etiketa postavljena OK?',
  packagingComplete: 'Pakovanje završeno?',
  monogramCorrect: 'Monogram tačan?',
  placketAligned: 'Lajsna poravnata?',
  buttonholesClean: 'Rupice uredne?',
  cuffFusingOk: 'Lepljenje kragne/manžetni OK?',
  sideSeamsStraight: 'Bočni šavovi ravni?',
  shirtSymmetry: 'Simetrija košulje OK?'
};
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
  shirtLength: 1.0
};
const measureFields = Object.keys(tolerances);
const STATUS_APPROVED = ['packing', 'delivered'];

const getReportApproved = (order, latestQCAttempt) => {
  if (!order) return false;
  if (order.Status && typeof order.Status === 'string') {
    const statusLc = order.Status.trim().toLowerCase();
    if (STATUS_APPROVED.includes(statusLc)) return true;
  }
  return !!latestQCAttempt?.approved;
};

const getReportStatusText = (order, isRS, latestQCAttempt) => {
  if (!order) return isRS ? 'Nije odobreno' : 'Not Approved';
  const statusLc = order.Status ? order.Status.trim().toLowerCase() : '';
  if (STATUS_APPROVED.includes(statusLc)) {
    return isRS ? 'Odobreno' : 'Approved';
  }
  const match = typeof order.Status === 'string' ? order.Status.match(/qc-recontrol\s*(\d+)/i) : null;
  if (match) {
    return isRS
      ? `Rekontrola pokušaj #${parseInt(match[1], 10)}`
      : `Recontrol Attempt #${parseInt(match[1], 10)}`;
  }
  if (!!latestQCAttempt?.approved) {
    return isRS ? 'Odobreno' : 'Approved';
  }
  return isRS ? 'Nije odobreno' : 'Not Approved';
};

const QCReportView = forwardRef(({ order, isOpen, onClose }, ref) => {
if (!order) return null;
  const [language, setLanguage] = useState('en');
  const hiddenMailRef = useRef(null);
  const [mailHref, setMailHref] = useState("");
  const isRS = language === 'rs';
  const labelsMap = isRS ? labelsRs : labelsEn;

  // --- Find latest QC attempt ---
  const latestQCAttempt = order.qcAttempts && order.qcAttempts.length > 0
    ? order.qcAttempts[order.qcAttempts.length - 1]
    : order.qcData || {};

  // --- Extract data from latest QC attempt ---
  const {
    date = '',
    operator = '',
    comments = '',
    visualChecks = {},
    recheckedVisuals = {},
    measurements: actualMeasurements = {},
    recheckedMeasurements = {},
    approved = false
  } = latestQCAttempt;

  // Identify which visual checks failed
  const visualFailedKeys = Object.keys(visualChecks).filter(
    (key) => visualChecks[key] === 'FAIL'
  );

  // ----------- FIX: Use correct approved logic everywhere --------
  const reportApproved = getReportApproved(order, latestQCAttempt);
  const reportStatusText = getReportStatusText(order, isRS, latestQCAttempt);

  // --- Print handler ---
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>QC Report – ${order['Order ID']} ${order['Client Name']}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111; background: #fff; padding: 32px; }
            .logo { text-align: center; margin-bottom: 18px; }
            .logo img { height: 70px; }
            .qc-title { text-align: center; font-size: 22px; font-weight: bold; color: #222; margin-bottom: 0; }
            .info { display: flex; justify-content: space-between; margin: 18px 0; }
            .info-box { width: 48%; }
            .info-label { font-weight: bold; margin-bottom: 4px; }
            .info-value { background: #f2f2f2; padding: 8px; border-radius: 4px; }
            .section-title { font-size: 16px; font-weight: bold; color: #333; margin-top: 22px; margin-bottom: 6px; }
            .visual-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 16px; }
            .visual-item { display: flex; justify-content: space-between; align-items: center; background: #f8f8f8; padding: 6px; border-radius: 4px; }
            .visual-pass { color: #23a440; font-weight: bold; }
            .visual-fail { color: #c82333; font-weight: bold; }
            .visual-recheck { color: #c82333; font-weight: bold; font-size: 14px; margin-top: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
            th { background: #f0f0f0; }
            tr:nth-child(even) { background: #f9f9f9; }
            .overall { margin-top: 24px; text-align: center; font-weight: bold; font-size: 15px; }
          </style>
        </head>
        <body>
          <div class="logo"><img src="/logo-dark.png" alt="NC Logo" /></div>
          <div class="qc-title">${isRS ? 'QC Izveštaj' : 'QC Report'} – ${order['Order ID']} | ${order['Client Name']}</div>
          <div class="info">
            <div class="info-box">
              <div class="info-label">${isRS ? 'QC Datum odobrenja' : 'QC Approval Date'}</div>
              <div class="info-value">${date || '—'}</div>
            </div>
            <div class="info-box">
              <div class="info-label">${isRS ? 'Operater' : 'Operator'}</div>
              <div class="info-value">${operator || '—'}</div>
            </div>
          </div>
          <div style="font-weight:bold">${isRS ? 'Status' : 'Status'}:
            <span style="margin-left:8px; color: ${reportApproved ? '#23a440' : '#c82333'}">
              ${reportStatusText}
            </span>
          </div>
          <div style="margin:18px 0 6px 0; font-weight:bold">${isRS ? 'Komentari' : 'Comments'}</div>
          <div style="background:#f2f2f2; padding:8px; border-radius:4px; min-height:36px">${comments || '—'}</div>
          <div class="section-title">${isRS ? 'Vizuelna kontrola' : 'Visual Inspection'}</div>
          <div class="visual-grid">
            ${Object.entries(labelsMap).map(([key, label]) => {
              const result = visualChecks[key];
              const isPass = result === 'PASS';
              const isFail = result === 'FAIL';
              return `
                <div class="visual-item">
                  <span>${label}</span>
                  <span class="${isPass ? 'visual-pass' : isFail ? 'visual-fail' : ''}">
                    ${
                      isPass
                        ? (isRS ? 'PROŠLO' : 'PASS')
                        : isFail
                          ? (isRS ? 'NE PROŠLO' : 'FAIL')
                          : '—'
                    }
                  </span>
                </div>
              `;
            }).join('')}
          </div>
          ${
            visualFailedKeys.length > 0
              ? `
                <div class="visual-recheck">${isRS ? 'Rekontrola vizuelnih tačaka' : 'Visual Recheck'}</div>
                ${visualFailedKeys.map((key) => {
                  const reRes = typeof recheckedVisuals[key] !== "undefined" ? recheckedVisuals[key] : null;
                  return `
                    <div class="visual-item" style="background:#f9e2e2">
                      <span>${labelsMap[key]}</span>
                      <span style="color:${reRes === 'Corrected' ? '#23a440' : reRes === 'Not Corrected' ? '#c82333' : '#aaa'}">
                        ${
                          reRes === 'Corrected'
                            ? (isRS ? 'Ispravljeno' : 'Corrected')
                            : reRes === 'Not Corrected'
                            ? (isRS ? 'Nije ispravljeno' : 'Not Corrected')
                            : (isRS ? 'Nije provereno' : 'Not Checked')
                        }
                      </span>
                    </div>
                  `;
                }).join('')}
              `
              : ''
          }
          <div class="section-title">${isRS ? 'Merenja i tolerancije' : 'Measurements & Tolerances'}</div>
          <table>
            <thead>
              <tr>
                <th>${isRS ? 'Polje' : 'Field'}</th>
                <th>${isRS ? 'Očekivano' : 'Expected'}</th>
                <th>${isRS ? 'Tolerancija' : 'Tolerance'}</th>
                <th>${isRS ? 'Izmereno' : 'Measured'}</th>
                <th>Δ</th>
                <th>${isRS ? 'Prošlo?' : 'Pass?'}</th>
              </tr>
            </thead>
            <tbody>
              ${measureFields.map((field) => {
                const recheckedVal = recheckedMeasurements && typeof recheckedMeasurements[field] !== 'undefined'
                  ? parseFloat(recheckedMeasurements[field])
                  : undefined;
                const actualVal = (typeof recheckedVal !== 'undefined' && !isNaN(recheckedVal))
                  ? recheckedVal
                  : (parseFloat(actualMeasurements[field] || 0) || 0);
                const expectedVal = parseFloat(order.measurements?.[field] || 0) || 0;
                const diff = parseFloat((actualVal - expectedVal).toFixed(2));
                const passes = Math.abs(diff) <= tolerances[field];
                const displayField = field.replace(/([A-Z])/g, ' $1').trim();
                return `
                  <tr>
                    <td>${displayField}</td>
                    <td>${!isNaN(expectedVal) ? expectedVal : '—'}</td>
                    <td>±${tolerances[field]}</td>
                    <td>${!isNaN(actualVal) ? actualVal : '—'}</td>
                    <td>${!isNaN(diff) ? diff : '—'}</td>
                    <td style="font-weight:bold;color:${passes ? '#23a440' : '#c82333'}">
                      ${!isNaN(diff)
                        ? (passes
                          ? (isRS ? 'DA' : 'YES')
                          : (isRS ? 'NE' : 'NO'))
                        : '—'}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          <div class="overall">
            ${isRS ? 'Ukupni QC status:' : 'Overall QC status:'}
            <span style="color:${reportApproved ? '#23a440' : '#c82333'}">
              ${reportApproved
                ? (isRS ? 'Odobreno' : 'Approved')
                : (isRS ? 'Nije odobreno' : 'Not Approved')
              }
            </span>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    setTimeout(() => printWindow.close(), 500);
  };

  // --- Send by email handler (fixed-width text table) ---
  const handleSendEmail = () => {
    const col = (txt, len) => (txt + ' '.repeat(len)).slice(0, len);
    const pad = (num, len) => {
      const t = typeof num === 'number' ? num.toFixed(2) : num;
      return col(t, len);
    };
    let lines = [];
    lines.push(isRS ? 'QC Izveštaj' : 'QC Report');
    lines.push('');
    lines.push(`${isRS ? 'Narudžbina:' : 'Order:'} ${order['Order ID']}`);
    lines.push(`${isRS ? 'Klijent:' : 'Client:'} ${order['Client Name']}`);
    lines.push(`${isRS ? 'QC Datum odobrenja:' : 'QC Approval Date:'} ${date}`);
    lines.push(`${isRS ? 'Operater:' : 'Operator:'} ${operator}`);
    lines.push('');
    lines.push(isRS ? '--- Vizuelna kontrola ---' : '--- Visual Inspection ---');
    Object.entries(labelsMap).forEach(([key, label]) => {
      const res = visualChecks[key] || '—';
      const passText = res === 'PASS'
        ? (isRS ? 'PROŠLO' : 'PASS')
        : res === 'FAIL'
          ? (isRS ? 'NE PROŠLO' : 'FAIL')
          : '—';
      lines.push(`${label}: ${passText}`);
    });
    lines.push('');
    lines.push(isRS ? '--- Merenja i tolerancije ---' : '--- Measurements & Tolerances ---');
    lines.push(
      col(isRS ? 'Polje' : 'Field', 18) +
      col(isRS ? 'Očekivano' : 'Expected', 11) +
      col(isRS ? 'Toler.' : 'Tol.', 8) +
      col(isRS ? 'Izmereno' : 'Measured', 11) +
      col('Δ', 8) +
      col(isRS ? 'Prošlo?' : 'Pass?', 8)
    );
    lines.push('-'.repeat(64));
    measureFields.forEach((field) => {
      const recheckedVal = recheckedMeasurements && typeof recheckedMeasurements[field] !== 'undefined'
        ? parseFloat(recheckedMeasurements[field])
        : undefined;
      const actualVal = (typeof recheckedVal !== 'undefined' && !isNaN(recheckedVal))
        ? recheckedVal
        : (parseFloat(actualMeasurements[field] || 0) || 0);
      const expected = parseFloat(order.measurements?.[field] || 0) || 0;
      const diff = parseFloat((actualVal - expected).toFixed(2));
      const passes = Math.abs(diff) <= tolerances[field];
      const passText = passes ? (isRS ? 'DA' : 'YES') : (isRS ? 'NE' : 'NO');
      const displayField = field.replace(/([A-Z])/g, ' $1').trim();
      lines.push(
        col(displayField, 18) +
        pad(expected, 11) +
        col('±' + tolerances[field], 8) +
        pad(actualVal, 11) +
        pad(diff, 8) +
        col(passText, 8)
      );
    });
    lines.push('');
    lines.push(isRS
      ? `Ukupni QC status: ${reportApproved ? 'Odobreno' : 'Nije odobreno'}`
      : `Overall QC status: ${reportApproved ? 'Approved' : 'Not Approved'}`
    );
    const subject = encodeURIComponent(`QC Report – ${order['Order ID']} ${order['Client Name']}`);
    const body = encodeURIComponent(lines.join('\n'));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // --- Render Modal ---
  return (
    <Dialog open={isOpen} onClose={onClose}>
      {isOpen && <div className="fixed inset-0 bg-black bg-opacity-70 z-40" />}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            ref={ref}
            className="bg-white text-black rounded-xl w-full max-w-4xl border border-gray-300 overflow-y-auto max-h-[90vh] p-6 shadow-xl"
          >
            {/* Header & Controls */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">
                {isRS ? 'QC Izveštaj' : 'QC Report'} – {order['Order ID']}
                <span className="text-base text-gray-500"> | {order['Client Name']}</span>
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLanguage((prev) => (prev === 'en' ? 'rs' : 'en'))}
                  className="text-sm text-gray-800 border border-gray-400 px-3 py-1 rounded"
                  type="button"
                >
                  {language === 'en' ? 'RS' : 'EN'}
                </button>
                <button
                  onClick={onClose}
                  className="ml-2 text-gray-800 border border-gray-400 px-3 py-1 rounded"
                  type="button"
                >
                  {isRS ? 'Zatvori' : 'Close'}
                </button>
              </div>
            </div>

            {/* Logo */}
            <div className="flex justify-center mb-6">
              <img
                src="/logo-dark.png"
                alt="Noble Cut Logo"
                className="h-20"
                style={{ objectFit: 'contain' }}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-center mb-6">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded"
                type="button"
              >
                <Printer size={16} /> {isRS ? 'Štampaj' : 'Print'}
              </button>
              <PDFDownloadLink
  document={
    <QCReportPDF
      order={{
        'Order ID': order && order['Order ID'] ? order['Order ID'] : '',
        'Client Name': order && order['Client Name'] ? order['Client Name'] : '',
        expectedMeasurements: order && order.measurements && typeof order.measurements === 'object' ? order.measurements : {},
        measurements: latestQCAttempt.measurements || {},
        recheckedMeasurements: latestQCAttempt.recheckedMeasurements || {},
        visualChecks: latestQCAttempt.visualChecks || {},
        recheckedVisuals: latestQCAttempt.recheckedVisuals || {},
        qcDate: latestQCAttempt.date || '',
        qcOperator: latestQCAttempt.operator || '',
        qcComments: latestQCAttempt.comments || '',
        qcApproved: latestQCAttempt.approved || false,
        recontrolAttempt: (order && typeof order.Status === 'string' && order.Status.match(/qc-recontrol\s*(\d+)/i))
          ? parseInt(order.Status.match(/qc-recontrol\s*(\d+)/i)[1], 10)
          : null,
      }}
      language={language}
    />
  }
  fileName={`QC_Report_${order && order['Order ID'] ? order['Order ID'] : ''}_${order && order['Client Name'] ? order['Client Name'].replace(/\s+/g, '_') : ''}.pdf`}
>

                {({ loading, url, error }) => {
                  if (loading) return isRS ? "Priprema PDF..." : "Generating PDF…";
                  if (error)   return isRS ? "Greška pri PDF-u" : "Error generating PDF";
                  return (
                    <a
                      href={url}
                      download={`QC_Report_${order && order['Order ID'] ? order['Order ID'] : ''}_${order && order['Client Name'] ? order['Client Name'].replace(/\s+/g, '_') : ''}.pdf`}
                      className="flex items-center gap-1 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download size={16} />
                      <span className="ml-2">{isRS ? "Preuzmi PDF" : "Download PDF"}</span>
                    </a>
                  );
                }}
              </PDFDownloadLink>
              <button
                onClick={handleSendEmail}
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded"
                type="button"
              >
                <Mail size={16} /> {isRS ? 'Pošalji e-poštom' : 'Send by E-mail'}
              </button>
              <a
                ref={hiddenMailRef}
                href={mailHref}
                style={{ display: 'none' }}
                tabIndex={-1}
              />
            </div>

            {/* QC INFO */}
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    {isRS ? 'QC Datum odobrenja' : 'QC Approval Date'}
                  </label>
                  <div className="bg-gray-100 text-gray-800 p-2 rounded">{date || '—'}</div>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    {isRS ? 'Operater' : 'Operator'}
                  </label>
                  <div className="bg-gray-100 text-gray-800 p-2 rounded">{operator || '—'}</div>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    {isRS ? 'Status' : 'Status'}
                  </label>
                  <div className="bg-gray-100 text-gray-800 p-2 rounded">
                    {reportStatusText}
                  </div>
                </div>
              </div>

              {/* Comments */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  {isRS ? 'Komentari' : 'Comments'}
                </label>
                <div className="bg-gray-100 text-gray-800 p-2 rounded whitespace-pre-wrap">
                  {comments || '—'}
                </div>
              </div>

              {/* Visual Inspection */}
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {isRS ? 'Vizuelna kontrola' : 'Visual Inspection'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {Object.entries(labelsMap).map(([key, label]) => {
                    const result = visualChecks[key];
                    const isPass = result === 'PASS';
                    const isFail = result === 'FAIL';
                    return (
                      <div
                        key={key}
                        className="flex justify-between items-center p-2 bg-gray-100 rounded"
                      >
                        <span className="text-gray-800">{label}</span>
                        <span
                          className={
                            isPass
                              ? 'text-green-600'
                              : isFail
                              ? 'text-red-600'
                              : 'text-gray-500'
                          }
                        >
                          {isPass
                            ? (isRS ? 'PROŠLO' : 'PASS')
                            : isFail
                            ? (isRS ? 'NE PROŠLO' : 'FAIL')
                            : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {visualFailedKeys.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-lg font-semibold text-red-600 mb-2">
                      {isRS ? 'Rekontrola vizuelnih tačaka' : 'Visual Recheck'}
                    </h4>
                    <div className="space-y-2 text-sm">
                      {visualFailedKeys.map((key) => {
                        const reRes = typeof recheckedVisuals[key] !== "undefined" ? recheckedVisuals[key] : null;
                        return (
                          <div
                            key={key}
                            className="flex justify-between items-center p-2 bg-gray-100 rounded"
                          >
                            <span className="text-gray-800">{labelsMap[key]}</span>
                            <span
                              className={
                                reRes === 'Corrected'
                                  ? 'text-green-600'
                                  : reRes === 'Not Corrected'
                                  ? 'text-red-600'
                                  : 'text-gray-500'
                              }
                            >
                              {reRes === 'Corrected'
                                ? (isRS ? 'Ispravljeno' : 'Corrected')
                                : reRes === 'Not Corrected'
                                ? (isRS ? 'Nije ispravljeno' : 'Not Corrected')
                                : (isRS ? 'Nije provereno' : 'Not Checked')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Measurements & Tolerances Table */}
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {isRS ? 'Merenja i tolerancije' : 'Measurements & Tolerances'}
                </h3>
                <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-2 py-1 font-semibold">{isRS ? 'Polje' : 'Field'}</th>
                        <th className="px-2 py-1 font-semibold">{isRS ? 'Očekivano' : 'Expected'}</th>
                        <th className="px-2 py-1 font-semibold">{isRS ? 'Tolerancija' : 'Tolerance'}</th>
                        <th className="px-2 py-1 font-semibold">{isRS ? 'Izmereno' : 'Measured'}</th>
                        <th className="px-2 py-1 font-semibold">Δ</th>
                        <th className="px-2 py-1 font-semibold">{isRS ? 'Prošlo?' : 'Pass?'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {measureFields.map((field) => {
                        const recheckedVal = recheckedMeasurements && typeof recheckedMeasurements[field] !== 'undefined'
                          ? parseFloat(recheckedMeasurements[field])
                          : undefined;
                        const actualVal = (typeof recheckedVal !== 'undefined' && !isNaN(recheckedVal))
                          ? recheckedVal
                          : (parseFloat(actualMeasurements[field] || 0) || 0);
                        const expectedVal = parseFloat(order.measurements?.[field] || 0) || 0;
                        const diff = parseFloat((actualVal - expectedVal).toFixed(2));
                        const passes = Math.abs(diff) <= tolerances[field];
                        const displayField = field.replace(/([A-Z])/g, ' $1').trim();
                        return (
                          <tr key={field} className="bg-white even:bg-gray-50">
                            <td className="px-2 py-1">{displayField}</td>
                            <td className="px-2 py-1">{!isNaN(expectedVal) ? expectedVal : '—'}</td>
                            <td className="px-2 py-1">±{tolerances[field]}</td>
                            <td className="px-2 py-1">{!isNaN(actualVal) ? actualVal : '—'}</td>
                            <td className="px-2 py-1">{!isNaN(diff) ? diff : '—'}</td>
                            <td className="px-2 py-1">
                              {!isNaN(diff) ? (
                                passes ? (
                                  <span className="text-green-700 font-bold">{isRS ? 'DA' : 'YES'}</span>
                                ) : (
                                  <span className="text-red-700 font-bold">{isRS ? 'NE' : 'NO'}</span>
                                )
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 text-center text-sm font-semibold">
                  <span className="text-gray-800">
                    {isRS ? 'Ukupni QC status:' : 'Overall QC status:'}{' '}
                  </span>
                  <span className={reportApproved ? 'text-green-600' : 'text-red-600'}>
                    {reportApproved
                      ? (isRS ? 'Odobreno' : 'Approved')
                      : (isRS ? 'Nije odobreno' : 'Not Approved')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
});

export default QCReportView;
