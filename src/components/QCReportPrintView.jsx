import React, { forwardRef } from 'react';

// Reuse your label, tolerance, and fields logic from the modal
const labelsEn = { /* …same as in QCReportView… */ };
const labelsRs = { /* …same as in QCReportView… */ };
const tolerances = { /* …same as in QCReportView… */ };
const measureFields = Object.keys(tolerances);

const QCReportPrintView = forwardRef(({ order, language }, ref) => {
  const isRS = language === 'rs';
  const labelsMap = isRS ? labelsRs : labelsEn;

  const {
    date = '',
    operator = '',
    comments = '',
    visualChecks = {},
    recheckedVisuals = {},
    measurements: actualMeasurements = {},
    recheckedMeasurements = {},
    approved = false
  } = order?.qcData || {};

  const clientName = order['Client Name'] || '';
  const orderId = order['Order ID'] || '';

  const visualFailedKeys = Object.keys(visualChecks).filter(
    (key) => visualChecks[key] === 'FAIL'
  );

  let recontrolAttempt = null;
  if (typeof order.Status === 'string') {
    const match = order.Status.match(/qc-recontrol\s*(\d+)/i);
    if (match) recontrolAttempt = parseInt(match[1], 10);
  }

  return (
    <div ref={ref} style={{
      fontFamily: 'Arial, sans-serif',
      color: '#111',
      padding: 32,
      maxWidth: 900
    }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <img
          src="/logo-dark.png"
          alt="NC Logo"
          style={{ height: 50, objectFit: 'contain' }}
        />
        <h2 style={{ fontSize: 22, fontWeight: 'bold', margin: 0, color: '#222' }}>
          {isRS ? 'QC Izveštaj' : 'QC Report'} – {orderId} | {clientName}
        </h2>
      </div>

      {/* Info */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        margin: '18px 0'
      }}>
        <div style={{ width: '48%' }}>
          <div style={{ fontWeight: 'bold' }}>
            {isRS ? 'QC Datum' : 'QC Date'}
          </div>
          <div style={{
            background: '#f2f2f2',
            padding: 8,
            borderRadius: 4
          }}>{date || '—'}</div>
        </div>
        <div style={{ width: '48%' }}>
          <div style={{ fontWeight: 'bold' }}>
            {isRS ? 'Operater' : 'Operator'}
          </div>
          <div style={{
            background: '#f2f2f2',
            padding: 8,
            borderRadius: 4
          }}>{operator || '—'}</div>
        </div>
      </div>

      <div style={{ fontWeight: 'bold' }}>
        {isRS ? 'Status' : 'Status'}:{' '}
        <span style={{
          marginLeft: 8,
          color: approved
            ? '#23a440'
            : (recontrolAttempt ? '#ffa500' : '#c82333')
        }}>
          {approved
            ? (isRS ? 'Odobreno' : 'Approved')
            : recontrolAttempt !== null
              ? (isRS
                ? `Rekontrola pokušaj #${recontrolAttempt}`
                : `Recontrol Attempt #${recontrolAttempt}`)
              : (isRS ? 'Nije odobreno' : 'Not Approved')}
        </span>
      </div>

      {/* Comments */}
      <div style={{ margin: '18px 0 6px 0', fontWeight: 'bold' }}>
        {isRS ? 'Komentari' : 'Comments'}
      </div>
      <div style={{
        background: '#f2f2f2',
        padding: 8,
        borderRadius: 4,
        minHeight: 36
      }}>{comments || '—'}</div>

      {/* Visual Inspection */}
      <div style={{
        marginTop: 22,
        marginBottom: 6,
        fontWeight: 'bold',
        fontSize: 16
      }}>
        {isRS ? 'Vizuelna kontrola' : 'Visual Inspection'}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 8,
        marginBottom: 16
      }}>
        {Object.entries(labelsMap).map(([key, label]) => {
          const result = visualChecks[key];
          const isPass = result === 'PASS';
          const isFail = result === 'FAIL';
          return (
            <div
              key={key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8f8f8',
                padding: 6,
                borderRadius: 4
              }}
            >
              <span style={{ color: '#222' }}>{label}</span>
              <span style={{
                color: isPass ? '#23a440' : (isFail ? '#c82333' : '#666'),
                fontWeight: 'bold'
              }}>
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

      {/* Visual recheck */}
      {visualFailedKeys.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{
            fontWeight: 'bold',
            color: '#c82333',
            fontSize: 14,
            marginBottom: 2
          }}>
            {isRS ? 'Rekontrola vizuelnih tačaka' : 'Visual Recheck'}
          </div>
          {visualFailedKeys.map((key) => {
            const reRes = recheckedVisuals[key];
            return (
              <div key={key} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f9e2e2',
                padding: 5,
                borderRadius: 4
              }}>
                <span>{labelsMap[key]}</span>
                <span style={{
                  color: reRes === 'Corrected' ? '#23a440' : '#c82333'
                }}>
                  {reRes === 'Corrected'
                    ? (isRS ? 'Ispravljeno' : 'Corrected')
                    : (isRS ? 'Nije ispravljeno' : 'Not Corrected')}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Measurements */}
      <div style={{ marginTop: 22, fontWeight: 'bold', fontSize: 16 }}>
        {isRS ? 'Merenja i tolerancije' : 'Measurements & Tolerances'}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2.5fr 1fr 1fr 1fr 1fr 1fr',
        gap: 4,
        fontWeight: 'bold',
        background: '#eee',
        padding: '5px 0',
        marginTop: 4
      }}>
        <span>{isRS ? 'Polje' : 'Field'}</span>
        <span>{isRS ? 'Očekivano' : 'Expected'}</span>
        <span>{isRS ? 'Tolerancija' : 'Tolerance'}</span>
        <span>{isRS ? 'Izmereno' : 'Measured'}</span>
        <span>Δ</span>
        <span>{isRS ? 'Prošlo?' : 'Pass?'}</span>
      </div>
      {measureFields.map((field) => {
        const expectedVal = parseFloat(order.measurements?.[field] || 0) || 0;
        const actualVal   = parseFloat(actualMeasurements[field] || 0) || 0;
        const diff        = parseFloat((actualVal - expectedVal).toFixed(2));
        const passes      = Math.abs(diff) <= tolerances[field];
        const displayField = field.replace(/([A-Z])/g, ' $1').trim();
        return (
          <div key={field} style={{
            display: 'grid',
            gridTemplateColumns: '2.5fr 1fr 1fr 1fr 1fr 1fr',
            gap: 4,
            background: '#f8f8f8',
            padding: '4px 0',
            color: '#111'
          }}>
            <span style={{ textTransform: 'capitalize' }}>{displayField}</span>
            <span>{!isNaN(expectedVal) ? expectedVal : '—'}</span>
            <span>±{tolerances[field]}</span>
            <span>{!isNaN(actualVal) ? actualVal : '—'}</span>
            <span>{!isNaN(diff) ? diff : '—'}</span>
            <span>
              {!isNaN(diff)
                ? (passes
                  ? <span style={{ color: '#23a440', fontWeight: 'bold' }}>✓</span>
                  : <span style={{ color: '#c82333', fontWeight: 'bold' }}>✗</span>)
                : '—'}
            </span>
          </div>
        );
      })}
      <div style={{
        marginTop: 24,
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: 15
      }}>
        {isRS ? 'Ukupni QC status:' : 'Overall QC status:'}{' '}
        <span style={{ color: approved ? '#23a440' : '#c82333' }}>
          {approved
            ? (isRS ? 'Odobreno' : 'Approved')
            : (isRS ? 'Nije odobreno' : 'Not Approved')}
        </span>
      </div>
    </div>
  );
});

export default QCReportPrintView;
