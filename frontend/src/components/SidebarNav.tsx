import { Box, Flex, Icon, Link, Text } from '@chakra-ui/react';
import { NavLink } from 'react-router-dom';
import { FiActivity, FiBarChart2, FiBookOpen, FiGrid, FiInbox, FiMonitor, FiPackage, FiUsers } from 'react-icons/fi';

const links = [
  { to: '/', label: 'Dashboard', icon: FiGrid },
  { to: '/inventory', label: 'Inventario', icon: FiPackage },
  { to: '/work-orders', label: 'Órdenes', icon: FiActivity },
  { to: '/garage', label: 'Garage 3D', icon: FiMonitor },
  { to: '/billing', label: 'Facturación', icon: FiBookOpen },
  { to: '/marketing', label: 'Marketing', icon: FiUsers },
  { to: '/reports', label: 'Reportes', icon: FiBarChart2 },
  { to: '/signage', label: 'OpenSignage', icon: FiInbox }
];

const SidebarNav = () => {
  return (
    <Box w="260px" bg="white" shadow="md" p={6} display={{ base: 'none', md: 'block' }}>
      <Text fontWeight="bold" fontSize="lg" mb={8}>
        Taller Manager
      </Text>
      <Flex direction="column" gap={3}>
        {links.map((link) => (
          <Link
            key={link.to}
            as={NavLink}
            to={link.to}
            _hover={{ textDecoration: 'none', bg: 'gray.100' }}
            borderRadius="md"
            px={3}
            py={2}
            _activeLink={{ bg: 'blue.500', color: 'white' }}
          >
            <Flex align="center" gap={3}>
              <Icon as={link.icon} />
              <Text>{link.label}</Text>
            </Flex>
          </Link>
        ))}
      </Flex>
    </Box>
  );
};

export default SidebarNav;
