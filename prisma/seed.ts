import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Clearing existing municipal records...');
  await prisma.auditLog.deleteMany();
  await (prisma as any).notification?.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.property.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding taxpayers...');
  // Primary Taxpayer profile linked to phone 0244000000 (and test alias 5550000000)
  const user1 = await prisma.user.create({
    data: {
      phoneNumber: '0244000000',
      name: 'Kwame Mensah-Bonsu',
      isVerified: true,
    },
  });

  console.log('Seeding properties matching exact 13 baseline fields...');
  // Property 1: Matches the physical bill baseline (Arrears + Current Fee = Total Due)
  const prop1 = await prisma.property.create({
    data: {
      accountNumber: 'KKDA03188007', // Master Account Head
      ownerDigitalAddress: 'GK-0010-9395', // GhanaPost GPS / Taxpayer ID
      propertyClassification: 'PRIVATE THIRD CLASS RESIDENTIAL',
      billYear: 2025,
      billDate: new Date('2025-02-05T00:00:00Z'),
      settlementDeadline: new Date('2025-06-30T23:59:59Z'),
      rateableValue: 600000.0, // GH₵ 600,000 assessed capital valuation
      rateImposed: 0.00025, // 0.025% statutory multiplier
      previousYearBill: 300.0,
      amountPaidLastYear: 0.0,
      arrears: 300.0, // Carried forward unpaid balance
      currentFee: 150.0, // 600,000 * 0.00025 = GH₵ 150.00
      totalAmountDue: 450.0, // 300 + 150 = GH₵ 450.00
      status: 'UNPAID',
      users: {
        connect: { id: user1.id },
      },
    },
  });

  console.log('Seeding complete! Database successfully populated with authentic municipal property records.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
