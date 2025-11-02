import { Avatar, Box, Button, Flex, Text } from '@chakra-ui/react';
import { useAuth } from '@hooks/useAuth';

const TopBar = () => {
  const { user, logout } = useAuth();

  return (
    <Flex as="header" bg="white" shadow="sm" px={6} py={4} align="center" justify="space-between">
      <Text fontWeight="bold">Bienvenido al panel</Text>
      <Flex align="center" gap={4}>
        <Box textAlign="right">
          <Text fontSize="sm">{user?.firstName}</Text>
          <Text fontSize="xs" color="gray.500">
            {user?.role}
          </Text>
        </Box>
        <Avatar name={user?.firstName} size="sm" />
        <Button size="sm" onClick={logout} colorScheme="red">
          Salir
        </Button>
      </Flex>
    </Flex>
  );
};

export default TopBar;
