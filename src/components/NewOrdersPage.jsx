// src/components/NewOrdersPage.jsx

import React, { useEffect, useState, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { db } from '../firebase/config';
import {
  collection,
  getDocs,
  doc,
  updateDoc
} from 'firebase/firestore';
import Layout from './Layout';
import { useLanguage } from '../context/LanguageContext';
import labels from '../constants/labels';

// ─── Import your actual PrintOrderSheet ──────────────────────────────────────
import PrintOrderSheet from './PrintOrderSheet';

// Debounce hook (200ms default)
function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debounced;
}

const NewOrdersPage = () => {
  const { language } = useLanguage();
  const t = labels[language] || {};

  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);

  const [filters, setFilters] = useState({
    client: '',
    fabric: '',
    orderDateFrom: '',
    orderDateTo: '',
    deliveryDateFrom: '',
    deliveryDateTo: ''
  });
  const debouncedClient = useDebouncedValue(filters.client, 200);
  const debouncedFabric = useDebouncedValue(filters.fabric, 200);

  // For the “Print” sheet of a single order:
  const [showPrintSheet, setShowPrintSheet] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Sorting state:
  const [sortBy, setSortBy] = useState('orderDate');
  const [sortDir, setSortDir] = useState('desc');

  // ─── 1) Fetch orders with Status “Pending” on mount ─────────────────────────
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'orders'));
        const data = snapshot.docs
          .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
          // Only include orders where Status is missing or exactly "Pending"
          .filter(order => !order.Status || order.Status === 'Pending');
        setOrders(data);
        setFilteredOrders(data);
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  // ─── Date parsing helpers ───────────────────────────────────────────────────
  const parseDate = str => {
    if (!str) return null;
    const parts = str.split('.');
    if (parts.length === 3) {
      const [day, month, year] = parts.map(p => parseInt(p, 10));
      if (
        !isNaN(day) &&
        !isNaN(month) &&
        !isNaN(year) &&
        year >= 1000 &&
        month >= 1 &&
        month <= 12 &&
        day >= 1 &&
        day <= 31
      ) {
        return new Date(year, month - 1, day);
      }
    }
    const iso = new Date(str);
    return isNaN(iso) ? null : iso;
  };

  const buildLocalISO = date => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // ─── 2) Re-apply filters whenever debouncedClient, debouncedFabric, or date filters change ─
  useEffect(() => {
    const applyFilters = () => {
      setFiltering(true);
      const filtered = orders.filter(order => {
        // Text filters
        const clientMatch = order['Client Name']
          ?.toLowerCase()
          .includes(debouncedClient.toLowerCase());
        const fabricMatch = order['Fabric Code']
          ?.toLowerCase()
          .includes(debouncedFabric.toLowerCase());

        // Parse order’s stored dates (could be "dd.MM.yyyy" or "yyyy-MM-dd")
        const rawOrderDate = (order['Order Date'] || '').replace(/-/g, '.');
        const rawDeliveryDate = (order['Delivery Date'] || '').replace(/-/g, '.');
        const orderDate = parseDate(rawOrderDate);
        const deliveryDate = parseDate(rawDeliveryDate);

        // Parse filters (ISO format)
        const orderFrom =
          filters.orderDateFrom.length > 0
            ? new Date(filters.orderDateFrom)
            : null;
        const orderTo =
          filters.orderDateTo.length > 0
            ? new Date(filters.orderDateTo)
            : null;
        const deliveryFrom =
          filters.deliveryDateFrom.length > 0
            ? new Date(filters.deliveryDateFrom)
            : null;
        const deliveryTo =
          filters.deliveryDateTo.length > 0
            ? new Date(filters.deliveryDateTo)
            : null;

        // Inclusive checks
        const orderDateOK =
          (!orderFrom || (orderDate && orderDate >= orderFrom)) &&
          (!orderTo || (orderDate && orderDate <= orderTo));

        const deliveryOK =
          (!deliveryFrom || (deliveryDate && deliveryDate >= deliveryFrom)) &&
          (!deliveryTo || (deliveryDate && deliveryDate <= deliveryTo));

        return clientMatch && fabricMatch && orderDateOK && deliveryOK;
      });
      setFilteredOrders(filtered);
      setFiltering(false);
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

  // Map sort keys to actual field names
  const fieldMap = {
    client: 'Client Name',
    orderId: 'Order ID',
    quantity: 'Ordered Quantity',
    fabricCode: 'Fabric Code',
    orderDate: 'Order Date',
    deliveryDate: 'Delivery Date',
    status: 'Status'
  };

  // ─── 3) Sort filteredOrders when sortBy or sortDir change ───────────────
  const sortedOrders = useMemo(() => {
    const fieldName = fieldMap[sortBy];
    return [...filteredOrders].sort((a, b) => {
      const rawA = a[fieldName] || '';
      const rawB = b[fieldName] || '';

      // Date sort
      if (sortBy === 'orderDate' || sortBy === 'deliveryDate') {
        const da =
          parseDate(rawA.replace(/-/g, '.')) || new Date(rawA);
        const db =
          parseDate(rawB.replace(/-/g, '.')) || new Date(rawB);
        return sortDir === 'asc' ? da - db : db - da;
      }

      // Numeric sort (quantity)
      if (sortBy === 'quantity') {
        return sortDir === 'asc'
          ? parseFloat(rawA) - parseFloat(rawB)
          : parseFloat(rawB) - parseFloat(rawA);
      }

      // String sort
      const strA = rawA.toString().toLowerCase();
      const strB = rawB.toString().toLowerCase();
      if (strA < strB) return sortDir === 'asc' ? -1 : 1;
      if (strA > strB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredOrders, sortBy, sortDir]);

  // ─── 4) Handle single-order print: open your PrintOrderSheet ─────────────
  const handlePrint = order => {
    setSelectedOrder(order);
    setShowPrintSheet(true);
  };

  // ─── 5) Sort-header click handler ────────────────────────────────────────
  const handleSort = key => {
    if (sortBy === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  // ─── 6) Clear filters ────────────────────────────────────────────────────
  const clearAllFilters = () => {
    setFilters({
      client: '',
      fabric: '',
      orderDateFrom: '',
      orderDateTo: '',
      deliveryDateFrom: '',
      deliveryDateTo: ''
    });
  };

  return (
    <Layout>
      <div className="text-center mt-2 px-2">
        <h2 className="text-2xl font-bold text-gold mb-2">
          {t.newOrders ||
            (language === 'sr' ? 'Nove Porudžbine' : 'New Orders')}
        </h2>
        <p className="text-gold mb-2">
          {language === 'sr'
            ? `Prikazano ${filteredOrders.length} od ${orders.length} porudžbina`
            : `Showing ${filteredOrders.length} of ${orders.length} orders`}
        </p>

        {/* ===== FILTER ROW ===== */}
        <div className="flex flex-wrap md:flex-nowrap items-end justify-center gap-3 mb-4">
          {/* 1) Client Name */}
          <div className="w-40 md:w-56 px-1">
            <label
              htmlFor="clientFilter"
              className="block text-gold text-sm mb-1"
            >
              {t.client ||
                (language === 'sr' ? 'Ime Klijenta' : 'Client Name')}
            </label>
            <input
              id="clientFilter"
              type="text"
              className="w-full bg-black text-gold border border-gold px-2 py-1 rounded text-sm"
              value={filters.client}
              onChange={e =>
                setFilters({ ...filters, client: e.target.value })
              }
              placeholder={
                language === 'sr'
                  ? 'Unesite ime klijenta'
                  : 'Enter client name'
              }
            />
          </div>

          {/* 2) Fabric Code */}
          <div className="w-40 md:w-56 px-1">
            <label
              htmlFor="fabricFilter"
              className="block text-gold text-sm mb-1"
            >
              {t.fabric ||
                (language === 'sr' ? 'Šifra Tkanine' : 'Fabric Code')}
            </label>
            <input
              id="fabricFilter"
              type="text"
              className="w-full bg-black text-gold border border-gold px-2 py-1 rounded text-sm"
              value={filters.fabric}
              onChange={e =>
                setFilters({ ...filters, fabric: e.target.value })
              }
              placeholder={
                language === 'sr'
                  ? 'Unesite šifru tkanine'
                  : 'Enter fabric code'
              }
            />
          </div>

          {/* 3) Order Date From */}
          <div className="w-40 md:w-56 relative z-50 px-1">
            <label
              htmlFor="orderDateFrom"
              className="block text-gold text-sm mb-1"
            >
              {language === 'sr'
                ? 'Datum Porudžbine Od'
                : 'Order Date From'}
            </label>
            <DatePicker
              id="orderDateFrom"
              selected={
                filters.orderDateFrom
                  ? new Date(filters.orderDateFrom)
                  : null
              }
              onChange={date => {
                const localIso = buildLocalISO(date);
                setFilters({
                  ...filters,
                  orderDateFrom: localIso
                });
              }}
              className="w-full bg-black text-gold border border-gold px-2 py-1 rounded text-sm"
              dateFormat="dd/MM/yyyy"
              placeholderText="dd/mm/yyyy"
            />
          </div>

          {/* 4) Order Date To */}
          <div className="w-40 md:w-56 relative z-50 px-1">
            <label
              htmlFor="orderDateTo"
              className="block text-gold text-sm mb-1"
            >
              {language === 'sr'
                ? 'Datum Porudžbine Do'
                : 'Order Date To'}
            </label>
            <DatePicker
              id="orderDateTo"
              selected={
                filters.orderDateTo
                  ? new Date(filters.orderDateTo)
                  : null
              }
              onChange={date => {
                const localIso = buildLocalISO(date);
                setFilters({
                  ...filters,
                  orderDateTo: localIso
                });
              }}
              className="w-full bg-black text-gold border border-gold px-2 py-1 rounded text-sm"
              dateFormat="dd/MM/yyyy"
              placeholderText="dd/mm/yyyy"
            />
          </div>

          {/* 5) Delivery Date From */}
          <div className="w-40 md:w-56 relative z-50 px-1">
            <label
              htmlFor="deliveryDateFrom"
              className="block text-gold text-sm mb-1"
            >
              {language === 'sr'
                ? 'Datum Isporuke Od'
                : 'Delivery Date From'}
            </label>
            <DatePicker
              id="deliveryDateFrom"
              selected={
                filters.deliveryDateFrom
                  ? new Date(filters.deliveryDateFrom)
                  : null
              }
              onChange={date => {
                const localIso = buildLocalISO(date);
                setFilters({
                  ...filters,
                  deliveryDateFrom: localIso
                });
              }}
              className="w-full bg-black text-gold border border-gold px-2 py-1 rounded text-sm"
              dateFormat="dd/MM/yyyy"
              placeholderText="dd/mm/yyyy"
            />
          </div>

          {/* 6) Delivery Date To */}
          <div className="w-40 md:w-56 relative z-50 px-1">
            <label
              htmlFor="deliveryDateTo"
              className="block text-gold text-sm mb-1"
            >
              {language === 'sr'
                ? 'Datum Isporuke Do'
                : 'Delivery Date To'}
            </label>
            <DatePicker
              id="deliveryDateTo"
              selected={
                filters.deliveryDateTo
                  ? new Date(filters.deliveryDateTo)
                  : null
              }
              onChange={date => {
                const localIso = buildLocalISO(date);
                setFilters({
                  ...filters,
                  deliveryDateTo: localIso
                });
              }}
              className="w-full bg-black text-gold border border-gold px-2 py-1 rounded text-sm"
              dateFormat="dd/MM/yyyy"
              placeholderText="dd/mm/yyyy"
            />
          </div>

          {/* 7) Clear Filters Button */}
          <div className="flex items-center px-1">
            <button
              onClick={clearAllFilters}
              className="bg-gold hover:bg-yellow-500 text-black px-4 py-1 rounded text-sm"
            >
              {language === 'sr' ? 'Obriši Filtere' : 'Clear Filters'}
            </button>
          </div>
        </div>

        {(filtering || loading) && (
          <p className="text-gold mb-2">
            {filtering
              ? language === 'sr'
                ? 'Filtriranje…'
                : 'Filtering…'
              : language === 'sr'
              ? 'Učitavanje…'
              : 'Loading…'}
          </p>
        )}

        {/* ===== ORDERS TABLE ===== */}
        <div className="overflow-x-auto mt-2">
          <table className="min-w-full table-auto">
            <thead className="bg-gold text-black">
              <tr>
                {[
                  { labelKey: 'client', fallback: 'Client Name', fieldKey: 'client' },
                  { labelKey: 'orderId', fallback: 'Order ID', fieldKey: 'orderId' },
                  { labelKey: 'quantity', fallback: 'Order Quantity', fieldKey: 'quantity' },
                  { labelKey: 'fabricCode', fallback: 'Fabric Code', fieldKey: 'fabricCode' },
                  { labelKey: 'orderDate', fallback: 'Order Date', fieldKey: 'orderDate' },
                  { labelKey: 'deliveryDate', fallback: 'Delivery Date', fieldKey: 'deliveryDate' },
                  { labelKey: 'status', fallback: 'Status', fieldKey: 'status' }
                ].map(({ labelKey, fallback, fieldKey }) => (
                  <th
                    key={fieldKey}
                    className="px-4 py-2 cursor-pointer select-none"
                    onClick={() => handleSort(fieldKey)}
                    aria-label={`Sort by ${fallback}`}
                  >
                    <div className="flex items-center gap-1">
                      {t[labelKey] || fallback}
                      {sortBy === fieldKey && (
                        <span>{sortDir === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-2">{t.print || 'Print'}</th>
              </tr>
            </thead>
            <tbody>
              {sortedOrders.map(order => (
                <tr
                  key={order.id}
                  className="border-b border-gold text-gold"
                >
                  <td className="px-4 py-2">{order['Client Name']}</td>
                  <td className="px-4 py-2">{order['Order ID']}</td>
                  <td className="px-4 py-2">{order['Ordered Quantity']}</td>
                  <td className="px-4 py-2">{order['Fabric Code']}</td>
                  <td className="px-4 py-2">
                    {(order['Order Date'] || '').replace(/-/g, '/')}
                  </td>
                  <td className="px-4 py-2">
                    {(order['Delivery Date'] || '').replace(/-/g, '/')}
                  </td>
                  <td className="px-4 py-2">
                    {order.Status || 'Pending'}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handlePrint(order)}
                      className="bg-gold hover:bg-yellow-500 text-black px-3 py-1 rounded text-sm"
                      aria-label={`Print order ${order['Order ID']}`}
                    >
                      {t.print || 'Print'}
                    </button>
                  </td>
                </tr>
              ))}

              {sortedOrders.length === 0 && !loading && !filtering && (
                <tr>
                  <td colSpan={8} className="text-center py-4 text-gold">
                    {language === 'sr'
                      ? 'Nema porudžbina koje zadovoljavaju filtere.'
                      : 'No orders match your filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== YOUR PRINT ORDER SHEET MODAL ===== */}
      {showPrintSheet && selectedOrder && (
        <PrintOrderSheet
          order={selectedOrder}
          onClose={() => setShowPrintSheet(false)}
          onPrintComplete={async () => {
            try {
              // 1) Update Firestore: Status = "In Production"
              await updateDoc(doc(db, 'orders', selectedOrder.id), {
                Status: 'In Production'
              });
            } catch (err) {
              console.error(
                'Error updating Status to In Production:',
                err
              );
            }

            // 2) Remove that order from local state so it vanishes from “New Orders”
            setOrders(prev =>
              prev.filter(o => o.id !== selectedOrder.id)
            );
            setFilteredOrders(prev =>
              prev.filter(o => o.id !== selectedOrder.id)
            );

            // 3) Close the sheet
            setShowPrintSheet(false);
          }}
        />
      )}
    </Layout>
  );
};

export default NewOrdersPage;
