import { Box, Button, FormControl, FormLabel, Heading, Input, SimpleGrid, Stack, Textarea, useToast } from '@chakra-ui/react';
import { useEffect, useState } from 'react';

import api from '@services/api';

interface Campaign {
  id: string;
  name: string;
  description?: string;
  channel: string;
  scheduledFor?: string;
  notifications: { id: string }[];
}

const MarketingPage = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [name, setName] = useState('Promoción cambio de aceite');
  const [description, setDescription] = useState('10% de descuento en servicios de mantenimiento.');
  const toast = useToast();

  const fetchCampaigns = () => {
    api.get('/marketing/campaigns').then((res) => setCampaigns(res.data));
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const createCampaign = async () => {
    await api.post('/marketing/campaigns', { name, description, channel: 'IN_APP' });
    toast({ title: 'Campaña creada', status: 'success' });
    setName('');
    setDescription('');
    fetchCampaigns();
  };

  const sendCampaign = async (campaignId: string) => {
    await api.post(`/marketing/campaigns/${campaignId}/send`, {
      title: 'Nueva promoción',
      message: 'Visita tu portal Garage para ver las ofertas personalizadas.'
    });
    toast({ title: 'Notificaciones enviadas', status: 'success' });
  };

  return (
    <Box>
      <Heading size="lg" mb={6}>
        Marketing y fidelización
      </Heading>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
        <Box bg="white" p={6} rounded="md" shadow="sm">
          <Heading size="md" mb={4}>
            Crear nueva campaña
          </Heading>
          <Stack spacing={4}>
            <FormControl>
              <FormLabel>Nombre</FormLabel>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la campaña" />
            </FormControl>
            <FormControl>
              <FormLabel>Mensaje</FormLabel>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
            </FormControl>
            <Button colorScheme="blue" onClick={createCampaign}>
              Guardar campaña
            </Button>
          </Stack>
        </Box>
        <Box bg="white" p={6} rounded="md" shadow="sm">
          <Heading size="md" mb={4}>
            Historial de campañas
          </Heading>
          <Stack spacing={4}>
            {campaigns.map((campaign) => (
              <Box key={campaign.id} border="1px" borderColor="gray.100" p={4} rounded="md">
                <Heading size="sm">{campaign.name}</Heading>
                <Textarea isReadOnly value={campaign.description ?? ''} mt={2} />
                <Button mt={3} size="sm" onClick={() => sendCampaign(campaign.id)}>
                  Enviar notificaciones
                </Button>
              </Box>
            ))}
          </Stack>
        </Box>
      </SimpleGrid>
    </Box>
  );
};

export default MarketingPage;
