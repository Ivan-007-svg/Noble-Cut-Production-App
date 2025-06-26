import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { Check, X } from 'lucide-react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Helper to parse “qc-recontrol N” → N
function parseRecontrolNumber(status) {
  if (!status) return 0;
  const lc = status.toLowerCase();
  if (!lc.startsWith('qc-recontrol')) return 0;
  const parts = lc.split(' ');
  const num = parseInt(parts[1], 10);
  return isNaN(num) ? 0 : num;
}

export default function QCFormModal({ isOpen, onClose, order }) {
  // ─── LOCAL STATE ─────────────────────────────────────────────────────────────
  const [language, setLanguage] = useState('en');
  const isRS = language === 'rs';

  const [qcDate, setQcDate]           = useState('');
  const [operator, setOperator]       = useState('');
  const [qcComments, setQcComments]   = useState('');
  const [approve, setApprove]         = useState(false);
  const [actual, setActual]           = useState({});
  const [recheck, setRecheck]         = useState({});
  const [measurementsFailed, setMeasurementsFailed] = useState([]);
  const [visualFailed, setVisualFailed]             = useState([]);
  const [qualityChecks, setQualityChecks]           = useState({
    stitchingClean:    '',
    threadsCut:        '',
    collarAligned:     '',
    finalIroning:      '',
    buttonsAligned:    '',
    pocketPositioned:  '',
    labelPlacement:    '',
    packagingComplete: '',
    monogramCorrect:   '',
    placketAligned:    '',
    buttonholesClean:  '',
    cuffFusingOk:      '',
    sideSeamsStraight: '',
    shirtSymmetry:     ''
  });
  const [visualRechecked, setVisualRechecked] = useState({});
  const [isSubmitting, setIsSubmitting]       = useState(false);

  // ─── MEASUREMENT FIELDS + TOLERANCES ────────────────────────────────────────
  const tolerances = {
    neck:           0.5,
    chest:          1.0,
    waist:          1.0,
    hips:           1.0,
    shoulderWidth:  0.3,
    acrossShoulder: 1.0,
    backWidth:      1.0,
    sleeveLength:   0.7,
    bicep:          0.5,
    underElbow:     0.5,
    wristLeft:      0.3,
    wristRight:     0.3,
    shirtLength:    1.0
  };
  const fields = Object.keys(tolerances);

  // ─── LABELS (MULTILINGUAL) ───────────────────────────────────────────────────
  const labelsMap = {
    stitchingClean:    isRS ? 'Šavovi čisti?'                  : 'Stitching clean?',
    threadsCut:        isRS ? 'Konci odsečeni?'               : 'Threads cut?',
    collarAligned:     isRS ? 'Kragna poravnata?'             : 'Collar aligned?',
    finalIroning:      isRS ? 'Završno peglanje OK?'          : 'Final ironing OK?',
    buttonsAligned:    isRS ? 'Dugmad poravnata?'             : 'Buttons aligned properly?',
    pocketPositioned:  isRS ? 'Džep pravilno postavljen?'      : 'Pocket positioned correctly?',
    labelPlacement:    isRS ? 'Etiketa dobro postavljena?'      : 'Label placement OK?',
    packagingComplete: isRS ? 'Pakovanje završeno?'           : 'Packaging complete?',
    monogramCorrect:   isRS ? 'Monogram tačan?'               : 'Monogram correct?',
    placketAligned:    isRS ? 'Lajsna poravnata?'             : 'Placket aligned properly?',
    buttonholesClean:  isRS ? 'Rupice uredne?'                : 'Buttonholes clean & sized?',
    cuffFusingOk:      isRS ? 'Lepljenje kragne/manžetni OK?' : 'Cuff & collar fusing quality OK?',
    sideSeamsStraight: isRS ? 'Bočni šavovi ravni?'          : 'Side seams aligned & straight?',
    shirtSymmetry:     isRS ? 'Simetrija košulje OK?'          : 'Shirt symmetry OK?'
  };

  // ─── PREPOPULATE QC FIELDS FROM LATEST ATTEMPT ──────────────────────────────
  useEffect(() => {
    if (!order) return;

    let prev = null;
    if (Array.isArray(order.qcAttempts) && order.qcAttempts.length > 0) {
      prev = order.qcAttempts[order.qcAttempts.length - 1];
    } else if (order.qcData) {
      prev = order.qcData;
    }

    if (prev) {
      setQcDate(prev.date         || new Date().toISOString().substring(0, 10));
      setOperator(prev.operator   || '');
      setQcComments(prev.comments || '');
      setQualityChecks(prev.visualChecks || {
        stitchingClean: '', threadsCut: '', collarAligned: '', finalIroning: '', buttonsAligned: '',
        pocketPositioned: '', labelPlacement: '', packagingComplete: '', monogramCorrect: '',
        placketAligned: '', buttonholesClean: '', cuffFusingOk: '', sideSeamsStraight: '', shirtSymmetry: ''
      });
      setVisualRechecked(prev.recheckedVisuals || {});
      setActual(prev.measurements           || {});
      setRecheck(prev.recheckedMeasurements || {});
      setApprove(prev.approved || false);
    } else {
      // New QC (no existing data)
      setQcDate(new Date().toISOString().substring(0, 10));
      setOperator('');
      setQcComments('');
      setQualityChecks({
        stitchingClean: '', threadsCut: '', collarAligned: '', finalIroning: '', buttonsAligned: '',
        pocketPositioned: '', labelPlacement: '', packagingComplete: '', monogramCorrect: '',
        placketAligned: '', buttonholesClean: '', cuffFusingOk: '', sideSeamsStraight: '', shirtSymmetry: ''
      });
      setVisualRechecked({});
      setActual({});
      setRecheck({});
      setApprove(false);
    }
  }, [order]);

  // ─── RECALCULATE FAILED ARRAYS WHENEVER INPUT CHANGES ─────────────────────────
  useEffect(() => {
    // 1) Visual fails
    const vFails = Object.keys(qualityChecks).filter(k => qualityChecks[k] === 'FAIL');
    setVisualFailed(vFails);

    // 2) Measurement fails relative to order.measurements
    const mFails = fields.filter(f => {
      const exp = parseFloat(order.measurements?.[f] || 0);
      const act = parseFloat(actual[f] || 0);
      return Math.abs(act - exp) > tolerances[f];
    });
    setMeasurementsFailed(mFails);
  }, [qualityChecks, actual, order]);

  // ─── VALIDATION: HAVE WE RECHECKED ALL FAILS? ─────────────────────────────────
  const allVisualPassedOrRechecked = visualFailed.every(k => visualRechecked[k] === 'Corrected');
  const allMeasurementsPassedOrRechecked = measurementsFailed.every(f => {
    const newVal = parseFloat(recheck[f] || 0);
    const exp    = parseFloat(order.measurements[f] || 0);
    return Math.abs(newVal - exp) <= tolerances[f];
  });
  const isFormValid = () => {
    return (
      operator.trim() &&
      qcDate.trim() &&
      approve &&
      (visualFailed.length === 0 || allVisualPassedOrRechecked) &&
      (measurementsFailed.length === 0 || allMeasurementsPassedOrRechecked)
    );
  };

  // ─── COMMON: CREATE ATTEMPT OBJECT ───────────────────────────────────────────
  function buildAttemptData(isApproved, attemptNum) {
    return {
      date:                  qcDate,
      operator,
      comments:              qcComments,
      visualChecks:          qualityChecks,
      recheckedVisuals:      visualRechecked,
      measurements:          actual,
      recheckedMeasurements: recheck,
      approved:              isApproved,
      timestamp:             new Date().toISOString(),
      attemptNumber:         attemptNum,
      status:                isApproved ? "approved" : `qc-recontrol ${attemptNum}`,
    };
  }

  // ─── SAVE & APPROVE (MOVE TO PACKING) ─────────────────────────────────────────
  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!isFormValid()) {
      alert(
        isRS
          ? 'Molim vas, kompletirajte sva polja pre odobravanja.'
          : 'Please complete all fields before approving.'
      );
      return;
    }

    setIsSubmitting(true);
    const orderRef = doc(db, 'orders', order.id);
    try {
      // Get current qcAttempts array
      const snap = await getDoc(orderRef);
      let attempts = Array.isArray(snap.data().qcAttempts) ? [...snap.data().qcAttempts] : [];

      const nextAttemptNum = attempts.length + 1;
      const attemptData = buildAttemptData(true, nextAttemptNum);
      attempts.push(attemptData);

      await updateDoc(orderRef, {
        qcAttempts: attempts,
        qcApproved: true,
        Status:     'packing'
      });
    } catch (err) {
      console.error('Error saving QC & approving:', err);
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  // ─── SAVE WITHOUT APPROVAL (INCREMENT QC_RECONTROL) ───────────────────────────
  const handleSaveWithoutApproval = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const orderRef = doc(db, 'orders', order.id);
    try {
      // Get current qcAttempts array
      const snap = await getDoc(orderRef);
      let attempts = Array.isArray(snap.data().qcAttempts) ? [...snap.data().qcAttempts] : [];

      const nextAttemptNum = attempts.length + 1;
      const attemptData = buildAttemptData(false, nextAttemptNum);
      attempts.push(attemptData);

      await updateDoc(orderRef, {
        qcAttempts: attempts,
        qcApproved: false,
        Status:     `qc-recontrol ${nextAttemptNum}`
      });
    } catch (err) {
      console.error('Error saving QC recontrol attempt:', err);
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  // ─── RENDER DIALOG ─────────────────────────────────────────────────────────────
  if (!isOpen || !order) return null;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4"
    >
      <Dialog.Panel className="bg-black text-white rounded-xl p-6 w-full max-w-4xl border border-gold overflow-y-auto max-h-[90vh]">
        {/* ─── HEADER & LANGUAGE SWITCH ─────────────────────────────────────────── */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gold">
            {isRS
              ? 'QC Odobrenje – Porudžbina:'
              : 'QC Approval – Order:'}{' '}
            {order['Order ID']} – {order['Client Name']}
          </h2>
          <button
            onClick={() => setLanguage(prev => (prev === 'en' ? 'rs' : 'en'))}
            className="text-sm text-gold border border-gold px-3 py-1 rounded"
          >
            {language === 'en' ? 'RS' : 'EN'}
          </button>
        </div>

        {/* ─── QC DATE & OPERATOR INPUTS ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-gold font-semibold block mb-1">
              {isRS ? 'Datum kontrole' : 'QC Date'}
            </label>
            <input
              type="date"
              value={qcDate}
              onChange={e => setQcDate(e.target.value)}
              className="w-full bg-black border border-gold text-white p-2 rounded"
            />
          </div>
          <div>
            <label className="text-gold font-semibold block mb-1">
              {isRS ? 'Kontrolor' : 'Operator'}
            </label>
            <input
              type="text"
              placeholder={isRS ? 'Ime osobe' : 'Operator name'}
              value={operator}
              onChange={e => setOperator(e.target.value)}
              className="w-full bg-black border border-gold text-white p-2 rounded"
            />
          </div>
        </div>

        {/* ─── QC COMMENTS TEXTAREA ───────────────────────────────────────────── */}
        <div className="mb-6">
          <label className="text-gold font-semibold mb-1 block">
            {isRS ? 'Komentari' : 'Comments'}
          </label>
          <textarea
            rows={3}
            value={qcComments}
            onChange={e => setQcComments(e.target.value)}
            className="w-full bg-black border border-gold text-white p-2 rounded"
            placeholder={isRS ? 'Unesite komentare...' : 'Enter any comments...'}
          />
        </div>

        {/* ─── VISUAL INSPECTION ───────────────────────────────────────────────── */}
        <h3 className="text-xl font-semibold text-gold mb-2">
          {isRS ? 'Vizuelna kontrola' : 'Visual Inspection'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {Object.keys(qualityChecks).map(key => (
            <div
              key={key}
              className="flex justify-between items-center p-2 bg-gray-800 rounded"
            >
              <span>{labelsMap[key]}</span>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setQualityChecks(prev => ({ ...prev, [key]: 'PASS' }))
                  }
                  className={
                    qualityChecks[key] === 'PASS'
                      ? 'bg-green-600 text-white px-3 py-1 rounded'
                      : 'border border-green-500 text-green-400 px-3 py-1 rounded'
                  }
                >
                  ✔
                </button>
                <button
                  onClick={() =>
                    setQualityChecks(prev => ({ ...prev, [key]: 'FAIL' }))
                  }
                  className={
                    qualityChecks[key] === 'FAIL'
                      ? 'bg-red-600 text-white px-3 py-1 rounded'
                      : 'border border-red-500 text-red-400 px-3 py-1 rounded'
                  }
                >
                  ✖
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ─── VISUAL RECHECK (IF ANY FAIL) ─────────────────────────────────────── */}
        {visualFailed.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-red-500 mb-2">
              {isRS ? 'Rekontrola vizuelnih tačaka' : 'Visual Points Recheck'}
            </h3>
            {visualFailed.map(key => (
              <div
                key={key}
                className="flex justify-between items-center p-2 bg-gray-800 rounded mb-2"
              >
                <span>{labelsMap[key]}</span>
                <select
                  value={visualRechecked[key] || ''}
                  onChange={e =>
                    setVisualRechecked(prev => ({ ...prev, [key]: e.target.value }))
                  }
                  className="bg-black border border-gold text-white p-1 rounded"
                >
                  <option value="">{isRS ? 'Izaberite' : 'Select'}</option>
                  <option value="Corrected">
                    {isRS ? 'Ispravljeno' : 'Corrected'}
                  </option>
                </select>
              </div>
            ))}
          </div>
        )}

        {/* ─── MEASUREMENTS & TOLERANCES ───────────────────────────────────────── */}
        <h3 className="text-xl font-semibold text-gold mb-2">
          {isRS ? 'Merenja i tolerancije' : 'Measurements & Tolerances'}
        </h3>
        <div className="mb-6 space-y-2">
          {fields.map(field => {
            const expVal = parseFloat(order.measurements?.[field] || 0);
            const actVal = parseFloat(actual[field] || 0);
            const diff   = parseFloat((actVal - expVal).toFixed(2));
            const pass   = Math.abs(diff) <= tolerances[field];
            const displayField = field.replace(/([A-Z])/g, ' $1').trim();

            return (
              <div
                key={field}
                className="grid grid-cols-6 gap-2 text-sm items-center"
              >
                <div>{displayField}</div>
                <div>{expVal || '-'}</div>
                <div>±{tolerances[field]}</div>
                <input
                  type="number"
                  value={actual[field] || ''}
                  onChange={e =>
                    setActual(prev => ({ ...prev, [field]: e.target.value }))
                  }
                  className="bg-black border border-gold text-white p-1 rounded"
                />
                <div>{!isNaN(actVal) ? diff.toFixed(2) : '-'}</div>
                <div
                  className={
                    !isNaN(actVal)
                      ? pass
                        ? 'text-green-500'
                        : 'text-red-500'
                      : ''
                  }
                >
                  {!isNaN(actVal) ? (pass ? <Check /> : <X />) : ''}
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── MEASUREMENT RECHECK (IF FAILS) ───────────────────────────────────── */}
        {measurementsFailed.length > 0 && (
          <div className="mb-6">
            <h3 className="text-red-500 font-semibold mb-2">
              {isRS
                ? 'Ponovno merenje za neuspešne tačke'
                : 'Recheck for Failed Measurements'}
            </h3>
            {measurementsFailed.map(field => {
              const displayField = field.replace(/([A-Z])/g, ' $1').trim();
              return (
                <div key={field} className="flex items-center gap-2 mb-2">
                  <span className="w-32">{displayField}</span>
                  <input
                    type="number"
                    placeholder={isRS ? 'Nova vrednost' : 'New value'}
                    value={recheck[field] || ''}
                    onChange={e =>
                      setRecheck(prev => ({ ...prev, [field]: e.target.value }))
                    }
                    className="bg-black border border-gold text-white p-1 rounded"
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* ─── APPROVE FOR PACKING TOGGLE ───────────────────────────────────────── */}
        <div className="mb-6">
          <label className="text-gold font-bold mr-2">
            {isRS ? 'Odobreno za pakovanje' : 'Approve for Packing'}
          </label>
          <input
            type="checkbox"
            checked={approve}
            onChange={e => setApprove(e.target.checked)}
            disabled={
              !allVisualPassedOrRechecked ||
              (measurementsFailed.length > 0 && !allMeasurementsPassedOrRechecked)
            }
          />
        </div>

        {/* ─── CANCEL / SAVE & EXIT / SAVE & APPROVE ───────────────────────────── */}
        <div className="flex justify-between mt-6 mb-4">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gold text-gold rounded hover:bg-gold hover:text-black"
            type="button"
          >
            {isRS ? 'Otkaži' : 'Cancel'}
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleSaveWithoutApproval}
              disabled={isSubmitting}
              className="px-4 py-2 bg-gray-700 text-white font-bold rounded hover:bg-gray-600 disabled:opacity-50"
              type="button"
            >
              💾 {isRS ? 'Sačuvaj & Izlaz' : 'Save & Exit'}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isFormValid() || isSubmitting}
              className="px-4 py-2 bg-gold text-black font-bold rounded hover:bg-yellow-500 disabled:opacity-50"
              type="button"
            >
              ✔ {isRS ? 'Sačuvaj i odobri' : 'Save & Approve'}
            </button>
          </div>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
}
