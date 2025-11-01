import { Flex, Spinner } from '@chakra-ui/react';
import { Navigate, Route, Routes } from 'react-router-dom';

import DashboardPage from '@pages/Dashboard';
import InventoryPage from '@pages/Inventory';
import WorkOrdersPage from '@pages/WorkOrders';
import GaragePage from '@pages/Garage';
import BillingPage from '@pages/Billing';
import MarketingPage from '@pages/Marketing';
import ReportsPage from '@pages/Reports';
import SignagePage from '@pages/Signage';
import LoginPage from '@pages/Login';
import DashboardLayout from '@layouts/DashboardLayout';
import { useAuth } from '@hooks/useAuth';

const App = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Flex align="center" justify="center" h="100vh">
        <Spinner size="xl" />
      </Flex>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/work-orders" element={<WorkOrdersPage />} />
        <Route path="/garage" element={<GaragePage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/marketing" element={<MarketingPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/signage" element={<SignagePage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </DashboardLayout>
  );
};

export default App;
