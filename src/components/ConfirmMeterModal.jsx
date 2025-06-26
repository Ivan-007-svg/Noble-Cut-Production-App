import React, { useState, useEffect, useMemo } from 'react';
import {
  doc,
  runTransaction,
  collection,
  addDoc,
  getDoc,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { STATUSES } from '../constants/productionStatuses';

// Helper for normalizing matching
function normalize(val) {
  return String(val ?? '').trim().toLowerCase();
}

export default function ConfirmMeterOrRecutModal({
  order,
  onClose,
  onConfirmed,
  skipStatusUpdate = false
}) {
  const [assignedRolls, setAssignedRolls] = useState(order['Assigned Rolls'] || []);
  const [loadingAssigned, setLoadingAssigned] = useState(true);

  useEffect(() => {
    async function fetchAssigned() {
      const orderRef = doc(db, 'orders', order.id);
      const snap = await getDoc(orderRef);
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data['Assigned Rolls'])) {
          setAssignedRolls(data['Assigned Rolls']);
        }
      }
      setLoadingAssigned(false);
    }
    if (!Array.isArray(order['Assigned Rolls'])) {
      fetchAssigned();
    } else {
      setLoadingAssigned(false);
    }
  }, [order]);

  const sumThisOrderReserved = useMemo(() => {
    return assignedRolls.reduce((sum, r) => sum + (r.reserved || 0), 0);
  }, [assignedRolls]);

  const rollNumbersDisplay = useMemo(() => {
    if (!assignedRolls.length) return '–';
    return assignedRolls.map(r => r.rollNumber).join(', ');
  }, [assignedRolls]);

  const confirmedBefore = !!(order.actualConsumedMeters && order.actualConsumedMeters > 0);

  const [reportedMeters, setReportedMeters] = useState(
    confirmedBefore ? order.actualConsumedMeters : ''
  );

  const [recuts, setRecuts] = useState([]);
  const [newRecutMeters, setNewRecutMeters] = useState('');
  const [newRecutReason, setNewRecutReason] = useState('');
  const [error, setError] = useState('');

  const handleAddRecut = () => {
    if (!newRecutMeters || !newRecutReason) return;
    setRecuts(prev => [
      ...prev,
      { meters: parseFloat(newRecutMeters), reason: newRecutReason }
    ]);
    setNewRecutMeters('');
    setNewRecutReason('');
  };

  const handleConfirm = async () => {
    const EPSILON = 1e-6;

    if (loadingAssigned || !assignedRolls.length) {
      setError(
        "Please wait, fabric assignment is loading. / Sačekajte, dodela materijala se učitava."
      );
      return;
    }

    let originalActual = Number(order.actualConsumedMeters) || 0;
    let recutSum = recuts.reduce((acc, r) => acc + Number(r.meters || 0), 0);

    let newActualTotal;
    if (!skipStatusUpdate && !confirmedBefore) {
      newActualTotal = Number(reportedMeters) || 0;
    } else {
      newActualTotal = originalActual + recutSum;
    }

    try {
      // Fetch all rolls from Firestore
      const rollDocsSnap = await getDocs(collection(db, 'fabricRolls'));
      const allRolls = [];
      rollDocsSnap.forEach(docSnap => {
        allRolls.push({ ...docSnap.data(), docRef: docSnap.ref, docId: docSnap.id });
      });

      // Match correct article code
      const orderArticle =
        normalize(order.article) ||
        normalize(order.fabricCode) ||
        normalize(order['Fabric Article']) ||
        normalize(order['Fabric Code']) ||
        '';

      // Get all rolls of this article
      let rollsSameArticle = allRolls.filter(r =>
        normalize(r.article) === orderArticle ||
        normalize(r.fabricCode) === orderArticle ||
        normalize(r['Fabric Article']) === orderArticle ||
        normalize(r['Fabric Code']) === orderArticle
      );
      rollsSameArticle = rollsSameArticle.slice().sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || ''));

      // Fetch all orders (for reservation recalculation after cut)
      const allOrdersSnap = await getDocs(collection(db, 'orders'));
      const allOrders = [];
      allOrdersSnap.forEach(docSnap => {
        allOrders.push({ ...docSnap.data(), id: docSnap.id });
      });

      // MAIN CUT LOGIC
      if (!skipStatusUpdate && !confirmedBefore) {
        let toCut = newActualTotal;
        let cutPlan = [];
        let cutRemaining = toCut;

        // For this order, how much is reserved on each roll
        const myResMap = {};
        if (Array.isArray(order['Assigned Rolls'])) {
          for (const r of order['Assigned Rolls']) {
            if (r.rollNumber) myResMap[r.rollNumber] = r.reserved || 0;
          }
        }
        for (const roll of rollsSameArticle) {
          if (!(roll.rollNumber in myResMap)) myResMap[roll.rollNumber] = 0;
        }

        for (let roll of rollsSameArticle) {
          if (cutRemaining <= EPSILON) break;
          let reservedForThisOrder = myResMap[roll.rollNumber] || 0;
          let totalMeters = roll.totalMeters || 0;

          let fromReserved = Math.min(reservedForThisOrder, cutRemaining, totalMeters);
          let physicalLeftAfterReserved = totalMeters - fromReserved;
          let fromAvailable = 0;
          if (fromReserved < cutRemaining) {
            fromAvailable = Math.min(cutRemaining - fromReserved, physicalLeftAfterReserved);
          }
          let cutHere = fromReserved + fromAvailable;

          if (cutHere > 0) {
            cutPlan.push({
              rollNumber: roll.rollNumber,
              fromReserved,
              fromAvailable,
              docRef: roll.docRef,
              totalMeters,
            });
            cutRemaining -= cutHere;
          }
        }

        if (cutRemaining > EPSILON) {
          setError(
            "Not enough physical fabric for this cut. Not enough fabric on rolls for this article. / Nema dovoljno fizičke metraže za ovo krojenje. Nema dovoljno materijala na rolni za ovaj artikal."
          );
          return;
        }

        // Transaction
        await runTransaction(db, async tx => {
          // 1. Update the order (set reservations to zero)
          const orderUpdateData = {
            Status: STATUSES.IN_STITCHING,
            actualConsumedMeters: newActualTotal,
            recutsCount: (order.recutsCount || 0) + recuts.length,
            'Assigned Rolls': assignedRolls.map(r => ({
              ...r,
              reserved: 0
            }))
          };
          if (!confirmedBefore) {
            orderUpdateData.cutDate = new Date().toISOString();
          }
          tx.update(doc(db, 'orders', order.id), orderUpdateData);

          // 2. Deduct fabric from rolls according to cutPlan
          for (let plan of cutPlan) {
            let newTotal = plan.totalMeters - plan.fromReserved - plan.fromAvailable;
            if (newTotal < 0) newTotal = 0;
            tx.update(plan.docRef, { totalMeters: parseFloat(newTotal.toFixed(6)) });
          }

          // 3. Recalculate reservations for each roll (but DO NOT touch other orders' reservations!)
          //    Only update reservedMeters/availableMeters for each roll by summing still-active orders
          const updatedOrders = allOrders.map(o =>
            o.id === order.id
              ? {
                  ...o,
                  'Assigned Rolls': Array.isArray(o['Assigned Rolls'])
                    ? o['Assigned Rolls'].map(r => ({ ...r, reserved: 0 }))
                    : [],
                }
              : o
          );

          for (let roll of rollsSameArticle) {
            let sumReservations = 0;
            for (let o of updatedOrders) {
              if (Array.isArray(o['Assigned Rolls'])) {
                for (let r of o['Assigned Rolls']) {
                  if (r.rollNumber === roll.rollNumber) {
                    sumReservations += Number(r.reserved) || 0;
                  }
                }
              }
            }
            let rollDocRef = roll.docRef;
            let newTotalMeters = null;
            // If this roll was just cut, update to the new value
            let cutItem = cutPlan.find(p => p.rollNumber === roll.rollNumber);
            if (cutItem) {
              newTotalMeters = cutItem.totalMeters - cutItem.fromReserved - cutItem.fromAvailable;
              if (newTotalMeters < 0) newTotalMeters = 0;
            } else {
              newTotalMeters = roll.totalMeters;
            }
            let newAvailable = newTotalMeters - sumReservations;
            if (newAvailable < 0 && Math.abs(newAvailable) < EPSILON) newAvailable = 0;
            tx.update(rollDocRef, {
              reservedMeters: parseFloat(sumReservations.toFixed(6)),
              availableMeters: parseFloat(newAvailable.toFixed(6)),
              totalMeters: parseFloat(newTotalMeters.toFixed(6)),
            });
          }
        });

        setRecuts([]);
        onConfirmed(order.id, newActualTotal, recuts);
        onClose();
        return;
      }

      // --- RECUT LOGIC (unchanged, FIFO over unreserved) ---
      const assignedSet = new Set(assignedRolls.map(r => r.rollNumber));
      const assignedFIFO = rollsSameArticle.filter(r => assignedSet.has(r.rollNumber)).sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));
      const unassignedFIFO = rollsSameArticle.filter(r => !assignedSet.has(r.rollNumber)).sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));
      const allRollsFIFO = [...assignedFIFO, ...unassignedFIFO];

      if ((skipStatusUpdate || confirmedBefore) && recutSum > 0) {
        const recutFIFO = allRollsFIFO;
        let totalAvailable = 0;
        for (const roll of recutFIFO) {
          const available = Math.max(0, (roll.totalMeters || 0) - (roll.reservedMeters || 0));
          totalAvailable += available;
        }
        if (recutSum > totalAvailable + EPSILON) {
          setError(
            `Not enough free (unreserved) fabric for recut on this fabric/article. / Nema dovoljno slobodne (nerezevisane) metraže za dokrojavanje na ovom artiklu. \nAvailable for recut: ${totalAvailable.toFixed(2)} m. / Slobodno za dokrojavanje: ${totalAvailable.toFixed(2)} m.\nYou requested: ${recutSum.toFixed(2)} m. / Zahtevano: ${recutSum.toFixed(2)} m.`
          );
          return;
        }
        let recutSumRemaining = recutSum;
        let afterRecutRolls = recutFIFO.map(roll => ({ ...roll }));
        for (let roll of afterRecutRolls) {
          if (recutSumRemaining <= EPSILON) break;
          let availableHere = Math.max(0, (roll.totalMeters || 0) - (roll.reservedMeters || 0));
          let take = Math.min(availableHere, recutSumRemaining);
          roll.totalMeters = parseFloat((roll.totalMeters - take).toFixed(6));
          roll.availableMeters = Math.max(0, roll.totalMeters - (roll.reservedMeters || 0));
          recutSumRemaining -= take;
        }
        if (recutSumRemaining > EPSILON) {
          setError(
            "Fabric shortage during recut: not enough available meters on rolls for this fabric/article. / Nema dovoljno slobodne metraže tokom dokrojavanja na rolnama za ovaj artikal."
          );
          return;
        }
        await runTransaction(db, async tx => {
          for (let roll of afterRecutRolls) {
            const origRoll = rollsSameArticle.find(r => r.rollNumber === roll.rollNumber);
            if (!origRoll) continue;
            if (Math.abs((origRoll.totalMeters || 0) - (roll.totalMeters || 0)) > EPSILON) {
              let reservedMetersFinal = roll.reservedMeters || 0;
              let availableMetersFinal = Math.max(0, roll.totalMeters - reservedMetersFinal);
              tx.update(roll.docRef, {
                reservedMeters: reservedMetersFinal,
                availableMeters: availableMetersFinal,
                totalMeters: roll.totalMeters
              });
            }
          }
          tx.update(doc(db, 'orders', order.id), {
            actualConsumedMeters: newActualTotal,
            recutsCount: (order.recutsCount || 0) + recuts.length
          });
        });
        for (let r of recuts) {
          await addDoc(collection(doc(db, 'orders', order.id), 'recuts'), {
            meters: r.meters,
            reason: r.reason,
            timestamp: new Date().toISOString()
          });
        }
        setRecuts([]);
        onConfirmed(order.id, newActualTotal, recuts);
        onClose();
        return;
      }
    } catch (e) {
      setError(
        (e.message || 'An error occurred.') +
        ' / Došlo je do greške.'
      );
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50"
      onClick={onClose}
    >
      <div
        className="bg-black border-2 border-gold rounded-lg w-96 p-6"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-gold mb-4 text-center">
          Confirm Meter Usage
          <br />
          <span className="text-sm text-gray-400">
            (Potvrđivanje potrošenog materijala)
          </span>
        </h2>

        <div className="mb-4">
          <label className="block text-gold font-semibold mb-1">
            Reserved Meters (This Order)
            <br />
            <span className="text-sm text-gray-400">
              (Rezervisani metri za ovu porudžbinu)
            </span>
          </label>
          <div className="bg-gray-900 text-gold border border-gray-700 px-3 py-2 rounded w-full mb-2">
            {loadingAssigned
              ? 'Loading… / Učitavanje…'
              : sumThisOrderReserved.toFixed(2) + ' m'}
          </div>

          <label className="block text-gold font-semibold mb-1">
            Assigned Roll(s)
            <br />
            <span className="text-sm text-gray-400">
              (Dodeljene rolne)
            </span>
          </label>
          <div className="bg-gray-900 text-gold border border-gray-700 px-3 py-2 rounded w-full">
            {loadingAssigned ? 'Loading… / Učitavanje…' : rollNumbersDisplay}
          </div>
        </div>

        {!confirmedBefore && !skipStatusUpdate && (
          <div className="mb-4">
            <label className="block text-gold font-semibold mb-1">
              Actual Consumed Meters
              <br />
              <span className="text-sm text-gray-400">
                (Realno potrošena metraža)
              </span>
            </label>
            <input
              type="number"
              step="0.01"
              value={reportedMeters}
              onChange={e => setReportedMeters(e.target.value)}
              className="bg-black text-gold border border-gold px-3 py-2 rounded w-full focus:outline-none"
              placeholder="npr. 1.80"
            />
          </div>
        )}

        <h3 className="text-gold font-semibold mb-2">
          Add Recut
          <br />
          <span className="text-sm text-gray-400">
            (Dodaj dokrojeno)
          </span>
        </h3>
        <div className="flex gap-2 mb-2">
          <input
            type="number"
            step="0.01"
            placeholder="Meters (Metri)"
            value={newRecutMeters}
            onChange={e => setNewRecutMeters(e.target.value)}
            className="bg-black text-gold border border-gold px-3 py-2 rounded w-1/2 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Reason (Razlog)"
            value={newRecutReason}
            onChange={e => setNewRecutReason(e.target.value)}
            className="bg-black text-gold border border-gold px-3 py-2 rounded w-1/2 focus:outline-none"
          />
        </div>
        <button
          onClick={handleAddRecut}
          className="w-full bg-gold text-black font-semibold px-3 py-2 rounded mb-4 hover:bg-yellow-500"
        >
          Add Recut / Dodaj dokrojeno
        </button>

        {recuts.length > 0 && (
          <div className="bg-gray-900 border border-gray-700 rounded p-2 mb-4 max-h-28 overflow-y-auto">
            <ul className="list-disc list-inside text-gold text-sm">
              {recuts.map((r, idx) => (
                <li key={idx}>
                  {r.meters.toFixed(2)} m — {r.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <div className="text-red-600 text-sm mb-4 text-center">{error}</div>
        )}

        <div className="flex justify-between">
          <button
            onClick={onClose}
            className="bg-gray-700 text-gray-200 font-semibold px-4 py-2 rounded hover:bg-gray-600"
          >
            Cancel / Otkaži
          </button>
          <button
            onClick={handleConfirm}
            className="bg-blue-600 text-white font-semibold px-4 py-2 rounded hover:bg-blue-500"
          >
            Confirm & Continue / Potvrdi & Nastavi
          </button>
        </div>
      </div>
    </div>
  );
}
