import { Box, Heading, SimpleGrid, Table, Tbody, Td, Th, Thead, Tr } from '@chakra-ui/react';
import { useEffect, useState } from 'react';

import api from '@services/api';

interface TechnicianPerformance {
  technician: { id: string; firstName: string; lastName: string };
  completedOrders: number;
  averageTimeHours: number;
}

interface TurnoverItem {
  product: { id: string; name: string };
  turnover: number;
}

const ReportsPage = () => {
  const [performance, setPerformance] = useState<TechnicianPerformance[]>([]);
  const [turnover, setTurnover] = useState<TurnoverItem[]>([]);

  useEffect(() => {
    api.get('/reports/technicians/performance').then((res) => setPerformance(res.data));
    api.get('/reports/inventory/turnover').then((res) => setTurnover(res.data));
  }, []);

  return (
    <Box>
      <Heading size="lg" mb={6}>
        Reportes analíticos
      </Heading>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
        <Box bg="white" p={6} rounded="md" shadow="sm">
          <Heading size="md" mb={4}>
            Rendimiento de técnicos
          </Heading>
          <Table>
            <Thead>
              <Tr>
                <Th>Técnico</Th>
                <Th isNumeric>Órdenes completadas</Th>
                <Th isNumeric>Tiempo prom. (h)</Th>
              </Tr>
            </Thead>
            <Tbody>
              {performance.map((item) => (
                <Tr key={item.technician.id}>
                  <Td>
                    {item.technician.firstName} {item.technician.lastName}
                  </Td>
                  <Td isNumeric>{item.completedOrders}</Td>
                  <Td isNumeric>{item.averageTimeHours.toFixed(1)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
        <Box bg="white" p={6} rounded="md" shadow="sm">
          <Heading size="md" mb={4}>
            Rotación de inventario
          </Heading>
          <Table>
            <Thead>
              <Tr>
                <Th>Producto</Th>
                <Th isNumeric>Índice</Th>
              </Tr>
            </Thead>
            <Tbody>
              {turnover.map((item) => (
                <Tr key={item.product.id}>
                  <Td>{item.product.name}</Td>
                  <Td isNumeric>{item.turnover.toFixed(2)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </SimpleGrid>
    </Box>
  );
};

export default ReportsPage;
