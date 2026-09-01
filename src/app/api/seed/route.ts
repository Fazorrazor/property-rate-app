import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const phone = '2009067556';
    
    const existing = await prisma.user.findUnique({
      where: { phoneNumber: phone }
    });

    if (existing) {
      return NextResponse.json({ status: 'User already exists', user: existing });
    }

    const user = await prisma.user.create({
      data: {
        phoneNumber: phone,
        name: 'Test User (Telecel)',
        isVerified: true,
        properties: {
          create: [
            {
              accountNumber: 'KKDA-TEST-001',
              ownerDigitalAddress: 'GK-0010-1234',
              propertyClassification: 'PRIVATE THIRD CLASS RESIDENTIAL',
              billYear: 2025,
              billDate: new Date('2025-01-15T00:00:00.000Z'),
              settlementDeadline: new Date('2025-06-30T23:59:59.000Z'),
              rateableValue: 500000.0,
              rateImposed: 0.00025,
              previousYearBill: 0.0,
              amountPaidLastYear: 0.0,
              arrears: 0.0,
              currentFee: 125.0,
              totalAmountDue: 125.0,
              status: 'UNPAID',
            },
          ],
        },
      },
    });

    return NextResponse.json({ status: 'Created', user });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
