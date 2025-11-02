import { Box, Heading, List, ListItem, SimpleGrid, Text } from '@chakra-ui/react';
import { useEffect, useState } from 'react';

import api from '@services/api';
import GarageViewer from '@components/GarageViewer';
import type { Vehicle } from '@types/index';

interface CompatiblePartsResponse {
  vehicle: Vehicle;
  parts: { id: string; name: string; price: number }[];
}

const GaragePage = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [parts, setParts] = useState<CompatiblePartsResponse['parts']>([]);

  useEffect(() => {
    api.get('/garage/vehicles').then((res) => {
      setVehicles(res.data);
      if (res.data.length > 0) {
        setSelected(res.data[0]);
      }
    });
  }, []);

  useEffect(() => {
    if (!selected) {
      return;
    }
    api.get<CompatiblePartsResponse>(`/garage/vehicles/${selected.vin}/compatible-parts`).then((res) => setParts(res.data.parts));
  }, [selected]);

  return (
    <Box>
      <Heading size="lg" mb={6}>
        Garage Virtual 3D
      </Heading>
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
        <Box bg="white" p={6} rounded="md" shadow="sm">
          <Heading size="md" mb={4}>
            Vehículos registrados
          </Heading>
          <List spacing={3}>
            {vehicles.map((vehicle) => (
              <ListItem
                key={vehicle.id}
                cursor="pointer"
                borderRadius="md"
                px={3}
                py={2}
                bg={selected?.id === vehicle.id ? 'blue.50' : 'gray.50'}
                onClick={() => setSelected(vehicle)}
              >
                <Text fontWeight="bold">
                  {vehicle.make} {vehicle.model} {vehicle.year}
                </Text>
                <Text fontSize="sm" color="gray.500">
                  VIN: {vehicle.vin}
                </Text>
              </ListItem>
            ))}
          </List>
        </Box>
        <Box bg="white" p={6} rounded="md" shadow="sm">
          {selected ? (
            <>
              <Heading size="md" mb={4}>
                Visualización 3D - {selected.make} {selected.model}
              </Heading>
              <GarageViewer vin={selected.vin} />
              <Box mt={4}>
                <Heading size="sm" mb={2}>
                  Repuestos compatibles
                </Heading>
                <List spacing={2}>
                  {parts.map((part) => (
                    <ListItem key={part.id} borderBottom="1px solid" borderColor="gray.100" py={1}>
                      {part.name} - L. {Number(part.price ?? 0).toFixed(2)}
                    </ListItem>
                  ))}
                </List>
              </Box>
            </>
          ) : (
            <Text>Seleccione un vehículo para visualizarlo.</Text>
          )}
        </Box>
      </SimpleGrid>
    </Box>
  );
};

export default GaragePage;
