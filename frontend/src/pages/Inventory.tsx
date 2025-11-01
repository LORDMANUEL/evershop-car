import { Badge, Box, Heading, Table, Tbody, Td, Th, Thead, Tr } from '@chakra-ui/react';
import { useEffect, useState } from 'react';

import api from '@services/api';
import type { InventoryProduct } from '@types/index';

const InventoryPage = () => {
  const [products, setProducts] = useState<InventoryProduct[]>([]);

  useEffect(() => {
    api.get('/inventory/products').then((res) => setProducts(res.data));
  }, []);

  return (
    <Box>
      <Heading size="lg" mb={6}>
        Inventario de repuestos
      </Heading>
      <Table bg="white" shadow="sm" rounded="md">
        <Thead>
          <Tr>
            <Th>SKU</Th>
            <Th>Nombre</Th>
            <Th>Marca</Th>
            <Th isNumeric>Precio</Th>
            <Th isNumeric>Stock total</Th>
            <Th isNumeric>Mínimo</Th>
          </Tr>
        </Thead>
        <Tbody>
          {products.map((product) => (
            <Tr key={product.id}>
              <Td>{product.sku}</Td>
              <Td>{product.name}</Td>
              <Td>{product.brand ?? 'N/A'}</Td>
              <Td isNumeric>L. {Number(product.price ?? 0).toFixed(2)}</Td>
              <Td isNumeric>
                <Badge colorScheme={product.totalStock <= product.minStock ? 'red' : 'green'}>{product.totalStock}</Badge>
              </Td>
              <Td isNumeric>{product.minStock}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  );
};

export default InventoryPage;
