import { supabase } from './supabase';

export function mapPropertyRow(p: any) {
  if (!p) return null;
  const arrears = Number(p.arrears || 0);
  const currentFee = Number(p.current_bill !== undefined ? p.current_bill : p.currentFee || 0);
  const amountPaidLastYear = Number(p.amount_paid !== undefined ? p.amount_paid : p.amountPaidLastYear || 0);
  const totalAmountDue = Number(
    p.outstanding_amt !== undefined && p.outstanding_amt !== null
      ? p.outstanding_amt
      : p.totalAmountDue !== undefined
        ? p.totalAmountDue
        : arrears + currentFee
  );

  let status: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' = p.status;
  if (!status) {
    if (totalAmountDue <= 0) {
      status = 'PAID';
    } else if (amountPaidLastYear > 0) {
      status = 'PARTIALLY_PAID';
    } else {
      status = 'UNPAID';
    }
  }

  return {
    ...p,
    accountNumber: p.account_no || p.accountNumber || '',
    ownerNameDirect: p.name || null,
    ownerPhoneDirect: p.telephone || null,
    valuationNo: p.valuationNo || '',
    propertyClassification: p.property_cat || p.propertyClassification || 'RESIDENTIAL',
    currentFee,
    amountPaidLastYear,
    arrears,
    totalAmountDue,
    status,
  };
}

function preparePropertyWritePayload(data: any) {
  const { users, receipts, bills, owner, ...cleanData } = data;
  const row: any = {
    ...cleanData,
    updatedAt: new Date().toISOString(),
  };

  if (cleanData.accountNumber !== undefined) {
    row.account_no = cleanData.accountNumber;
    delete row.accountNumber;
  }
  if (cleanData.propertyClassification !== undefined) {
    row.property_cat = cleanData.propertyClassification;
    delete row.propertyClassification;
  }
  if (cleanData.currentFee !== undefined) {
    row.current_bill = cleanData.currentFee;
    delete row.currentFee;
  }
  if (cleanData.amountPaidLastYear !== undefined) {
    row.amount_paid = cleanData.amountPaidLastYear;
    delete row.amountPaidLastYear;
  }

  delete row.totalAmountDue;
  delete row.status;

  return { row, users, receipts, bills, owner };
}

export const ratepayerDb = {
  user: {
    async findUnique(args: { where: { phoneNumber?: string; id?: string }; include?: any }) {
      let query = supabase.from('User').select('*');
      if (args.where.phoneNumber) query = query.eq('phoneNumber', args.where.phoneNumber);
      if (args.where.id) query = query.eq('id', args.where.id);
      const { data, error } = await query.maybeSingle();
      if (error || !data) return null;

      if (args.include?.properties) {
        data.properties = await ratepayerDb.property.findMany({ where: { users: { some: { id: data.id } } } });
      }
      return data;
    },

    async findFirst(args?: { where?: any; include?: any }) {
      if (!args?.where) {
        return null;
      }

      let query = supabase.from('User').select('*');
      const w = args.where;

      if (w.id) {
        query = query.eq('id', w.id);
      }
      if (w.phoneNumber) {
        query = query.eq('phoneNumber', w.phoneNumber);
      }
      if (w.role) {
        query = query.eq('role', w.role);
      }
      if (w.OR && Array.isArray(w.OR)) {
        const orClauses: string[] = [];
        for (const cond of w.OR) {
          if (cond.phoneNumber) orClauses.push(`phoneNumber.eq.${cond.phoneNumber}`);
          if (cond.id) orClauses.push(`id.eq.${cond.id}`);
        }
        if (orClauses.length > 0) {
          query = query.or(orClauses.join(','));
        }
      }

      const { data, error } = await query.limit(1).maybeSingle();
      if (error || !data) return null;
      if (args?.include?.properties) {
        data.properties = await ratepayerDb.property.findMany({ where: { users: { some: { id: data.id } } } });
      }
      return data;
    },

    async create(args: { data: any }) {
      const id = args.data.id || `usr_${args.data.phoneNumber || Math.random().toString(36).substring(2, 9)}`;
      const row = {
        ...args.data,
        id,
        createdAt: args.data.createdAt || new Date().toISOString(),
        updatedAt: args.data.updatedAt || new Date().toISOString(),
      };
      const { data, error } = await supabase.from('User').insert([row]).select().single();
      if (error) throw new Error(error.message);
      return data;
    },

    async update(args: { where: { id?: string; phoneNumber?: string }; data: any }) {
      let query = supabase.from('User').update({ ...args.data, updatedAt: new Date().toISOString() });
      if (args.where.id) query = query.eq('id', args.where.id);
      if (args.where.phoneNumber) query = query.eq('phoneNumber', args.where.phoneNumber);
      const { data, error } = await query.select().single();
      if (error) throw new Error(error.message);
      return data;
    },

    async upsert(args: { where: { phoneNumber: string }; create: any; update: any }) {
      const existing = await ratepayerDb.user.findUnique({ where: { phoneNumber: args.where.phoneNumber } });
      if (existing) {
        return ratepayerDb.user.update({ where: { id: existing.id }, data: args.update });
      }
      return ratepayerDb.user.create({ data: args.create });
    },
  },

  session: {
    async findUnique(args: { where: { token: string }; include?: any }) {
      const { data: session, error } = await supabase.from('Session').select('*').eq('token', args.where.token).maybeSingle();
      if (error || !session) return null;

      if (args.include?.user) {
        session.user = await ratepayerDb.user.findUnique({
          where: { id: session.userId },
          include: args.include.user.include,
        });
      }
      return session;
    },

    async create(args: { data: any }) {
      const id = args.data.id || `sess_${Math.random().toString(36).substring(2, 12)}`;
      const row = {
        ...args.data,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('Session').insert([row]).select().single();
      if (error) throw new Error(error.message);
      return data;
    },

    async deleteMany(args: { where: { userId?: string; token?: string } }) {
      let query = supabase.from('Session').delete();
      if (args.where.userId) query = query.eq('userId', args.where.userId);
      if (args.where.token) query = query.eq('token', args.where.token);
      const { data, error } = await query.select();
      if (error) throw new Error(error.message);
      return { count: data?.length || 0 };
    },
  },

  property: {
    async findMany(args?: { where?: any; include?: any; orderBy?: any; take?: number; skip?: number }) {
      let query = supabase.from('Property').select('*');

      if (args?.where) {
        if (args.where.accountNumber) query = query.eq('account_no', args.where.accountNumber);
        if (args.where.ownerDigitalAddress) query = query.eq('ownerDigitalAddress', args.where.ownerDigitalAddress);
        if (args.where.telephone) query = query.eq('telephone', args.where.telephone);

        if (args.where.OR && Array.isArray(args.where.OR)) {
          const parts: string[] = [];
          for (const cond of args.where.OR) {
            if (cond.telephone) parts.push(`telephone.eq.${cond.telephone}`);
            if (cond.accountNumber || cond.account_no) parts.push(`account_no.eq.${cond.accountNumber || cond.account_no}`);
            if (cond.id) parts.push(`id.eq.${cond.id}`);
          }
          if (parts.length > 0) {
            query = query.or(parts.join(','));
          }
        }

        if (args.where.users?.some?.id) {
          const userId = args.where.users.some.id;
          const { data: userRecord } = await supabase.from('User').select('id, phoneNumber').eq('id', userId).maybeSingle();

          const cleanPhone = userRecord?.phoneNumber ? userRecord.phoneNumber.replace(/\D/g, '') : '';
          const phone10 = cleanPhone.length === 12 && cleanPhone.startsWith('233') ? '0' + cleanPhone.substring(3) : cleanPhone;
          const phone9 = cleanPhone.length === 10 && cleanPhone.startsWith('0') ? cleanPhone.substring(1) : cleanPhone;
          const phone233 = cleanPhone.length === 10 && cleanPhone.startsWith('0') ? '233' + cleanPhone.substring(1) : cleanPhone;

          const phoneOrClauses: string[] = [];
          if (userRecord?.phoneNumber) phoneOrClauses.push(`telephone.eq.${userRecord.phoneNumber}`);
          if (cleanPhone && cleanPhone !== userRecord?.phoneNumber) phoneOrClauses.push(`telephone.eq.${cleanPhone}`);
          if (phone10 && phone10 !== cleanPhone) phoneOrClauses.push(`telephone.eq.${phone10}`);
          if (phone9) phoneOrClauses.push(`telephone.eq.${phone9}`);
          if (phone233) phoneOrClauses.push(`telephone.eq.${phone233}`);

          const [linksRes, ownersRes, directPropsRes] = await Promise.all([
            supabase.from('_PropertyToUser').select('A').eq('B', userId),
            userRecord?.phoneNumber
              ? supabase.from('PropertyOwner').select('ownerId').or(`tel.eq.${userRecord.phoneNumber},mobileNumber.eq.${userRecord.phoneNumber}`)
              : Promise.resolve({ data: [] as any }),
            phoneOrClauses.length > 0
              ? supabase.from('Property').select('id').or(phoneOrClauses.join(','))
              : Promise.resolve({ data: [] as any }),
          ]);
          const directPropIds = (linksRes?.data || []).map((l: any) => l.A);
          const ownerIds = (ownersRes?.data || []).map((o: any) => o.ownerId);
          const phonePropIds = (directPropsRes?.data || []).map((p: any) => p.id);

          let ownerPropIds: string[] = [];
          if (ownerIds.length > 0) {
            const { data: opData } = await supabase.from('Property').select('id').in('ownerId', ownerIds);
            ownerPropIds = (opData || []).map((p: any) => p.id);
          }

          const allPropIds = Array.from(new Set([...directPropIds, ...ownerPropIds, ...phonePropIds]));
          if (allPropIds.length === 0) return [];
          query = query.in('id', allPropIds);
        }
      }

      if (args?.orderBy) {
        let field = Object.keys(args.orderBy)[0];
        if (field === 'accountNumber') field = 'account_no';
        if (field === 'propertyClassification') field = 'property_cat';
        if (field === 'currentFee') field = 'current_bill';
        if (field === 'amountPaidLastYear') field = 'amount_paid';

        const dir = args.orderBy[field] === 'desc' ? { ascending: false } : { ascending: true };
        query = query.order(field, dir);
      }

      if (args?.take) query = query.limit(args.take);
      if (args?.skip) query = query.range(args.skip, (args.skip + (args.take || 10)) - 1);

      const { data: rawData, error } = (await query) as { data: any[] | null; error: any };
      if (error) {
        console.error('Property query failed:', error);
        throw new Error(`Property query failed: ${error.message}`);
      }

      if (!rawData) {
        return [];
      }

      const data: any[] = rawData.map(mapPropertyRow);

      if (args?.include?.receipts) {
        const propIds = data.map((p: any) => p.id);
        const { data: allReceipts } = await supabase
          .from('Receipt')
          .select('id, receiptNumber, amount, datePaid, propertyId, gcrNumber, settlementType')
          .in('propertyId', propIds);

        const receiptsByPropId = (allReceipts || []).reduce((acc: any, r: any) => {
          if (!acc[r.propertyId]) acc[r.propertyId] = [];
          acc[r.propertyId].push(r);
          return acc;
        }, {});

        for (const prop of data) {
          prop.receipts = receiptsByPropId[prop.id] || [];
        }
      }

      return data;
    },

    async findFirst(args?: { where?: any; include?: any }) {
      if (!args?.where) {
        return null;
      }

      let query = supabase.from('Property').select('*');
      const w = args.where;

      if (w.OR && Array.isArray(w.OR)) {
        // Build OR string e.g. account_no.eq.X,id.eq.X
        const parts: string[] = [];
        for (const cond of w.OR) {
          const acc = cond.accountNumber || cond.account_no;
          const id = cond.id;
          if (acc) parts.push(`account_no.eq.${acc}`);
          if (id) parts.push(`id.eq.${id}`);
        }
        if (parts.length > 0) {
          query = query.or(parts.join(','));
        }
      } else {
        const acc = w.accountNumber || w.account_no;
        const id = w.id;
        if (acc && id) {
          query = query.or(`account_no.eq.${acc},id.eq.${id}`);
        } else if (acc) {
          query = query.eq('account_no', acc);
        } else if (id) {
          query = query.eq('id', id);
        }
      }

      const { data: rawData, error } = await query.limit(1).maybeSingle();
      if (error || !rawData) return null;

      const data = mapPropertyRow(rawData);

      if (args.include?.owner && data.ownerId) {
        const { data: owner } = await supabase.from('PropertyOwner').select('*').eq('ownerId', data.ownerId).maybeSingle();
        data.owner = owner || null;
      }

      if (args.include?.users) {
        const { data: links } = await supabase.from('_PropertyToUser').select('B').eq('A', data.id);
        const userIds = (links || []).map((l: any) => l.B);
        if (userIds.length > 0) {
          const { data: users } = await supabase.from('User').select('*').in('id', userIds);
          data.users = users || [];
        } else if (data.owner?.mobileNumber || data.owner?.tel || data.telephone) {
          const rawPhone = data.owner?.mobileNumber || data.owner?.tel || data.telephone;
          const cleanPhone = (rawPhone || '').replace(/\D/g, '');
          const phone10 = cleanPhone.length === 12 && cleanPhone.startsWith('233') ? '0' + cleanPhone.substring(3) : cleanPhone;
          const { data: matchedUsers } = await supabase.from('User').select('*').or(`phoneNumber.eq.${rawPhone},phoneNumber.eq.${cleanPhone},phoneNumber.eq.${phone10}`);
          data.users = matchedUsers || [];
        } else {
          data.users = [];
        }
      }

      if (args.include?.receipts) {
        const { data: receipts } = await supabase.from('Receipt').select('*').eq('propertyId', data.id);
        data.receipts = receipts || [];
      }
      return data;
    },

    async findUnique(args: { where: { accountNumber?: string; account_no?: string; id?: string }; include?: any }) {
      let query = supabase.from('Property').select('*');
      const acc = args.where.accountNumber || (args.where as any).account_no;
      if (acc && args.where.id) {
        query = query.or(`account_no.eq.${acc},id.eq.${args.where.id}`);
      } else if (acc) {
        query = query.eq('account_no', acc);
      } else if (args.where.id) {
        query = query.eq('id', args.where.id);
      }
      const { data: rawData, error } = await query.maybeSingle();
      if (error || !rawData) return null;

      const data = mapPropertyRow(rawData);

      if (args.include?.owner && data.ownerId) {
        const { data: owner } = await supabase.from('PropertyOwner').select('*').eq('ownerId', data.ownerId).maybeSingle();
        data.owner = owner || null;
      }

      if (args.include?.users) {
        const { data: links } = await supabase.from('_PropertyToUser').select('B').eq('A', data.id);
        const userIds = (links || []).map((l: any) => l.B);
        if (userIds.length > 0) {
          const { data: users } = await supabase.from('User').select('*').in('id', userIds);
          data.users = users || [];
        } else if (data.owner?.mobileNumber || data.owner?.tel || data.telephone) {
          const rawPhone = data.owner?.mobileNumber || data.owner?.tel || data.telephone;
          const cleanPhone = (rawPhone || '').replace(/\D/g, '');
          const phone10 = cleanPhone.length === 12 && cleanPhone.startsWith('233') ? '0' + cleanPhone.substring(3) : cleanPhone;
          const { data: matchedUsers } = await supabase.from('User').select('*').or(`phoneNumber.eq.${rawPhone},phoneNumber.eq.${cleanPhone},phoneNumber.eq.${phone10}`);
          data.users = matchedUsers || [];
        } else {
          data.users = [];
        }
      }

      if (args.include?.receipts) {
        const { data: receipts } = await supabase.from('Receipt').select('*').eq('propertyId', data.id);
        data.receipts = receipts || [];
      }
      return data;
    },

    async update(args: { where: { id?: string; accountNumber?: string }; data: any }) {
      const { users, ...restData } = args.data || {};
      const { row } = preparePropertyWritePayload(restData);
      let query = supabase.from('Property').update(row);
      if (args.where.id) query = query.eq('id', args.where.id);
      if (args.where.accountNumber) query = query.eq('account_no', args.where.accountNumber);
      const { data, error } = await query.select().single();
      if (error) throw new Error(error.message);

      if (users?.connect?.id && data?.id) {
        try {
          await supabase.from('_PropertyToUser').upsert([{
            A: data.id,
            B: users.connect.id,
          }], { onConflict: 'A,B' });
        } catch {
          // ignore duplicate conflict error
        }
      }

      return mapPropertyRow(data);
    },

    async count(args?: { where?: any }) {
      let query = supabase.from('Property').select('*', { count: 'exact', head: true });
      if (args?.where?.status) {
        query = query.or('arrears.gt.0,current_bill.gt.0');
      }
      const { count, error } = await query;
      if (error) return 0;
      return count || 0;
    },
  },

  bill: {
    async findMany(args?: { where?: any }) {
      let query = supabase.from('Bill').select('*');
      if (args?.where?.accountNo) query = query.eq('accountNo', args.where.accountNo);
      const { data, error } = await query;
      if (error || !data) return [];
      return data;
    },
    async findFirst(args?: { where?: any }) {
      let query = supabase.from('Bill').select('*');
      if (args?.where?.accountNo) query = query.eq('accountNo', args.where.accountNo);
      const { data, error } = await query.limit(1).maybeSingle();
      if (error || !data) return null;
      return data;
    },
  },

  transaction: {
    async findUnique(args: { where: { reference?: string; id?: string } }) {
      let query = supabase.from('Transaction').select('*');
      if (args.where.reference) query = query.eq('reference', args.where.reference);
      if (args.where.id) query = query.eq('id', args.where.id);
      const { data, error } = await query.maybeSingle();
      if (error || !data) return null;
      return data;
    },

    async create(args: { data: any }) {
      const id = args.data.id || `txn_${Math.random().toString(36).substring(2, 12)}`;
      const row = {
        ...args.data,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('Transaction').insert([row]).select().single();
      if (error) throw new Error(error.message);
      return data;
    },

    async update(args: { where: { id?: string; reference?: string }; data: any }) {
      let query = supabase.from('Transaction').update({ ...args.data, updatedAt: new Date().toISOString() });
      if (args.where.id) query = query.eq('id', args.where.id);
      if (args.where.reference) query = query.eq('reference', args.where.reference);
      const { data, error } = await query.select().single();
      if (error) throw new Error(error.message);
      return data;
    },

    async count(args?: { where?: any }) {
      let query = supabase.from('Transaction').select('*', { count: 'exact', head: true });
      if (args?.where?.status) query = query.eq('status', args.where.status);
      if (args?.where?.propertyId) query = query.eq('propertyId', args.where.propertyId);
      const { count, error } = await query;
      if (error) return 0;
      return count || 0;
    },
  },

  tGCRNr: {
    async findFirst(args?: { where?: any; orderBy?: any }) {
      let query = supabase.from('TGCRNr').select('*');
      if (args?.where?.isUsed !== undefined) query = query.eq('isUsed', args.where.isUsed);
      if (args?.orderBy?.gcrNo) {
        query = query.order('gcrNo', { ascending: args.orderBy.gcrNo === 'asc' });
      }
      const { data, error } = await query.limit(1).maybeSingle();
      if (error || !data) return null;
      return data;
    },

    async update(args: { where: { id?: string; gcrNo?: string }; data: any }) {
      let query = supabase.from('TGCRNr').update(args.data);
      if (args.where.id) query = query.eq('id', args.where.id);
      if (args.where.gcrNo) query = query.eq('gcrNo', args.where.gcrNo);
      const { data, error } = await query.select().single();
      if (error) throw new Error(error.message);
      return data;
    },
  },

  feePayment: {
    async create(args: { data: any }) {
      const id = args.data.id || `fp_${Math.random().toString(36).substring(2, 12)}`;
      const row = {
        ...args.data,
        id,
        datePaid: args.data.datePaid || new Date().toISOString(),
        adate: args.data.adate || new Date().toISOString(),
      };
      const { data, error } = await supabase.from('FeePayment').insert([row]).select().single();
      if (error) throw new Error(error.message);
      return data;
    },
  },

  receipt: {
    async create(args: { data: any }) {
      const id = args.data.id || `rec_${Math.random().toString(36).substring(2, 12)}`;
      const row = {
        ...args.data,
        id,
        datePaid: args.data.datePaid || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('Receipt').insert([row]).select().single();
      if (error) throw new Error(error.message);
      return data;
    },

    async findMany(args?: { where?: any; orderBy?: any }) {
      let query = supabase.from('Receipt').select('*');
      if (args?.where?.userId) query = query.eq('userId', args.where.userId);
      if (args?.where?.propertyId) query = query.eq('propertyId', args.where.propertyId);
      if (args?.orderBy?.datePaid) {
        query = query.order('datePaid', { ascending: args.orderBy.datePaid === 'asc' });
      }
      const { data, error } = await query;
      if (error || !data) return [];
      return data;
    },
  },

  notification: {
    async findMany(args?: { where?: any; orderBy?: any }) {
      let query = supabase.from('Notification').select('*');
      if (args?.where?.userId) query = query.eq('userId', args.where.userId);
      if (args?.orderBy?.createdAt) {
        query = query.order('createdAt', { ascending: args.orderBy.createdAt === 'asc' });
      } else {
        query = query.order('createdAt', { ascending: false });
      }
      const { data, error } = await query;
      if (error || !data) return [];
      return data;
    },

    async create(args: { data: any }) {
      const id = args.data.id || `notif_${Math.random().toString(36).substring(2, 12)}`;
      const row = {
        ...args.data,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('Notification').insert([row]).select().single();
      if (error) throw new Error(error.message);
      return data;
    },

    async update(args: { where: { id: string }; data: any }) {
      const { data, error } = await supabase.from('Notification')
        .update({ ...args.data, updatedAt: new Date().toISOString() })
        .eq('id', args.where.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },

    async updateMany(args: { where: { userId?: string }; data: any }) {
      let query = supabase.from('Notification').update({ ...args.data, updatedAt: new Date().toISOString() });
      if (args.where.userId) query = query.eq('userId', args.where.userId);
      const { data, error } = await query.select();
      if (error) throw new Error(error.message);
      return { count: data?.length || 0 };
    },
  },

  accessGrant: {
    async findUnique(args: { where: { token?: string; id?: string } }) {
      let query = supabase.from('AccessGrant').select('*');
      if (args.where.token) query = query.eq('token', args.where.token);
      if (args.where.id) query = query.eq('id', args.where.id);
      const { data, error } = await query.maybeSingle();
      if (error || !data) return null;
      return data;
    },

    async create(args: { data: any }) {
      const row = {
        ...args.data,
        createdAt: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('AccessGrant').insert([row]).select().single();
      if (error) throw new Error(error.message);
      return data;
    },

    async update(args: { where: { id?: string; token?: string }; data: any }) {
      let query = supabase.from('AccessGrant').update(args.data);
      if (args.where.id) query = query.eq('id', args.where.id);
      if (args.where.token) query = query.eq('token', args.where.token);
      const { data, error } = await query.select().single();
      if (error) throw new Error(error.message);
      return data;
    },
  },
};