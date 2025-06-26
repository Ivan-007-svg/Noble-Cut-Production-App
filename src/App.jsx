import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NewOrdersPage from './components/NewOrdersPage';
import ProductionOrdersPage from './components/ProductionOrdersPage';
import DeliveredOrdersPage from './components/DeliveredOrdersPage'; // ✅ Import this

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<NewOrdersPage />} />
        <Route path="/production" element={<ProductionOrdersPage />} />
        <Route path="/delivered" element={<DeliveredOrdersPage />} /> {/* ✅ New route */}
      </Routes>
    </Router>
  );
}
