import { Badge, Box, Heading, SimpleGrid, Text } from '@chakra-ui/react';
import { useEffect, useState } from 'react';

import api from '@services/api';
import type { WorkOrder } from '@types/index';

const statusColor: Record<string, string> = {
  RECEIVED: 'gray',
  DIAGNOSIS: 'orange',
  QUOTED: 'purple',
  WAITING_APPROVAL: 'yellow',
  APPROVED: 'blue',
  IN_PROGRESS: 'teal',
  READY_FOR_BILLING: 'cyan',
  COMPLETED: 'green',
  CANCELLED: 'red'
};

const WorkOrdersPage = () => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);

  useEffect(() => {
    api.get('/technician/work-orders').then((res) => setWorkOrders(res.data));
  }, []);

  return (
    <Box>
      <Heading size="lg" mb={6}>
        Órdenes de servicio activas
      </Heading>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        {workOrders.map((order) => (
          <Box key={order.id} bg="white" p={6} rounded="md" shadow="sm">
            <Badge colorScheme={statusColor[order.status] ?? 'gray'} mb={2}>
              {order.status}
            </Badge>
            <Heading size="sm" mb={2}>
              {order.code}
            </Heading>
            <Text fontSize="sm" color="gray.600">
              {order.description ?? 'Sin descripción'}
            </Text>
            <Text mt={2} fontWeight="bold">
              Vehículo: {order.vehicle.make} {order.vehicle.model}
            </Text>
            <Text fontSize="sm" color="gray.500">
              Cliente: {order.customer.user.firstName} {order.customer.user.lastName}
            </Text>
          </Box>
        ))}
      </SimpleGrid>
    </Box>
  );
};

export default WorkOrdersPage;
