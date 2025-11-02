import { Box, Flex } from '@chakra-ui/react';
import SidebarNav from '@components/SidebarNav';
import TopBar from '@components/TopBar';

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Flex minH="100vh" bg="gray.50">
      <SidebarNav />
      <Box flex="1">
        <TopBar />
        <Box as="main" p={6}>{children}</Box>
      </Box>
    </Flex>
  );
};

export default DashboardLayout;
