import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export default function OrderDetailsModal({ order, onClose }) {
  const [fabricUsed, setFabricUsed] = useState(order.fabricUsedActual || '');
  const [status, setStatus] = useState(order.productionStatus || 'cutting');
  const [checklist, setChecklist] = useState(order.qcChecklist || {
    fabricClean: false,
    monogramCorrect: false,
    stitchingOk: false,
    packagingOk: false
  });

  const handleChecklistChange = (key) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (status !== 'cutting' && !fabricUsed) {
      alert('⚠ Please enter real fabric used before continuing.');
      return;
    }

    if (status === 'qcApproved' && Object.values(checklist).some(val => val === false)) {
      alert('⚠ All QC checklist items must be completed.');
      return;
    }

    const ref = doc(db, 'orders', order.orderId);
    await updateDoc(ref, {
      fabricUsedActual: fabricUsed,
      productionStatus: status,
      qcChecklist: checklist
    });

    alert('✅ Order updated successfully.');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-white text-black p-6 rounded-lg w-[600px]">
        <h2 className="text-xl font-bold mb-4">Order: {order.orderId}</h2>

        <div className="mb-4">
          <label className="block font-semibold mb-1">Real Fabric Used (m)</label>
          <input
            type="number"
            value={fabricUsed}
            onChange={e => setFabricUsed(e.target.value)}
            className="w-full p-2 border"
          />
        </div>

        <div className="mb-4">
          <label className="block font-semibold mb-1">Production Status</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="w-full p-2 border"
          >
            <option value="cutting">Cutting</option>
            <option value="stitching">Stitching</option>
            <option value="qc">QC</option>
            <option value="qcApproved">QC Approved</option>
            <option value="packed">Packed</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>

        {status === 'qcApproved' && (
          <div className="mb-4">
            <h3 className="font-semibold mb-2">Final QC Checklist</h3>
            <div className="space-y-2">
              {Object.entries(checklist).map(([key, val]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={() => handleChecklistChange(key)}
                  />
                  <span>{key.replace(/([A-Z])/g, ' $1')}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-4 mt-6">
          <button onClick={onClose} className="px-4 py-2 border">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 bg-black text-gold">Save</button>
        </div>
      </div>
    </div>
  );
}

