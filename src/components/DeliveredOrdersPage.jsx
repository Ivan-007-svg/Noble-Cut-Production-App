import React, { useEffect, useState, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { db } from '../firebase/config';
import { collection, onSnapshot } from 'firebase/firestore';
import Layout from './Layout';
import { useLanguage } from '../context/LanguageContext';
import labels from '../constants/labels';
import PrintOrderSheet from './PrintOrderSheet';
import QCReportView from './QCReportView';
import * as XLSX from 'xlsx'; // <-- Add this line

function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debounced;
}

function parseDateString(str) {
  if (!str) return null;
  const dotParts = str.split('.');
  if (dotParts.length === 3 && /^\d{2}$/.test(dotParts[0])) {
    const [d, m, y] = dotParts.map(p => parseInt(p, 10));
    return new Date(y, m - 1, d);
  }
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
  const iso = new Date(str);
  return isNaN(iso) ? null : iso;
}

const DeliveredOrdersPage = () => {
  const { language } = useLanguage();
  // Bulletproof translation object
  const t = labels[language] || labels['sr'] || labels['en'] || {};

  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
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

  const [detailOrder, setDetailOrder] = useState(null);
  const [qcReportOrder, setQcReportOrder] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'orders'), snapshot => {
      const data = snapshot.docs.map(docSnap => {
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
          shirtLength:    'Shirt Length (cm)'
        };
        const measurements = {};
        for (const [key, firebaseField] of Object.entries(measurementFields)) {
          measurements[key] = raw[firebaseField] || '';
        }
        return { id: docSnap.id, ...raw, measurements };
      });

      const delivered = data.filter(order => {
        if (!order.Status) return false;
        return order.Status.toLowerCase() === 'delivered';
      });
      setOrders(delivered);
      setFilteredOrders(delivered);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const { orderDateFrom, orderDateTo, deliveryDateFrom, deliveryDateTo } = filters;
    const filtered = orders.filter(order => {
      const clientMatch = (order['Client Name'] || '')
        .toLowerCase()
        .includes(debouncedClient.toLowerCase());
      const fabricMatch = (order['Fabric Code'] || order['Fabric Article'] || '')
        .toLowerCase()
        .includes(debouncedFabric.toLowerCase());

      const odVal = parseDateString(order['Order Date']);
      const orderDateOK =
        (!orderDateFrom || (odVal && odVal >= orderDateFrom)) &&
        (!orderDateTo   || (odVal && odVal <= orderDateTo));

      const ddVal = parseDateString(order['Delivery Date']);
      const deliveryDateOK =
        (!deliveryDateFrom || (ddVal && ddVal >= deliveryDateFrom)) &&
        (!deliveryDateTo   || (ddVal && ddVal <= deliveryDateTo));

      return clientMatch && fabricMatch && orderDateOK && deliveryDateOK;
    });
    setFilteredOrders(filtered);
  }, [
    debouncedClient,
    debouncedFabric,
    filters.orderDateFrom,
    filters.orderDateTo,
    filters.deliveryDateFrom,
    filters.deliveryDateTo,
    orders
  ]);

  const [sortBy, setSortBy] = useState('orderDate');
  const [sortDir, setSortDir] = useState('desc');
  const fieldMap = {
    client:       'Client Name',
    orderId:      'Order ID',
    quantity:     'Ordered Quantity',
    fabricCode:   'Fabric Code',
    orderDate:    'Order Date',
    deliveryDate: 'Delivery Date',
    status:       'Status'
  };
  const sortedOrders = useMemo(() => {
    const fieldName = fieldMap[sortBy];
    return [...filteredOrders].sort((a, b) => {
      const rawA = a[fieldName] || '';
      const rawB = b[fieldName] || '';

      if (sortBy === 'orderDate' || sortBy === 'deliveryDate') {
        const da = parseDateString(rawA);
        const db = parseDateString(rawB);
        if (da && db) {
          return sortDir === 'asc' ? da - db : db - da;
        }
        return 0;
      }
      if (sortBy === 'quantity') {
        return sortDir === 'asc'
          ? parseFloat(rawA) - parseFloat(rawB)
          : parseFloat(rawB) - parseFloat(rawA);
      }
      const strA = rawA.toString().toLowerCase();
      const strB = rawB.toString().toLowerCase();
      if (strA < strB) return sortDir === 'asc' ? -1 : 1;
      if (strA > strB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredOrders, sortBy, sortDir]);

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

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  // --- EXPORT TO EXCEL FUNCTION ---
  const exportToExcel = () => {
    const exportData = sortedOrders.map(order => ({
      'Client Name': order['Client Name'],
      'Order ID': order['Order ID'],
      'Quantity': order['Ordered Quantity'],
      'Fabric Code/Article': order['Fabric Code'] || order['Fabric Article'],
      'Order Date': order['Order Date'],
      'Delivery Date': order['Delivery Date'],
      'Status': displayStatus(order.Status),
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Delivered Orders');
    XLSX.writeFile(wb, 'DeliveredOrders.xlsx');
  };
  // --- END EXPORT TO EXCEL FUNCTION ---

  // Translation for status
  function displayStatus(status) {
    if (!status) return '';
    const statusLc = status.toLowerCase();
    if (statusLc === 'delivered') {
      return t.delivered || 'Isporučeno';
    }
    return status;
  }

  return (
    <Layout>
      <div className="text-center mt-2 px-2 min-h-screen overflow-y-auto">
        <h2 className="text-2xl font-bold text-gold mt-6 mb-4">
          {t.deliveredOrders || 'Delivered Orders'}
        </h2>

        {/* FILTERS */}
        <div className="flex flex-wrap md:flex-nowrap justify-center gap-3 mb-6 relative z-10">
          <div className="w-full md:w-auto px-1">
            <label className="block text-gold text-sm mb-1">
              {t.client || "Client Name"}
            </label>
            <input
              type="text"
              className="bg-black text-gold border border-gold px-2 py-1 rounded text-sm w-full"
              value={filters.client}
              onChange={e => setFilters({ ...filters, client: e.target.value })}
              placeholder={t.clientPlaceholder || "Enter client name"}
            />
          </div>
          <div className="w-full md:w-auto px-1">
            <label className="block text-gold text-sm mb-1">
              {t.fabric || "Fabric Article"}
            </label>
            <input
              type="text"
              className="bg-black text-gold border border-gold px-2 py-1 rounded text-sm w-full"
              value={filters.fabric}
              onChange={e => setFilters({ ...filters, fabric: e.target.value })}
              placeholder={t.fabricPlaceholder || "Enter fabric code"}
            />
          </div>
          <div className="relative z-50 px-1">
            <label className="block text-gold text-sm mb-1">
              {t.orderDateFrom || 'Order Date From'}
            </label>
            <DatePicker
              calendarClassName="z-50"
              popperPlacement="bottom-start"
              className="bg-black text-gold border border-gold px-2 py-1 rounded text-sm"
              dateFormat="dd/MM/yyyy"
              placeholderText={t.datePlaceholder || "dd/mm/yyyy"}
              selected={filters.orderDateFrom}
              onChange={date => setFilters({ ...filters, orderDateFrom: date })}
            />
          </div>
          <div className="relative z-50 px-1">
            <label className="block text-gold text-sm mb-1">
              {t.orderDateTo || 'Order Date To'}
            </label>
            <DatePicker
              calendarClassName="z-50"
              popperPlacement="bottom-start"
              className="bg-black text-gold border border-gold px-2 py-1 rounded text-sm"
              dateFormat="dd/MM/yyyy"
              placeholderText={t.datePlaceholder || "dd/mm/yyyy"}
              selected={filters.orderDateTo}
              onChange={date => setFilters({ ...filters, orderDateTo: date })}
            />
          </div>
          <div className="relative z-50 px-1">
            <label className="block text-gold text-sm mb-1">
              {t.deliveryDateFrom || 'Delivery Date From'}
            </label>
            <DatePicker
              calendarClassName="z-50"
              popperPlacement="bottom-start"
              className="bg-black text-gold border border-gold px-2 py-1 rounded text-sm"
              dateFormat="dd/MM/yyyy"
              placeholderText={t.datePlaceholder || "dd/mm/yyyy"}
              selected={filters.deliveryDateFrom}
              onChange={date => setFilters({ ...filters, deliveryDateFrom: date })}
            />
          </div>
          <div className="relative z-50 px-1">
            <label className="block text-gold text-sm mb-1">
              {t.deliveryDateTo || 'Delivery Date To'}
            </label>
            <DatePicker
              calendarClassName="z-50"
              popperPlacement="bottom-start"
              className="bg-black text-gold border border-gold px-2 py-1 rounded text-sm"
              dateFormat="dd/MM/yyyy"
              placeholderText={t.datePlaceholder || "dd/mm/yyyy"}
              selected={filters.deliveryDateTo}
              onChange={date => setFilters({ ...filters, deliveryDateTo: date })}
            />
          </div>
          <div className="flex items-end px-1">
            <button
              onClick={clearAllFilters}
              className="bg-gold hover:bg-yellow-500 text-black px-4 py-1 rounded text-sm"
            >
              {t.clearFilters || 'Clear Filters'}
            </button>
            <button
              onClick={exportToExcel}
              style={{
                backgroundColor: '#c5a253',
                color: 'black',
              }}
              className="px-4 py-1 rounded text-sm ml-2 hover:brightness-110 transition"
            >
              {t.exportExcel || 'Export to Excel'}
            </button>
          </div>
        </div>

        {/* ORDERS TABLE */}
        <div className="overflow-x-auto mt-4">
          <table className="min-w-full table-auto text-left">
            <thead>
              <tr className="bg-gold text-black font-bold">
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('client')}>
                  {t.client || "Client Name"}
                  {sortBy === "client" && <span>{sortDir === "asc" ? " ▲" : " ▼"}</span>}
                </th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('orderId')}>
                  {t.orderId || "Order ID"}
                  {sortBy === "orderId" && <span>{sortDir === "asc" ? " ▲" : " ▼"}</span>}
                </th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('quantity')}>
                  {t.quantity || "Quantity"}
                  {sortBy === "quantity" && <span>{sortDir === "asc" ? " ▲" : " ▼"}</span>}
                </th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('fabricCode')}>
                  {t.fabric || "Fabric Article"}
                  {sortBy === "fabricCode" && <span>{sortDir === "asc" ? " ▲" : " ▼"}</span>}
                </th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('orderDate')}>
                  {t.orderDate || "Order Date"}
                  {sortBy === "orderDate" && <span>{sortDir === "asc" ? " ▲" : " ▼"}</span>}
                </th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('deliveryDate')}>
                  {t.deliveryDate || "Delivery Date"}
                  {sortBy === "deliveryDate" && <span>{sortDir === "asc" ? " ▲" : " ▼"}</span>}
                </th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('status')}>
                  {t.orderStatus || "Order Status"}
                  {sortBy === "status" && <span>{sortDir === "asc" ? " ▲" : " ▼"}</span>}
                </th>
                <th className="px-4 py-2">{t.details || "Details"}</th>
                <th className="px-4 py-2">{t.qcReport || "QC Report"}</th>
              </tr>
            </thead>
            <tbody>
              {sortedOrders.map(order => (
                <tr key={order.id} className="border-b border-gold text-gold">
                  <td className="px-4 py-2 whitespace-nowrap">{order['Client Name']}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{order['Order ID']}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{order['Ordered Quantity']}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{order['Fabric Code'] || order['Fabric Article']}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{order['Order Date']}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{order['Delivery Date']}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{displayStatus(order.Status)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <button
                      onClick={() => setDetailOrder(order)}
                      className="bg-gold hover:bg-yellow-500 text-black px-2 py-1 rounded text-sm"
                    >
                      {t.details || 'Details'}
                    </button>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <button
                      onClick={() => setQcReportOrder(order)}
                      className="bg-green-700 hover:bg-green-500 text-white px-4 py-1 rounded text-sm"
                    >
                      {t.qcReport || 'QC Report'}
                    </button>
                  </td>
                </tr>
              ))}
              {sortedOrders.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-4 text-gold">
                    {t.noDeliveredOrdersFound || 'No delivered orders match your filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* MODALS */}
        {detailOrder && (
          <PrintOrderSheet
            order={detailOrder}
            onClose={() => setDetailOrder(null)}
          />
        )}
        {qcReportOrder && (
          <QCReportView
            isOpen={!!qcReportOrder}
            onClose={() => setQcReportOrder(null)}
            order={qcReportOrder}
          />
        )}
      </div>
    </Layout>
  );
};

export default DeliveredOrdersPage;
