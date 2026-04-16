import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
import { GlobalProvider } from './context/GlobalContext';

function App() {
  return (
    <GlobalProvider>
      <Toaster position="top-right" reverseOrder={false} />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="staff" element={<Staff />} />
            <Route path="channels" element={<Channels />} />
            <Route path="couriers" element={<Couriers />} />
            <Route path="returns" element={<Returns />} />
            <Route path="b2b" element={<B2BShipments />} />
            <Route path="b2c" element={<B2CShipments />} />
            <Route path="damage" element={<DamageTracking />} />
            <Route path="stock" element={<MonthlyStockCheck />} />
            <Route path="reports" element={<Reports />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </GlobalProvider>
  );
}

export default App;
