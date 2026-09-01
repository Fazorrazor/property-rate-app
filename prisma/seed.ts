import { prisma } from '../src/lib/db';

async function main() {
  console.log('Clearing existing municipal records...');
  await prisma.feePayment.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.tGCRNr.deleteMany();
  await prisma.collectorsGCRs.deleteMany();
  await prisma.vBStock.deleteMany();
  await prisma.tVBType.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.adjustArrear.deleteMany();
  await prisma.defaultersList.deleteMany();
  await prisma.property.deleteMany();
  await prisma.propertyCategory.deleteMany();
  await prisma.propertyType.deleteMany();
  await prisma.propertyOwner.deleteMany();
  await prisma.street.deleteMany();
  await prisma.community.deleteMany();
  await prisma.unitCommArea.deleteMany();
  await prisma.electoralArea.deleteMany();
  await prisma.townAreaCouncil.deleteMany();
  await prisma.subMetro.deleteMany();
  await prisma.collector.deleteMany();
  await prisma.cashier.deleteMany();
  await prisma.supervisor.deleteMany();
  await prisma.tBusiness.deleteMany();
  await prisma.tIndustry.deleteMany();
  await prisma.auditLog.deleteMany();
  await (prisma as any).notification?.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding administrative jurisdictions...');
  const submetro1 = await prisma.subMetro.create({
    data: { code: 'SM-KKMA', subMetro: 'Kpone-Katamanso Municipal (KKMA)' },
  });
  const submetro2 = await prisma.subMetro.create({
    data: { code: 'SM-TMA', subMetro: 'Tema Metropolitan (TMA)' },
  });

  const council1 = await prisma.townAreaCouncil.create({
    data: { code: 'TAC-KPONE', townAreaCouncil: 'Kpone Central Council', subMetroCode: submetro1.code },
  });

  const ea1 = await prisma.electoralArea.create({
    data: { code: 'EA-ALATA', electoralArea: 'Alata Electoral Area', townAreaCouncilCode: council1.code },
  });

  const unit1 = await prisma.unitCommArea.create({
    data: { code: 'UCA-01', unitCommArea: 'Kpone Unit Committee 1', electoralAreaCode: ea1.code },
  });

  const comm1 = await prisma.community.create({
    data: { code: 'COM-KPONE', community: 'Kpone Coastal Community', unitCommAreaCode: unit1.code },
  });

  const street1 = await prisma.street.create({
    data: { code: 'ST-001', street: 'Ayensu / Beach Road', communityCode: comm1.code },
  });

  console.log('Seeding property classifications & types...');
  const propTypeRes = await prisma.propertyType.create({
    data: { code: 'RES', type: 'Residential', budgetCode: '1412001' },
  });
  const propTypeCom = await prisma.propertyType.create({
    data: { code: 'COM', type: 'Commercial', budgetCode: '1412002' },
  });

  const catRes3 = await prisma.propertyCategory.create({
    data: {
      code: 'RES-3',
      category: 'PRIVATE THIRD CLASS RESIDENTIAL',
      propertyTypeCode: propTypeRes.code,
      minCharge: 100.0,
    },
  });
  const catRes1 = await prisma.propertyCategory.create({
    data: {
      code: 'RES-1',
      category: 'FIRST CLASS RESIDENTIAL',
      propertyTypeCode: propTypeRes.code,
      minCharge: 250.0,
    },
  });

  console.log('Seeding Value Books & GCR Receipt Stock Pool (ARNOLD.BAK)...');
  const vbType = await prisma.tVBType.create({
    data: { code: 'GCR', type: 'General Counterfoil Receipt', quantity: 200 },
  });

  const vbStock = await prisma.vBStock.create({
    data: {
      vbTypeCode: vbType.code,
      startSerial: 'GCR-001001',
      endSerial: 'GCR-001200',
      quantity: 200,
      voucherNo: 'VOUCH-2025-01',
      costPerSheet: 0.5,
    },
  });

  const collector1 = await prisma.collector.create({
    data: {
      collectorId: 'COL-001',
      fullName: 'Kofi Owusu-Ansah',
      address: 'Kpone Central',
      telephone: '0244111222',
      collectionArea: 'Kpone Coastal Zone',
    },
  });

  const cashier1 = await prisma.cashier.create({
    data: {
      cashierId: 'CSH-001',
      fullName: 'Mary Mensah',
      address: 'KKMA Municipal Treasury',
      collectionArea: 'Main Treasury Counter',
    },
  });

  const collectorGCR = await prisma.collectorsGCRs.create({
    data: {
      collectorsId: collector1.collectorId,
      stockId: vbStock.id,
      minGCRNr: 'GCR-001001',
      maxGCRNr: 'GCR-001200',
      quantity: 200,
      inStock: true,
      isUsed: false,
    },
  });

  // Seed 200 sequential GCR receipt numbers
  const gcrRecords = [];
  for (let i = 1001; i <= 1200; i++) {
    gcrRecords.push({
      gcrNo: `GCR-00${i}`,
      collectorsGCRsId: collectorGCR.id,
      isUsed: false, // Available for self-service APP_PAYMENT or Cashier entry
      isDamaged: false,
    });
  }
  await prisma.tGCRNr.createMany({ data: gcrRecords });
  console.log(`Successfully generated 200 GCR receipt numbers in the municipal pool.`);

  console.log('Seeding taxpayers & property owners...');
  const user1 = await prisma.user.create({
    data: {
      phoneNumber: '0244000000',
      name: 'Kwame Mensah-Bonsu',
      isVerified: true,
    },
  });

  const user2 = await prisma.user.create({
    data: {
      phoneNumber: '0502338542',
      name: 'Ebenezer Arnold Quaye',
      isVerified: true,
    },
  });

  const owner1 = await prisma.propertyOwner.create({
    data: {
      name: 'Kwame Mensah-Bonsu',
      tel: '0244000000',
      mobileNumber: '0244000000',
      email: 'kwame.mensah@gmail.com',
      streetAddress: 'Plot 14, Ayensu Beach Road, Kpone',
    },
  });

  const owner2 = await prisma.propertyOwner.create({
    data: {
      name: 'Ebenezer Arnold Quaye',
      tel: '0502338542',
      mobileNumber: '0502338542',
      email: 'arnold.quaye@tema.gov.gh',
      streetAddress: 'House No. 12, Community 1, Tema',
    },
  });

  console.log('Seeding municipal property accounts & annual demand notices...');
  // Property 1: Baseline account KKDA03188007
  const prop1 = await prisma.property.create({
    data: {
      accountNumber: 'KKDA03188007',
      ownerDigitalAddress: 'GK-0010-9395',
      physicalAddress: 'Plot 14, Ayensu Beach Road, Kpone',
      houseNo: 'HN-KP-014',
      plotNo: 'PL-014',
      valuationNo: 'VAL-2025-001',
      municipality: 'Kpone-Katamanso (KKMA)',
      propertyClassification: 'PRIVATE THIRD CLASS RESIDENTIAL',
      billYear: 2025,
      billDate: new Date('2025-02-05T00:00:00Z'),
      settlementDeadline: new Date('2025-06-30T23:59:59Z'),
      rateableValue: 600000.0,
      rateImposed: 0.00025,
      previousYearBill: 300.0,
      amountPaidLastYear: 0.0,
      arrears: 300.0,
      currentFee: 150.0,
      totalAmountDue: 450.0,
      status: 'UNPAID',
      ownerId: owner1.ownerId,
      propertyTypeCode: propTypeRes.code,
      propertyCategoryCode: catRes3.code,
      subMetroCode: submetro1.code,
      communityCode: comm1.code,
      streetCode: street1.code,
      users: {
        connect: { id: user1.id },
      },
    },
  });

  // Property 2: Authentic Tema Metro account MA11078001 from ARNOLD.BAK
  const prop2 = await prisma.property.create({
    data: {
      accountNumber: 'MA11078001',
      ownerDigitalAddress: 'GT-0182-4410',
      physicalAddress: 'House No. 12, Community 1, Tema',
      houseNo: 'TMA-C1-012',
      plotNo: 'PL-TMA-102',
      valuationNo: 'VAL-TMA-2025-88',
      municipality: 'Tema Metropolitan (TMA)',
      propertyClassification: 'FIRST CLASS RESIDENTIAL',
      billYear: 2025,
      billDate: new Date('2025-02-05T00:00:00Z'),
      settlementDeadline: new Date('2025-06-30T23:59:59Z'),
      rateableValue: 1200000.0,
      rateImposed: 0.00030,
      previousYearBill: 0.0,
      amountPaidLastYear: 360.0,
      arrears: 0.0,
      currentFee: 360.0,
      totalAmountDue: 360.0,
      status: 'UNPAID',
      ownerId: owner2.ownerId,
      propertyTypeCode: propTypeRes.code,
      propertyCategoryCode: catRes1.code,
      subMetroCode: submetro2.code,
      users: {
        connect: { id: user2.id },
      },
    },
  });

  // Annual Demand Notice Bills
  await prisma.bill.create({
    data: {
      accountNo: prop1.accountNumber,
      billYear: 2025,
      rateableValue: prop1.rateableValue,
      ratePA: prop1.rateImposed,
      balanceBF: prop1.arrears,
      accountBalance: prop1.totalAmountDue,
      preparedBy: 'MUNICIPAL REVENUE CADASTRE',
      printed: true,
    },
  });

  await prisma.bill.create({
    data: {
      accountNo: prop2.accountNumber,
      billYear: 2025,
      rateableValue: prop2.rateableValue,
      ratePA: prop2.rateImposed,
      balanceBF: prop2.arrears,
      accountBalance: prop2.totalAmountDue,
      preparedBy: 'MUNICIPAL REVENUE CADASTRE',
      printed: true,
    },
  });

  console.log('Seeding complete! Database successfully populated with authentic municipal property records, value books, and GCR pool.');
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
