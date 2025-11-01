import { Box, Flex, Heading, SimpleGrid, Stat, StatHelpText, StatLabel, StatNumber } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  Title as ChartTitle,
  Tooltip,
  Legend
} from 'chart.js';

import api from '@services/api';
import type { DashboardSummary } from '@types/index';

Chart.register(CategoryScale, LinearScale, BarElement, ChartTitle, Tooltip, Legend);

const DashboardPage = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    api.get('/reports/dashboard').then((res) => setSummary(res.data));
  }, []);

  const chartData = {
    labels: summary?.topProducts.map((item) => item.product?.name ?? 'Producto') ?? [],
    datasets: [
      {
        label: 'Unidades utilizadas',
        data: summary?.topProducts.map((item) => item.quantity ?? 0) ?? [],
        backgroundColor: '#3182ce'
      }
    ]
  };

  return (
    <Box>
      <Heading size="lg" mb={6}>
        Resumen General
      </Heading>
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={8}>
        <Stat bg="white" p={6} rounded="md" shadow="sm">
          <StatLabel>Ventas de hoy</StatLabel>
          <StatNumber>L. {summary?.salesToday?.toFixed(2) ?? '0.00'}</StatNumber>
          <StatHelpText>Incluye repuestos y servicios</StatHelpText>
        </Stat>
        <Stat bg="white" p={6} rounded="md" shadow="sm">
          <StatLabel>Ventas del mes</StatLabel>
          <StatNumber>L. {summary?.salesMonth?.toFixed(2) ?? '0.00'}</StatNumber>
          <StatHelpText>Comparado contra objetivo mensual</StatHelpText>
        </Stat>
        <Stat bg="white" p={6} rounded="md" shadow="sm">
          <StatLabel>Órdenes activas</StatLabel>
          <StatNumber>{summary?.workOrders.reduce((acc, cur) => acc + cur._count.status, 0) ?? 0}</StatNumber>
          <StatHelpText>Distribución por estado</StatHelpText>
        </Stat>
      </SimpleGrid>
      <Flex gap={6} wrap="wrap">
        <Box flex="1" minW="300px" bg="white" p={6} rounded="md" shadow="sm">
          <Heading size="md" mb={4}>
            Repuestos destacados
          </Heading>
          <Bar data={chartData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
        </Box>
      </Flex>
    </Box>
  );
};

export default DashboardPage;
