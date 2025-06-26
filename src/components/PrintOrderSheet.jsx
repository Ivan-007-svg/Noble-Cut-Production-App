import React, { useRef } from 'react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import html2pdf from 'html2pdf.js';
import { QRCodeCanvas } from 'qrcode.react';

const PrintOrderSheet = ({ order, onClose, onPrintComplete }) => {
  if (!order) return null; // Prevents crash if order is null

  const printRef = useRef();

  const fallback = (...fields) => fields.reduce((acc, key) => acc || order[key], '');

  const handlePrint = async () => {
    const element = printRef.current;
    const orderId = order['Order ID']?.replace(/\s+/g, '_') || 'Order';
    const clientName = order['Client Name']?.replace(/\s+/g, '_') || 'Client';
    const fileName = `${orderId}_${clientName}_v1.0.pdf`;

    const opt = {
      margin: 0.5,
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    try {
      await html2pdf().set(opt).from(element).save();
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, { Status: 'In Production' });
      onPrintComplete();
      onClose();
    } catch (err) {
      console.error('PDF generation or Firestore update failed:', err);
    }
  };

  const renderSection = (title, fields) => (
    <div className="section">
      <h2>{title}</h2>
      <table className="table">
        <tbody>
          {fields.map(([label, value]) => (
            <tr key={label}>
              <td className="label">{label}:</td>
              <td className="value">{value || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // SAFE! Never null or undefined
  const rolls = Array.isArray(order['Assigned Rolls']) ? order['Assigned Rolls'] : [];
  const rollsInfo = rolls.length > 0
    ? rolls.map(r => `${r.rollNumber} – ${r.reserved}m`).join(', ')
    : '—';

  const today = new Date().toLocaleDateString('en-GB');

  const renderMeasurementSection = () => {
    const measurementFields = [
      { label: 'Neck (cm)', allowed: '±0.5' },
      { label: 'Chest (cm)', allowed: '±1.0' },
      { label: 'Waist (cm)', allowed: '±1.0' },
      { label: 'Hips (cm)', allowed: '±1.0' },
      { label: 'Shoulder Width (cm)', allowed: '±0.5' },
      { label: 'Across Shoulder', allowed: '±0.5' },
      { label: 'Back Width', allowed: '±0.5' },
      { label: 'Sleeve Length (cm)', allowed: '±1.0' },
      { label: 'Bicep (cm)', allowed: '±0.5' },
      { label: 'Under Elbow', allowed: '±0.5' },
      { label: 'Wrist (cm) Left', allowed: '±0.5' },
      { label: 'Wrist (cm) Right', allowed: '±0.5' },
      { label: 'Shirt Length (cm)', allowed: '±1.0' }
    ];

    return (
      <div className="section">
        <h2>Measurements / Mere (EN/SR)</h2>
        <table className="measurement-table">
          <thead>
            <tr>
              <th>Measurement Part</th>
              <th>Client Measurement</th>
              <th>Measured</th>
              <th>Difference</th>
              <th>Standard Allowed</th>
            </tr>
          </thead>
          <tbody>
            {measurementFields.map(({ label, allowed }) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{order[label] || '-'}</td>
                <td className="box"></td>
                <td className="box"></td>
                <td className="box">{allowed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const trackingUrl = `https://noblecut.com/track/${order['Order ID']?.replace(/\s+/g, '_')}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 text-black z-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded shadow-xl max-w-5xl w-full max-h-[95vh] overflow-auto relative">
        <div className="p-4 print-container" ref={printRef}>
          <style>{`
            @page { size: auto; margin: 0.5in; }
            .print-container { font-family: 'Segoe UI', sans-serif; color: black; padding: 20px; }
            .logo-container {
              display: flex;
              justify-content: center;
              align-items: flex-start;
              position: relative;
              margin-top: 0;
              margin-bottom: 0;
            }
            .logo {
              text-align: center;
              margin: 0 auto;
              position: relative;
            }
            .logo img {
              height: 125px;
              margin-top: 10px;
            }
            .qr {
              position: absolute;
              top: 0;
              right: 0;
              display: flex;
              flex-direction: column;
              align-items: flex-end;
              gap: 4px;
              margin-right: 10px;
            }
            h1 { font-size: 24px; text-align: center; margin-bottom: 20px; }
            h2 { font-size: 16px; margin-top: 25px; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 4px; }
            .section { margin-bottom: 16px; }
            .table { width: 100%; border-collapse: collapse; }
            .table td, .table th { padding: 5px 8px; font-size: 12px; border: 1px solid #ccc; vertical-align: top; }
            .label { font-weight: 600; width: 220px; }
            .value { font-weight: 400; }
            .measurement-table { width: 100%; border-collapse: collapse; }
            .measurement-table th, .measurement-table td { border: 1px solid #888; padding: 4px; font-size: 11px; text-align: center; }
            .box { height: 20px; }
            .page-break { page-break-after: always; margin-top: 20px; }
            .footer { text-align: right; font-size: 10px; color: #666; margin-top: 4px; position: relative; bottom: 0; }
            .signature { margin-top: 25px; height: 60px; display: flex; flex-direction: column; justify-content: flex-end; }
            .signature span { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 3px; }
            .page-num-static { font-size: 11px; text-align: right; color: #555; margin-top: 8px; }
            .watermark { position: absolute; bottom: 3%; right: 3%; font-size: 38px; color: rgba(200,200,200,0.2); transform: rotate(-30deg); pointer-events: none; z-index: 0; }
          `}</style>

          <div className="logo-container">
            <div className="logo">
              <img src="/logo-light.png" alt="Noble Cut Logo" />
            </div>
            <div className="qr">
              <QRCodeCanvas value={order['Order ID'] || 'N/A'} size={70} />
              <QRCodeCanvas value={trackingUrl} size={70} />
            </div>
          </div>

          <h1>Order Summary / Pregled Narudžbine</h1>

          {renderSection('Client & Order Info / Klijent i Narudžbina', [
            ['Client Name / Ime Klijenta', order['Client Name']],
            ['Contact Info / Kontakt', fallback('Contact Info', 'Client Contact Info')],
            ['Order ID / Šifra Narudžbine', order['Order ID']],
            ['Ordered Quantity / Količina', order['Ordered Quantity']],
            ['Order Date / Datum Narudžbine', order['Order Date']],
            ['Delivery Date / Datum Isporuke', order['Delivery Date']],
            ['Status / Status', order['Status']],
          ])}

          {renderSection('Fabric & Button Info / Tkanina i Dugmad', [
            ['Fabric Supplier / Dobavljač', order['Fabric Supplier']],
            ['Fabric Code / Šifra Tkanine', order['Fabric Code']],
            ['Fabric Color / Boja Tkanine', order['Fabric Color']],
            ['Fabric Description / Opis Tkanine', order['Fabric Description']],
            ['Fabric Consumption per Shirt / Potrošnja', order['Fabric Consumption per Shirt']],
            ['Assigned Rolls / Dodeljene Rolne', rollsInfo],
            ['Button Article / Šifra Dugmeta', order['Button Article']],
            ['Button Supplier / Dobavljač Dugmeta', order['Button Supplier']],
            ['Button Color / Boja Dugmeta', order['Button Color']],
          ])}

          <div className="page-break"></div>

          {renderSection('Shirt Line & Model Info / Linija i Model Košulje', [
            ['Shirt Line / Linija', order['Shirt Line']],
            ['Pattern / Kroj', order['Pattern']],
            ['Collar Type / Tip Kragne', fallback('Collar Type', 'Collar Style')],
            ['Cuff Type / Tip Manžetne', fallback('Cuff Type', 'Cuff Style')],
            ['Placket Style / Tip Prednjice', order['Placket Style']],
          ])}

          {renderSection('Monogram Info / Informacije o Monogramu', [
            ['Monogram', order['Monogram']],
            ['Monogram Color / Boja Monograma', order['Monogram Color']],
            ['Monogram Text / Tekst Monograma', order['Monogram Text']],
            ['Monogram Placement / Pozicija', order['Monogram Placement']],
          ])}

          {renderMeasurementSection()}

          {renderSection('Order Notes / Napomene', [
            ['Notes / Napomena', order['Order Notes'] || '—'],
          ])}

          <div className="signature">
            <span>Production Manager Signature / Potpis Menadžera</span>
          </div>

          <div className="footer">
            Printed on: {today} — Noble Cut — v1.0<br />
            Page 2 of 2
          </div>

          <div className="watermark">Noble Cut</div>
        </div>

        <div className="mt-6 flex justify-end gap-4">
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded">Close</button>
          <button onClick={handlePrint} className="px-4 py-2 bg-gold text-black rounded font-semibold">Print</button>
        </div>
      </div>
    </div>
  );
};

export default PrintOrderSheet;
