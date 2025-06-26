// src/components/OrdersInProductionPage.jsx

import React, { useEffect, useState, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { db } from '../firebase/config';
import {
  collection,
  doc,
  updateDoc,
  onSnapshot,
  getDoc
} from 'firebase/firestore';
import Layout from './Layout';
import { useLanguage } from '../context/LanguageContext';
import labels from '../constants/labels';
import QCFormModal from './QCFormModal';
import ConfirmMeterModal from './ConfirmMeterModal';
import PrintOrderSheet from './PrintOrderSheet';
import QCReportView from './QCReportView';
import { STATUSES, NEXT_STATUS } from '../constants/productionStatuses';

// Debounce hook (200ms)
function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debounced;
}

const OrdersInProductionPage = () => {
  const { language } = useLanguage();
  const t = labels[language] || {};
  const isRS = language === 'sr';

  // ─── STATE ─────────────────────────────────────────────────────────────────────
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);

  // Date/text filter state
  const [filters, setFilters] = useState({
    client: '',
    fabric: '',
    orderDateFrom: null,
    orderDateTo: null,
    deliveryDateFrom: null,
    deliveryDateTo: null
  });
  const debouncedClient = useDebouncedValue(filters.client, 200);
  const debouncedFabric = useDebouncedValue(filters.fabric, 200);

  // Separate states for various modals
  const [detailOrder, setDetailOrder] = useState(null);
  const [qcOrder, setQcOrder] = useState(null);
  const [qcReportOrder, setQcReportOrder] = useState(null);
  const [meterConfirmOrder, setMeterConfirmOrder] = useState(null);
  const [skipStatusUpdate, setSkipStatusUpdate] = useState(false);

  // Sorting
  const [sortBy, setSortBy] = useState('orderDate');
  const [sortDir, setSortDir] = useState('desc');

  // For NEXT_STATUS dropdown (map lowercase status → next statuses array)
  const nextStatusMapLc = {};
  Object.entries(NEXT_STATUS).forEach(([key, arr]) => {
    nextStatusMapLc[key.toLowerCase()] = arr;
  });

  // Map sort‐keys to Firestore fields
  const fieldMap = {
    client:       'Client Name',
    orderId:      'Order ID',
    quantity:     'Ordered Quantity',
    fabricCode:   'Fabric Code',
    orderDate:    'Order Date',
    deliveryDate: 'Delivery Date',
    status:       'Status'
  };

  // ─── FETCH & LISTEN TO ORDERS ───────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'orders'), snapshot => {
      const data = snapshot.docs.map(docSnap => {
        const raw = docSnap.data();
        // Build a `measurements` object from raw fields
        const measurementFields = {
          neck:           'Neck (cm)',
          chest:          'Chest (cm)',
          waist:          'Waist (cm)',
          hips:           'Hips (cm)',
          shoulderWidth:  'Shoulder Width (cm)',
          acrossShoulder: 'Across Shoulder',
          backWidth:      'Back Width',
          sleeveLength:   'Sleeve Length (cm)',
          bicep:          'Bicep (cm)',
          underElbow:     'Under Elbow',
          wristLeft:      'Wrist (cm) Left',
          wristRight:     'Wrist (cm) Right',
          shirtLength:    'Shirt Length (cm)',
          cuffLeft:       'Cuff Left',
          cuffRight:      'Cuff Right'
        };
        const measurements = {};
        for (const [key, firebaseField] of Object.entries(measurementFields)) {
          measurements[key] = raw[firebaseField] || '';
        }
        return { id: docSnap.id, ...raw, measurements };
      });

      // Filter by any in‐production status, including all "qc-recontrol X"
      const filtered = data.filter(order => {
        if (!order.Status) return false;
        const statusLc = order.Status.toLowerCase();
        return (
          statusLc === STATUSES.IN_PRODUCTION.toLowerCase() ||
          statusLc === STATUSES.IN_CUTTING.toLowerCase() ||
          statusLc === STATUSES.IN_STITCHING.toLowerCase() ||
          statusLc === STATUSES.QC.toLowerCase() ||
          statusLc.startsWith('qc-recontrol') ||
          statusLc === STATUSES.PACKING.toLowerCase()
        );
      });

      setOrders(filtered);
      setFilteredOrders(filtered);
    });

    return () => unsub();
  }, []);

  // ─── PARSE DATE UTILITY ─────────────────────────────────────────────────────────
  const parseDateString = (str) => {
    if (!str) return null;
    // Handle “dd.MM.yyyy”
    const dotParts = str.split('.');
    if (dotParts.length === 3 && /^\d{2}$/.test(dotParts[0])) {
      const [d, m, y] = dotParts.map(p => parseInt(p, 10));
      return new Date(y, m - 1, d);
    }
    // Handle “dd/Mon/yyyy” (e.g. “20/Jun/2025”)
    const slashParts = str.split('/');
    if (slashParts.length === 3 && isNaN(parseInt(slashParts[1], 10))) {
      const [dd, monStr, yyyy] = slashParts;
      const monthNames = {
        Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
        Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
      };
      const mIdx = monthNames[monStr];
      if (mIdx !== undefined) {
        return new Date(parseInt(yyyy, 10), mIdx, parseInt(dd, 10));
      }
    }
    // Otherwise try ISO “yyyy-MM-dd” or built‐in Date parsing
    const iso = new Date(str);
    return isNaN(iso) ? null : iso;
  };

  // ─── APPLY FILTERS ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const applyFilters = () => {
      const { orderDateFrom, orderDateTo, deliveryDateFrom, deliveryDateTo } = filters;

      const filtered = orders.filter(order => {
        // 1) Text filters (client & fabric)
        const clientMatch = order['Client Name']
          ?.toLowerCase()
          .includes(debouncedClient.toLowerCase());
        const fabricMatch = order['Fabric Code']
          ?.toLowerCase()
          .includes(debouncedFabric.toLowerCase());

        // 2) Order Date between
        const odVal = parseDateString(order['Order Date']);
        const orderDateOK =
          (!orderDateFrom || (odVal && odVal >= orderDateFrom)) &&
          (!orderDateTo   || (odVal && odVal <= orderDateTo));

        // 3) Delivery Date between
        const ddVal = parseDateString(order['Delivery Date']);
        const deliveryDateOK =
          (!deliveryDateFrom || (ddVal && ddVal >= deliveryDateFrom)) &&
          (!deliveryDateTo   || (ddVal && ddVal <= deliveryDateTo));

        return clientMatch && fabricMatch && orderDateOK && deliveryDateOK;
      });

      setFilteredOrders(filtered);
    };

    applyFilters();
  }, [
    debouncedClient,
    debouncedFabric,
    filters.orderDateFrom,
    filters.orderDateTo,
    filters.deliveryDateFrom,
    filters.deliveryDateTo,
    orders
  ]);

  // ─── SORTED ORDERS ───────────────────────────────────────────────────────────────
  const sortedOrders = useMemo(() => {
    const fieldName = fieldMap[sortBy];
    return [...filteredOrders].sort((a, b) => {
      const rawA = a[fieldName] || '';
      const rawB = b[fieldName] || '';

      // If sorting by date fields:
      if (sortBy === 'orderDate' || sortBy === 'deliveryDate') {
        const da = parseDateString(rawA);
        const db = parseDateString(rawB);
        if (da && db) {
          return sortDir === 'asc' ? da - db : db - da;
        }
        return 0;
      }

      // If sorting by quantity (numeric):
      if (sortBy === 'quantity') {
        return sortDir === 'asc'
          ? parseFloat(rawA) - parseFloat(rawB)
          : parseFloat(rawB) - parseFloat(rawA);
      }

      // Otherwise sort by string (case‐insensitive)
      const strA = rawA.toString().toLowerCase();
      const strB = rawB.toString().toLowerCase();
      if (strA < strB) return sortDir === 'asc' ? -1 : 1;
      if (strA > strB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredOrders, sortBy, sortDir]);

  // ─── HANDLERS ────────────────────────────────────────────────────────────────────

  // Change status in Firestore
  const handleStatusChange = async (id, newStatus) => {
    await updateDoc(doc(db, 'orders', id), { Status: newStatus });
  };

  // When QC modal closes, re‐fetch that one order so we get updated qcData
  const onQCFormClose = async () => {
    setQcOrder(null);
    if (!qcOrder) return;

    const docRef = doc(db, 'orders', qcOrder.id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const raw = docSnap.data();
      const measurementFields = {
        neck:           'Neck (cm)',
        chest:          'Chest (cm)',
        waist:          'Waist (cm)',
        hips:           'Hips (cm)',
        shoulderWidth:  'Shoulder Width (cm)',
        acrossShoulder: 'Across Shoulder',
        backWidth:      'Back Width',
        sleeveLength:   'Sleeve Length (cm)',
        bicep:          'Bicep (cm)',
        underElbow:     'Under Elbow',
        wristLeft:      'Wrist (cm) Left',
        wristRight:     'Wrist (cm) Right',
        shirtLength:    'Shirt Length (cm)',
        cuffLeft:       'Cuff Left',
        cuffRight:      'Cuff Right'
      };
      const measurements = {};
      for (const [key, firebaseField] of Object.entries(measurementFields)) {
        measurements[key] = raw[firebaseField] || '';
      }

      const updatedOrder = { id: docSnap.id, ...raw, measurements };
      setOrders(prev =>
        prev.map(o => (o.id === updatedOrder.id ? updatedOrder : o))
      );
      setFilteredOrders(prev =>
        prev.map(o => (o.id === updatedOrder.id ? updatedOrder : o))
      );
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilters({
      client: '',
      fabric: '',
      orderDateFrom: null,
      orderDateTo: null,
      deliveryDateFrom: null,
      deliveryDateTo: null
    });
  };

  // Handle column header click (sort toggle)
  const handleSort = (key) => {
    if (sortBy === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  // ─── RENDER ────────────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="text-center mt-2 px-2 min-h-screen overflow-y-auto">
        <h2 className="text-2xl font-bold text-gold mt-6 mb-4">
          {t.ordersInProduction || 'Orders in Production'}
        </h2>

        {/* ─── FILTERS ROW ──────────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap md:flex-nowrap justify-center gap-3 mb-6 relative z-10">
          {/* Client Name Filter */}
          <div className="w-full md:w-auto px-1">
            <label className="block text-gold text-sm mb-1">
              {t.client || 'Client Name'}
            </label>
            <input
              type="text"
              className="bg-black text-gold border border-gold px-2 py-1 rounded text-sm w-full"
              value={filters.client}
              onChange={e =>
                setFilters({ ...filters, client: e.target.value })
              }
              placeholder={
                isRS ? 'Unesite ime klijenta' : 'Enter client name'
              }
            />
          </div>

          {/* Fabric Code Filter */}
          <div className="w-full md:w-auto px-1">
            <label className="block text-gold text-sm mb-1">
              {t.fabric || 'Fabric Article'}
            </label>
            <input
              type="text"
              className="bg-black text-gold border border-gold px-2 py-1 rounded text-sm w-full"
              value={filters.fabric}
              onChange={e =>
                setFilters({ ...filters, fabric: e.target.value })
              }
              placeholder={
                isRS ? 'Unesite šifru tkanine' : 'Enter fabric code'
              }
            />
          </div>

          {/* Order Date From */}
          <div className="relative z-50 px-1">
            <label className="block text-gold text-sm mb-1">
              {isRS ? 'Datum Porudžbine Od' : 'Order Date From'}
            </label>
            <DatePicker
              calendarClassName="z-50"
              popperPlacement="bottom-start"
              popperModifiers={[
                { name: 'offset', options: { offset: [0, 10] } },
                {
                  name: 'preventOverflow',
                  options: { boundary: 'viewport', padding: 8 }
                },
                { name: 'flip', options: { fallbackPlacements: ['bottom'] } }
              ]}
              className="bg-black text-gold border border-gold px-2 py-1 rounded text-sm"
              dateFormat="dd/MM/yyyy"
              placeholderText="dd/mm/yyyy"
              selected={filters.orderDateFrom}
              onChange={date =>
                setFilters({ ...filters, orderDateFrom: date })
              }
            />
          </div>

          {/* Order Date To */}
          <div className="relative z-50 px-1">
            <label className="block text-gold text-sm mb-1">
              {isRS ? 'Datum Porudžbine Do' : 'Order Date To'}
            </label>
            <DatePicker
              calendarClassName="z-50"
              popperPlacement="bottom-start"
              popperModifiers={[
                { name: 'offset', options: { offset: [0, 10] } },
                {
                  name: 'preventOverflow',
                  options: { boundary: 'viewport', padding: 8 }
                },
                { name: 'flip', options: { fallbackPlacements: ['bottom'] } }
              ]}
              className="bg-black text-gold border border-gold px-2 py-1 rounded text-sm"
              dateFormat="dd/MM/yyyy"
              placeholderText="dd/mm/yyyy"
              selected={filters.orderDateTo}
              onChange={date =>
                setFilters({ ...filters, orderDateTo: date })
              }
            />
          </div>

          {/* Delivery Date From */}
          <div className="relative z-50 px-1">
            <label className="block text-gold text-sm mb-1">
              {isRS ? 'Datum Dostave Od' : 'Delivery Date From'}
            </label>
            <DatePicker
              calendarClassName="z-50"
              popperPlacement="bottom-start"
              popperModifiers={[
                { name: 'offset', options: { offset: [0, 10] } },
                {
                  name: 'preventOverflow',
                  options: { boundary: 'viewport', padding: 8 }
                },
                { name: 'flip', options: { fallbackPlacements: ['bottom'] } }
              ]}
              className="bg-black text-gold border border-gold px-2 py-1 rounded text-sm"
              dateFormat="dd/MM/yyyy"
              placeholderText="dd/mm/yyyy"
              selected={filters.deliveryDateFrom}
              onChange={date =>
                setFilters({ ...filters, deliveryDateFrom: date })
              }
            />
          </div>

          {/* Delivery Date To */}
          <div className="relative z-50 px-1">
            <label className="block text-gold text-sm mb-1">
              {isRS ? 'Datum Dostave Do' : 'Delivery Date To'}
            </label>
            <DatePicker
              calendarClassName="z-50"
              popperPlacement="bottom-start"
              popperModifiers={[
                { name: 'offset', options: { offset: [0, 10] } },
                {
                  name: 'preventOverflow',
                  options: { boundary: 'viewport', padding: 8 }
                },
                { name: 'flip', options: { fallbackPlacements: ['bottom'] } }
              ]}
              className="bg-black text-gold border border-gold px-2 py-1 rounded text-sm"
              dateFormat="dd/MM/yyyy"
              placeholderText="dd/mm/yyyy"
              selected={filters.deliveryDateTo}
              onChange={date =>
                setFilters({ ...filters, deliveryDateTo: date })
              }
            />
          </div>

          {/* Clear Filters */}
          <div className="flex items-end px-1">
            <button
              onClick={clearAllFilters}
              className="bg-gold hover:bg-yellow-500 text-black px-4 py-1 rounded text-sm"
            >
              {isRS ? 'Obriši Filtere' : 'Clear Filters'}
            </button>
          </div>
        </div>

        {/* ─── ORDERS TABLE ──────────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto mt-4">
          <table className="min-w-full table-auto text-left">
            <thead>
              <tr className="bg-gold text-black font-bold">
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleSort('client')}
                >
                  {isRS ? "Ime Klijenta" : "Client Name"}
                  {sortBy === "client" && <span>{sortDir === "asc" ? " ▲" : " ▼"}</span>}
                </th>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleSort('orderId')}
                >
                  {isRS ? "Nalog Broj" : "Order ID"}
                  {sortBy === "orderId" && <span>{sortDir === "asc" ? " ▲" : " ▼"}</span>}
                </th>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleSort('quantity')}
                >
                  {isRS ? "Količina" : "Quantity"}
                  {sortBy === "quantity" && <span>{sortDir === "asc" ? " ▲" : " ▼"}</span>}
                </th>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleSort('fabricCode')}
                >
                  {isRS ? "Artikal Materijala" : "Fabric Article"}
                  {sortBy === "fabricCode" && <span>{sortDir === "asc" ? " ▲" : " ▼"}</span>}
                </th>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleSort('orderDate')}
                >
                  {isRS ? "Datum Porudžbine" : "Order Date"}
                  {sortBy === "orderDate" && <span>{sortDir === "asc" ? " ▲" : " ▼"}</span>}
                </th>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleSort('deliveryDate')}
                >
                  {isRS ? "Datum Isporuke" : "Delivery Date"}
                  {sortBy === "deliveryDate" && <span>{sortDir === "asc" ? " ▲" : " ▼"}</span>}
                </th>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleSort('status')}
                >
                  {isRS ? "Status Naloga" : "Order Status"}
                  {sortBy === "status" && <span>{sortDir === "asc" ? " ▲" : " ▼"}</span>}
                </th>
                <th className="px-4 py-2">{isRS ? "Detalji" : "Details"}</th>
              </tr>
            </thead>

            <tbody>
              {sortedOrders.map(order => {
                // Lowercase status for all comparisons:
                const statusLc = (order.Status || '').toLowerCase();
                // The next statuses array (for IN_PRODUCTION → dropdown) also needs to come from NEXT_STATUS,
                // but keyed by lowercase:
                const nextStatuses = nextStatusMapLc[statusLc] || [];

                return (
                  <tr key={order.id} className="border-b border-gold text-gold">
                    {/* Client Name */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      {order['Client Name']}
                    </td>
                    {/* Order ID */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      {order['Order ID']}
                    </td>
                    {/* Ordered Quantity */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      {order['Ordered Quantity']}
                    </td>
                    {/* Fabric Article */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      {order['Fabric Code']}
                    </td>
                    {/* Order Date */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      {order['Order Date']}
                    </td>
                    {/* Delivery Date */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      {order['Delivery Date']}
                    </td>
                    {/* Order Status */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      {order.Status}
                    </td>

                    {/* ─── ACTIONS CELL ────────────────────────────────────────────────── */}
                    <td className="px-4 py-2 whitespace-nowrap space-y-1">
  {(() => {
    const statusLc = (order.Status || '').toLowerCase();

    if (statusLc === STATUSES.IN_PRODUCTION.toLowerCase()) {
      return (
        <select
          className="bg-black text-gold border border-gold px-2 py-1 rounded text-sm"
          value={order.Status}
          onChange={async (e) => {
            await updateDoc(doc(db, 'orders', order.id), {
              Status: e.target.value
            });
          }}
        >
          <option value={order.Status}>{order.Status}</option>
          {nextStatuses.map(status => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      );
    }

    if (statusLc === STATUSES.IN_CUTTING.toLowerCase()) {
      return (
        <button
          onClick={() => {
            const isFirstOpen =
              !order.actualConsumedMeters ||
              order.actualConsumedMeters === 0;
            setSkipStatusUpdate(!isFirstOpen);
            setMeterConfirmOrder(order);
          }}
          className="px-2 py-1 bg-yellow-500 hover:bg-yellow-400 text-black rounded text-sm"
        >
          {isRS
            ? 'Potvrdi Metre i Dokroji'
            : 'Confirm Meters & Recut'}
        </button>
      );
    }

    if (statusLc === STATUSES.IN_STITCHING.toLowerCase()) {
  return (
    <>
      <button
        onClick={() => {
          setSkipStatusUpdate(true);
          setMeterConfirmOrder(order);
        }}
        className="px-2 py-1 bg-orange-600 hover:bg-orange-500 text-black rounded text-sm"
      >
        {isRS ? 'Dodaj Dokrojeno' : 'Add Recut'}
      </button>
      <button
        onClick={async () => {
          await updateDoc(doc(db, 'orders', order.id), {
            Status: STATUSES.QC
          });
        }}
        className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm ml-2"
      >
        {isRS ? 'Idi na QC' : 'Move to QC'}
      </button>
    </>
  );
}

    if (
      statusLc === STATUSES.QC.toLowerCase() ||
      statusLc.startsWith('qc-recontrol')
    ) {
      return (
        <>
          <button
            onClick={() => setQcOrder(order)}
            className="mt-1 px-2 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-sm"
          >
            {isRS ? 'QC Kontrola' : 'QC Control'}
          </button>
          <button
            onClick={() => {
              setSkipStatusUpdate(true);
              setMeterConfirmOrder(order);
            }}
            className="mt-1 px-2 py-1 bg-orange-600 hover:bg-orange-500 text-black rounded text-sm"
          >
            {isRS ? 'Dodaj Dokrojeno' : 'Add Recut'}
          </button>
          <button
            onClick={() => setQcReportOrder(order)}
            className="mt-1 px-2 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs"
          >
            {isRS ? 'QC Izveštaj' : 'QC Report'}
          </button>
        </>
      );
    }

    if (statusLc === STATUSES.PACKING.toLowerCase()) {
      return (
        <>
          <button
            onClick={() => {
              setSkipStatusUpdate(true);
              setMeterConfirmOrder(order);
            }}
            className="mt-1 px-2 py-1 bg-orange-600 hover:bg-orange-500 text-black rounded text-sm"
          >
            {isRS ? 'Dodaj Dokrojeno' : 'Add Recut'}
          </button>
          <button
            onClick={() => setQcReportOrder(order)}
            className="mt-1 px-2 py-1 bg-green-700 hover:bg-green-500 text-white rounded text-xs"
          >
            {isRS ? 'QC Izveštaj' : 'QC Report'}
          </button>
          <button
            onClick={async () => {
              await updateDoc(doc(db, 'orders', order.id), {
                Status: STATUSES.DELIVERED,
                deliveredDate: new Date().toISOString().split('T')[0]
              });
            }}
            className="mt-1 px-2 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-sm"
          >
            {isRS ? 'Označi isporučeno' : 'Mark Delivered'}
          </button>
        </>
      );
    }

    if (statusLc === STATUSES.DELIVERED.toLowerCase()) {
      return (
        <button
          onClick={() => setQcReportOrder(order)}
          className="mt-1 px-2 py-1 bg-green-700 hover:bg-green-500 text-white rounded text-xs"
        >
          {isRS ? 'QC Izveštaj' : 'QC Report'}
        </button>
      );
    }

    return null;
  })()}
</td>


                    {/* ─── DETAILS CELL (PrintOrderSheet) ────────────────────────────────── */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      <button
                        onClick={() => setDetailOrder(order)}
                        className="bg-gold hover:bg-yellow-500 text-black px-2 py-1 rounded text-sm"
                      >
                        {isRS ? 'Detalji' : 'Details'}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {sortedOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-4 text-gold">
                    {isRS
                      ? 'Nema porudžbina u proizvodnji koje zadovoljavaju filtere.'
                      : 'No in‐production orders match your filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ─── PRINT “DETAILS” MODAL ──────────────────────────────────────────────────── */}
        {detailOrder && (
          <PrintOrderSheet
            order={detailOrder}
            onClose={() => setDetailOrder(null)}
            onPrintComplete={() => setDetailOrder(null)}
          />
        )}

        {/* ─── QC FORM MODAL ──────────────────────────────────────────────────────────── */}
        {qcOrder && (
          <QCFormModal
            isOpen={!!qcOrder}
            onClose={onQCFormClose}
            order={qcOrder}
            skipStatusUpdate={skipStatusUpdate}
          />
        )}

        {/* ─── QC REPORT VIEW ────────────────────────────────────────────────────────── */}
        {qcReportOrder && (
          <QCReportView
            isOpen={!!qcReportOrder}
            onClose={() => setQcReportOrder(null)}
            order={qcReportOrder}
          />
        )}

        {/* ─── CONFIRM METERS & RECUT MODAL ───────────────────────────────────────────── */}
        {meterConfirmOrder && (
          <ConfirmMeterModal
            order={meterConfirmOrder}
            onClose={() => setMeterConfirmOrder(null)}
            onConfirmed={(orderId, confirmedMeters, recuts) => {
              // Update local state so the row immediately reflects new actual/recuts.
              setOrders(prev =>
                prev.map(o =>
                  o.id === orderId
                    ? {
                        ...o,
                        actualConsumedMeters: confirmedMeters,
                        recutsCount: recuts.length
                      }
                    : o
                )
              );
              setFilteredOrders(prev =>
                prev.map(o =>
                  o.id === orderId
                    ? {
                        ...o,
                        actualConsumedMeters: confirmedMeters,
                        recutsCount: recuts.length
                      }
                    : o
                )
              );
            }}
          />
        )}
      </div>
    </Layout>
  );
};

export default OrdersInProductionPage;
