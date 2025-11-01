import { Router } from 'express';
import { CampaignChannel, Role } from '@prisma/client';
import { z } from 'zod';

import prisma from '../../config/prisma';
import { authenticate, authorize } from '../../middlewares/auth';

const router = Router();

const campaignSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  channel: z.nativeEnum(CampaignChannel),
  scheduledFor: z.string().datetime().optional()
});

const notificationSchema = z.object({
  title: z.string(),
  message: z.string(),
  userId: z.string().optional()
});

router.get('/campaigns', authenticate, authorize([Role.SUPER_ADMIN, Role.MARKETING, Role.BRANCH_MANAGER]), async (_req, res) => {
  const campaigns = await prisma.marketingCampaign.findMany({ include: { notifications: true } });
  res.json(campaigns);
});

router.post('/campaigns', authenticate, authorize([Role.SUPER_ADMIN, Role.MARKETING]), async (req, res) => {
  try {
    const data = campaignSchema.parse(req.body);
    const campaign = await prisma.marketingCampaign.create({ data });
    res.status(201).json(campaign);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/campaigns/:id/send', authenticate, authorize([Role.SUPER_ADMIN, Role.MARKETING]), async (req, res) => {
  const schema = z.object({ title: z.string(), message: z.string() });
  try {
    const data = schema.parse(req.body);
    const campaign = await prisma.marketingCampaign.findUnique({ where: { id: req.params.id } });
    if (!campaign) {
      return res.status(404).json({ message: 'Campaña no encontrada' });
    }
    const customers = await prisma.user.findMany({ where: { role: Role.CUSTOMER } });
    const notifications = await prisma.notification.createMany({
      data: customers.map((customer) => ({
        title: data.title,
        message: data.message,
        channel: campaign.channel,
        userId: customer.id,
        campaignId: campaign.id,
        scheduledFor: campaign.scheduledFor ?? new Date()
      }))
    });
    res.json({ created: notifications.count });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/notifications', authenticate, authorize([Role.SUPER_ADMIN, Role.MARKETING]), async (req, res) => {
  try {
    const data = notificationSchema.parse(req.body);
    const notification = await prisma.notification.create({
      data: {
        title: data.title,
        message: data.message,
        channel: CampaignChannel.IN_APP,
        userId: data.userId
      }
    });
    res.status(201).json(notification);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
