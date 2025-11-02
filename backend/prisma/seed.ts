import {
  PrismaClient,
  Role,
  CampaignChannel,
  InventoryMovementType,
  WorkOrderStatus,
  FiscalDocumentType
} from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin123*', 10);

  const branch = await prisma.branch.upsert({
    where: { code: 'MAIN' },
    update: {},
    create: {
      code: 'MAIN',
      name: 'Sucursal Principal',
      address: 'Av. Principal 123, San Pedro Sula',
      phone: '+504 9999-9999'
    }
  });

  const secondaryBranch = await prisma.branch.upsert({
    where: { code: 'EAST' },
    update: {},
    create: {
      code: 'EAST',
      name: 'Sucursal Este',
      address: 'Boulevard del Este, SPS',
      phone: '+504 8888-8888'
    }
  });

  const seedSeries = async (
    branchId: string,
    documentType: FiscalDocumentType,
    prefix: string,
    cai: string
  ) => {
    await prisma.fiscalSeries.upsert({
      where: {
        branchId_documentType_prefix: {
          branchId,
          documentType,
          prefix
        }
      },
      update: {
        cai,
        expiresAt: new Date('2025-12-31T23:59:59Z'),
        isActive: true
      },
      create: {
        branchId,
        documentType,
        cai,
        prefix,
        startNumber: 1,
        endNumber: 500,
        nextNumber: 1,
        expiresAt: new Date('2025-12-31T23:59:59Z'),
        isActive: true
      }
    });
  };

  await Promise.all([
    seedSeries(branch.id, FiscalDocumentType.INVOICE, '001-001-01-', '111111-AAA-2025'),
    seedSeries(branch.id, FiscalDocumentType.CREDIT_NOTE, 'NC-001-', '111111-BBB-2025'),
    seedSeries(secondaryBranch.id, FiscalDocumentType.INVOICE, '002-001-01-', '222222-AAA-2025'),
    seedSeries(secondaryBranch.id, FiscalDocumentType.CREDIT_NOTE, 'NC-002-', '222222-BBB-2025')
  ]);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@taller.com' },
    update: {},
    create: {
      email: 'admin@taller.com',
      password: passwordHash,
      firstName: 'Admin',
      lastName: 'Principal',
      role: Role.SUPER_ADMIN,
      branchId: branch.id
    }
  });

  const customerUser = await prisma.user.upsert({
    where: { email: 'cliente@demo.com' },
    update: {},
    create: {
      email: 'cliente@demo.com',
      password: await bcrypt.hash('Cliente123*', 10),
      firstName: 'Carla',
      lastName: 'Cliente',
      role: Role.CUSTOMER,
      customer: {
        create: {
          address: 'Col. Jardines, SPS',
          city: 'San Pedro Sula',
          country: 'Honduras',
          vehicles: {
            create: [
              {
                vin: '3VWFE21C04M000001',
                make: 'Volkswagen',
                model: 'Jetta',
                year: 2018,
                mileage: 45000
              }
            ]
          }
        }
      }
    },
    include: { customer: { include: { vehicles: true } } }
  });

  await prisma.labourService.createMany({
    skipDuplicates: true,
    data: [
      {
        code: 'SERV-ACEITE',
        name: 'Cambio de aceite',
        description: 'Incluye filtro y revisión rápida',
        hours: 1,
        hourlyRate: 600
      },
      {
        code: 'SERV-FRENOS',
        name: 'Cambio de frenos',
        description: 'Reemplazo de discos y pastillas',
        hours: 3,
        hourlyRate: 850
      }
    ]
  });

  const supplier = await prisma.supplier.upsert({
    where: { name: 'Proveedor Centroamericano' },
    update: {},
    create: {
      name: 'Proveedor Centroamericano',
      email: 'ventas@proveedor.hn'
    }
  });

  const oil = await prisma.inventoryProduct.upsert({
    where: { sku: 'ACE-5W30' },
    update: {},
    create: {
      sku: 'ACE-5W30',
      name: 'Aceite sintético 5W30',
      brand: 'Castrol',
      description: 'Aceite premium para motor',
      compatibleWith: ['Volkswagen Jetta 2018', 'Toyota Corolla 2017'],
      cost: 350,
      price: 550,
      minStock: 10,
      supplierId: supplier.id,
      stocks: {
        create: {
          branchId: branch.id,
          quantity: 30
        }
      }
    }
  });

  await prisma.inventoryMovement.create({
    data: {
      productId: oil.id,
      branchId: branch.id,
      quantity: 30,
      type: InventoryMovementType.PURCHASE,
      reference: 'PO-0001',
      notes: 'Stock inicial seed',
      userId: admin.id
    }
  });

  await prisma.inventoryStock.upsert({
    where: { productId_branchId: { productId: oil.id, branchId: secondaryBranch.id } },
    update: { quantity: { set: 12 } },
    create: {
      productId: oil.id,
      branchId: secondaryBranch.id,
      quantity: 12
    }
  });

  await prisma.inventoryMovement.create({
    data: {
      productId: oil.id,
      branchId: secondaryBranch.id,
      quantity: 12,
      type: InventoryMovementType.TRANSFER_IN,
      reference: 'TRF-SEED-01',
      notes: 'Stock inicial sucursal Este',
      userId: admin.id
    }
  });

  await prisma.workOrder.upsert({
    where: { code: 'OS-0001' },
    update: {},
    create: {
      code: 'OS-0001',
      status: WorkOrderStatus.DIAGNOSIS,
      customer: {
        connect: { userId: customerUser.id }
      },
      vehicle: {
        connect: { vin: '3VWFE21C04M000001' }
      },
      branchId: branch.id,
      createdById: admin.id,
      description: 'Chequeo general y ruido en frenos',
      parts: {
        create: [
          {
            productId: oil.id,
            quantity: 1,
            price: 550
          }
        ]
      },
      labours: {
        create: [
          {
            service: { connect: { code: 'SERV-FRENOS' } },
            hours: 2,
            rate: 850
          }
        ]
      }
    }
  });

  await prisma.marketingCampaign.createMany({
    data: [
      {
        name: 'Recordatorio cambio de aceite',
        channel: CampaignChannel.EMAIL,
        description: 'Recordatorios automáticos cada 6 meses'
      },
      {
        name: 'Promoción frenos abril',
        channel: CampaignChannel.IN_APP,
        description: '10% de descuento en repuestos de frenos'
      }
    ],
    skipDuplicates: true
  });

  console.log('Seed completado');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
