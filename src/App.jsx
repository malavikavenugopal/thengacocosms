import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import B2BShipments from './pages/B2BShipments';
import B2CShipments from './pages/B2CShipments';
import DamageTracking from './pages/DamageTracking';
import MonthlyStockCheck from './pages/MonthlyStockCheck';
import Reports from './pages/Reports';
import Products from './pages/Products';
import Staff from './pages/Staff';
import Channels from './pages/Channels';
import Couriers from './pages/Couriers';
import Returns from './pages/Returns';
import PurchaseManagement from './pages/PurchaseManagement';
import ReorderPoint from './pages/ReorderPoint';
import CandleManufacturing from './pages/CandleManufacturing';
import Login from './pages/Login';
import { GlobalProvider, useGlobalState } from './context/GlobalContext';

const ProtectedRoute = ({ children }) => {
  const { currentUser, authLoading } = useGlobalState();

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-600 font-medium tracking-wide">Authenticating...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <GlobalProvider>
      <Toaster position="top-right" reverseOrder={false} />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="purchases" element={<PurchaseManagement />} />
            <Route path="staff" element={<Staff />} />
            <Route path="channels" element={<Channels />} />
            <Route path="couriers" element={<Couriers />} />
            <Route path="returns" element={<Returns />} />
            <Route path="b2b" element={<B2BShipments />} />
            <Route path="b2c" element={<B2CShipments />} />
            <Route path="damage" element={<DamageTracking />} />
            <Route path="stock" element={<MonthlyStockCheck />} />
            <Route path="rop" element={<ReorderPoint />} />
            <Route path="manufacturing" element={<CandleManufacturing />} />
            <Route path="reports" element={<Reports />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </GlobalProvider>
  );
}

export default App;
