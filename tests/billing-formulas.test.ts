import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { mapPropertyRow as mapAdminPropertyRow } from '../property-rate-admin/src/lib/adminDb';
import { mapPropertyRow as mapRatepayerPropertyRow } from '../src/lib/ratepayerDb';

describe('Municipal Billing & Account Balance Formula Verification', () => {
  const mappers = [
    { name: 'Admin Portal (adminDb)', mapFn: mapAdminPropertyRow },
    { name: 'Citizen App (ratepayerDb)', mapFn: mapRatepayerPropertyRow },
  ];

  for (const { name, mapFn } of mappers) {
    describe(`${name} - Billing Status & Balance Calculations`, () => {
      test('UNPAID Account: Full arrears and current bill remain outstanding when zero payments made', () => {
        const row = {
          account_no: 'KKDA03009999',
          arrears: 450,
          current_bill: 150,
          amount_paid: 0,
          outstanding_amt: 600,
        };

        const result = mapFn(row);
        assert.ok(result);
        assert.equal(result.arrears, 450);
        assert.equal(result.currentFee, 150);
        assert.equal(result.amountPaidLastYear, 0);
        assert.equal(result.billAmount, 600, 'Gross bill must equal arrears + current fee');
        assert.equal(result.totalAmountDue, 600, 'Outstanding due must equal gross bill when amount_paid is 0');
        assert.equal(result.status, 'UNPAID');
      });

      test('PARTIALLY_PAID Account: Payments deducted once from gross bill, leaving positive balance', () => {
        const row = {
          account_no: 'KKDA03002036',
          arrears: 450,
          current_bill: 150,
          amount_paid: 150,
          outstanding_amt: 450,
        };

        const result = mapFn(row);
        assert.ok(result);
        assert.equal(result.billAmount, 600, 'Gross bill must equal arrears + current fee (450 + 150 = 600)');
        assert.equal(result.amountPaidLastYear, 150);
        assert.equal(result.totalAmountDue, 450, 'Net remaining due must equal 600 - 150 = 450');
        assert.equal(result.status, 'PARTIALLY_PAID');
      });

      test('PAID Account: Exactly settled accounts have 0 remaining balance and PAID status', () => {
        const row = {
          account_no: 'KKDA03002012',
          arrears: 600,
          current_bill: 200,
          amount_paid: 800,
          outstanding_amt: 0,
        };

        const result = mapFn(row);
        assert.ok(result);
        assert.equal(result.billAmount, 800, 'Gross bill is 600 + 200 = 800');
        assert.equal(result.totalAmountDue, 0, 'Net balance must be 0 after full payment');
        assert.equal(result.status, 'PAID');
      });

      test('OVERPAID Account: Excess payments are bounded at 0 outstanding due with PAID status', () => {
        const row = {
          account_no: 'KKDA03008888',
          arrears: 200,
          current_bill: 100,
          amount_paid: 500,
          outstanding_amt: 0,
        };

        const result = mapFn(row);
        assert.ok(result);
        assert.equal(result.billAmount, 300, 'Gross bill is 300');
        assert.equal(result.totalAmountDue, 0, 'Remaining balance cannot be negative');
        assert.equal(result.status, 'PAID');
      });

      test('Corrupted Legacy Double-Deduction Resilience: Negative outstanding_amt is sanitized', () => {
        // Simulating un-repaired legacy record with negative outstanding_amt (-400)
        const corruptedRow = {
          account_no: 'KKDA03002012_LEGACY',
          arrears: 600,
          current_bill: 200,
          amount_paid: 600,
          outstanding_amt: -400, // Legacy double-deducted value: (800 - 600) - 600 = -400
        };

        const result = mapFn(corruptedRow);
        assert.ok(result);
        assert.equal(result.billAmount, 800, 'Gross bill is 800');
        assert.equal(result.totalAmountDue, 200, 'Sanitized net remaining due must be 800 - 600 = 200, not -400');
        assert.equal(result.status, 'PARTIALLY_PAID', 'Account with 200 remaining due must be PARTIALLY_PAID');
      });
    });
  }
});
