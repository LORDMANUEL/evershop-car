import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  Input,
  SimpleGrid,
  Stack,
  Text,
  useToast
} from '@chakra-ui/react';
import { ChangeEvent, useEffect, useState } from 'react';

import api from '@services/api';

interface MediaItem {
  id: string;
  title: string;
  filename: string;
  description?: string;
}

interface Playlist {
  id: string;
  name: string;
  slug: string;
  items: { id: string; media: MediaItem }[];
}

const SignagePage = () => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('Video promocional');
  const [playlistName, setPlaylistName] = useState('Pantalla principal');
  const [playlistSlug, setPlaylistSlug] = useState('pantalla-principal');
  const toast = useToast();

  const loadData = () => {
    api.get('/signage/media').then((res) => setMedia(res.data));
    api.get('/signage/playlists').then((res) => setPlaylists(res.data));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    setFile(selected ?? null);
  };

  const uploadMedia = async () => {
    if (!file) {
      toast({ title: 'Seleccione un archivo', status: 'warning' });
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    await api.post('/signage/media', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    toast({ title: 'Video cargado', status: 'success' });
    setFile(null);
    loadData();
  };

  const createPlaylist = async () => {
    await api.post('/signage/playlists', { name: playlistName, slug: playlistSlug });
    toast({ title: 'Playlist creada', status: 'success' });
    loadData();
  };

  return (
    <Box>
      <Heading size="lg" mb={6}>
        OpenSignage - Pantallas digitales
      </Heading>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
        <Box bg="white" p={6} rounded="md" shadow="sm">
          <Heading size="md" mb={4}>
            Subir contenido
          </Heading>
          <Stack spacing={4}>
            <FormControl>
              <FormLabel>Título</FormLabel>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </FormControl>
            <FormControl>
              <FormLabel>Archivo de video</FormLabel>
              <Input type="file" accept="video/*" onChange={handleFileChange} />
            </FormControl>
            <Button onClick={uploadMedia} colorScheme="blue">
              Cargar
            </Button>
          </Stack>
          <Stack mt={6} spacing={3}>
            <Heading size="sm">Biblioteca</Heading>
            {media.map((item) => (
              <Box key={item.id} border="1px" borderColor="gray.100" p={3} rounded="md">
                <Text fontWeight="bold">{item.title}</Text>
                <Text fontSize="sm" color="gray.500">
                  Archivo: {item.filename}
                </Text>
              </Box>
            ))}
          </Stack>
        </Box>
        <Box bg="white" p={6} rounded="md" shadow="sm">
          <Heading size="md" mb={4}>
            Listas de reproducción
          </Heading>
          <Stack spacing={4}>
            <FormControl>
              <FormLabel>Nombre</FormLabel>
              <Input value={playlistName} onChange={(e) => setPlaylistName(e.target.value)} />
            </FormControl>
            <FormControl>
              <FormLabel>Slug</FormLabel>
              <Input value={playlistSlug} onChange={(e) => setPlaylistSlug(e.target.value)} />
            </FormControl>
            <Button onClick={createPlaylist}>Crear playlist</Button>
          </Stack>
          <Stack mt={6} spacing={3}>
            {playlists.map((playlist) => (
              <Box key={playlist.id} border="1px" borderColor="gray.100" p={3} rounded="md">
                <Text fontWeight="bold">{playlist.name}</Text>
                <Text fontSize="sm" color="gray.500">
                  URL: /signage/player/{playlist.slug}
                </Text>
                <Text fontSize="sm" mt={2}>
                  {playlist.items.length} elementos
                </Text>
              </Box>
            ))}
          </Stack>
        </Box>
      </SimpleGrid>
    </Box>
  );
};

export default SignagePage;
