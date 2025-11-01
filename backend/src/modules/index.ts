import { Router } from 'express';

import accountingRouter from './accounting/router';
import authRouter from './auth/router';
import billingRouter from './billing/router';
import branchesRouter from './branches/router';
import garageRouter from './garage/router';
import inventoryRouter from './inventory/router';
import labourRouter from './labour/router';
import marketingRouter from './marketing/router';
import reportsRouter from './reports/router';
import signageRouter from './signage/router';
import technicianRouter from './technician/router';
import usersRouter from './users/router';

const router = Router();

router.use('/auth', authRouter);
router.use('/branches', branchesRouter);
router.use('/inventory', inventoryRouter);
router.use('/labour', labourRouter);
router.use('/garage', garageRouter);
router.use('/billing', billingRouter);
router.use('/accounting', accountingRouter);
router.use('/technician', technicianRouter);
router.use('/reports', reportsRouter);
router.use('/marketing', marketingRouter);
router.use('/signage', signageRouter);
router.use('/users', usersRouter);

export default router;
