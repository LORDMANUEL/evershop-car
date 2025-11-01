import { Box, Button, Heading, Table, Tbody, Td, Th, Thead, Tr } from '@chakra-ui/react';
import { useEffect, useState } from 'react';

import api from '@services/api';

interface Invoice {
  id: string;
  number: string;
  total: number;
  issueDate: string;
  customer: { user: { firstName: string; lastName: string } };
}

const BillingPage = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    api.get('/billing/invoices').then((res) => setInvoices(res.data));
  }, []);

  const downloadPdf = (invoiceId: string) => {
    window.open(`${import.meta.env.VITE_API_URL}/billing/invoices/${invoiceId}/pdf`, '_blank');
  };

  return (
    <Box>
      <Heading size="lg" mb={6}>
        Facturación SAR
      </Heading>
      <Table bg="white" rounded="md" shadow="sm">
        <Thead>
          <Tr>
            <Th>Número</Th>
            <Th>Cliente</Th>
            <Th>Fecha</Th>
            <Th isNumeric>Total</Th>
            <Th></Th>
          </Tr>
        </Thead>
        <Tbody>
          {invoices.map((invoice) => (
            <Tr key={invoice.id}>
              <Td>{invoice.number}</Td>
              <Td>
                {invoice.customer.user.firstName} {invoice.customer.user.lastName}
              </Td>
              <Td>{new Date(invoice.issueDate).toLocaleDateString()}</Td>
              <Td isNumeric>L. {invoice.total.toFixed(2)}</Td>
              <Td>
                <Button size="sm" onClick={() => downloadPdf(invoice.id)}>
                  PDF
                </Button>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  );
};

export default BillingPage;
