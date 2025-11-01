import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { Role } from '@prisma/client';
import { z } from 'zod';

import env from '../../config/env';
import prisma from '../../config/prisma';
import { authenticate, authorize } from '../../middlewares/auth';

const router = Router();
const storageDir = path.resolve(env.storagePath, 'signage');
fs.mkdirSync(storageDir, { recursive: true });

const upload = multer({ dest: storageDir });

router.get('/media', authenticate, authorize([Role.SUPER_ADMIN, Role.MARKETING]), async (_req, res) => {
  const media = await prisma.signageMedia.findMany({ include: { playlists: true } });
  res.json(media);
});

router.post('/media', authenticate, authorize([Role.SUPER_ADMIN, Role.MARKETING]), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Archivo requerido' });
  }
  const schema = z.object({ title: z.string(), description: z.string().optional(), duration: z.number().int().optional() });
  try {
    const data = schema.parse(req.body);
    const media = await prisma.signageMedia.create({
      data: {
        filename: req.file.filename,
        title: data.title,
        description: data.description,
        duration: data.duration
      }
    });
    res.status(201).json(media);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

const playlistSchema = z.object({ name: z.string(), slug: z.string() });

router.get('/playlists', authenticate, authorize([Role.SUPER_ADMIN, Role.MARKETING]), async (_req, res) => {
  const playlists = await prisma.signagePlaylist.findMany({
    include: { items: { include: { media: true }, orderBy: { position: 'asc' } } },
    orderBy: { name: 'asc' }
  });
  res.json(playlists);
});

router.post('/playlists', authenticate, authorize([Role.SUPER_ADMIN, Role.MARKETING]), async (req, res) => {
  try {
    const data = playlistSchema.parse(req.body);
    const playlist = await prisma.signagePlaylist.create({ data });
    res.status(201).json(playlist);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/playlists/:id/items', authenticate, authorize([Role.SUPER_ADMIN, Role.MARKETING]), async (req, res) => {
  const schema = z.object({ mediaId: z.string(), position: z.number().int().nonnegative() });
  try {
    const data = schema.parse(req.body);
    const item = await prisma.signagePlaylistItem.create({
      data: {
        playlistId: req.params.id,
        mediaId: data.mediaId,
        position: data.position
      }
    });
    res.status(201).json(item);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/player/:slug', async (req, res) => {
  const playlist = await prisma.signagePlaylist.findUnique({
    where: { slug: req.params.slug },
    include: { items: { include: { media: true }, orderBy: { position: 'asc' } } }
  });
  if (!playlist) {
    return res.status(404).send('Playlist no encontrada');
  }
  res.json(playlist);
});

export default router;
