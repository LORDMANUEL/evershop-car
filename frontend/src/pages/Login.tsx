import { Box, Button, Flex, Heading, Input, Stack, Text, useToast } from '@chakra-ui/react';
import { FormEvent, useState } from 'react';

import { useAuth } from '@hooks/useAuth';

const LoginPage = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@taller.com');
  const [password, setPassword] = useState('Admin123*');
  const toast = useToast();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await login(email, password);
      toast({ title: 'Sesión iniciada', status: 'success' });
    } catch (error) {
      toast({ title: 'Credenciales inválidas', status: 'error' });
    }
  };

  return (
    <Flex minH="100vh" align="center" justify="center" bg="gray.100">
      <Box bg="white" p={10} rounded="md" shadow="lg" w="sm">
        <Heading size="md" mb={6} textAlign="center">
          Ingrese al sistema
        </Heading>
        <form onSubmit={handleSubmit}>
          <Stack spacing={4}>
            <Box>
              <Text fontSize="sm" mb={1}>
                Correo electrónico
              </Text>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </Box>
            <Box>
              <Text fontSize="sm" mb={1}>
                Contraseña
              </Text>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
            </Box>
            <Button type="submit" colorScheme="blue" w="full">
              Ingresar
            </Button>
          </Stack>
        </form>
      </Box>
    </Flex>
  );
};

export default LoginPage;
