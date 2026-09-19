import { supabase } from './supabase';

export function mapPropertyRow(p: any) {
  if (!p) return null;
  const arrears = Number(p.arrears || 0);
  const currentFee = Number(p.current_bill !== undefined ? p.current_bill : p.currentFee || 0);
  const amountPaidLastYear = Number(p.amount_paid !== undefined ? p.amount_paid : p.amountPaidLastYear || 0);
  // Prefer the DB-computed outstanding_amt column; fall back to derived arithmetic
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
    // Expose direct Property.name and Property.telephone (legacy ratepayer fields)
    ownerNameDirect: p.name || null,
    ownerPhoneDirect: p.telephone || null,
    name: p.name || null,
    telephone: p.telephone || null,
    houseNo: p.houseNo || '',
    plotNo: p.plotNo || '',
    electoral_area: p.electoral_area || '',
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

export async function resolvePropertySearchIds(searchStr: string): Promise<string[] | null> {
  const q = searchStr.trim();
  if (!q) return null;

  const tokens = q.split(/\s+/).filter(Boolean);
  let finalMatchingPropIds: Set<string> | null = null;

  for (const token of tokens) {
    const [matchedUsersRes, matchedOwnersRes, matchedReceiptsRes, matchedPropsRes] = await Promise.all([
      supabase.from('User').select('id').or(`name.ilike.%${token}%,phoneNumber.ilike.%${token}%`).limit(5000),
      supabase.from('PropertyOwner').select('ownerId').or(`name.ilike.%${token}%,tel.ilike.%${token}%,mobileNumber.ilike.%${token}%,address.ilike.%${token}%,streetAddress.ilike.%${token}%,corporationPartnership.ilike.%${token}%,email.ilike.%${token}%`).limit(5000),
      supabase.from('Receipt').select('propertyId').or(`receiptNumber.ilike.%${token}%,paymentPhoneNumber.ilike.%${token}%`).limit(5000),
      // Include direct Property.name and Property.telephone (legacy ratepayer fields confirmed in DB)
      supabase.from('Property').select('id').or(`account_no.ilike.%${token}%,valuationNo.ilike.%${token}%,ownerDigitalAddress.ilike.%${token}%,houseNo.ilike.%${token}%,plotNo.ilike.%${token}%,property_cat.ilike.%${token}%,municipality.ilike.%${token}%,name.ilike.%${token}%,telephone.ilike.%${token}%`).limit(5000)
    ]);

    const userIds = (matchedUsersRes.data || []).map((u: any) => u.id);
    const ownerIds = (matchedOwnersRes.data || []).map((o: any) => o.ownerId);
    const receiptPropIds = (matchedReceiptsRes.data || []).map((r: any) => r.propertyId).filter(Boolean);
    const directPropIds = (matchedPropsRes.data || []).map((p: any) => p.id);

    let propIdsFromUsers: string[] = [];
    if (userIds.length > 0) {
      const { data: links } = await supabase
        .from('_PropertyToUser')
        .select('A')
        .in('B', userIds)
        .limit(5000);
      propIdsFromUsers = (links || []).map((l: any) => l.A);
    }

    let propIdsFromOwners: string[] = [];
    if (ownerIds.length > 0) {
      const { data: ownerProps } = await supabase
        .from('Property')
        .select('id')
        .in('ownerId', ownerIds)
        .limit(5000);
      propIdsFromOwners = (ownerProps || []).map((p: any) => p.id);
    }

    const tokenPropIds = new Set([
      ...directPropIds,
      ...propIdsFromUsers,
      ...propIdsFromOwners,
      ...receiptPropIds
    ]);

    if (finalMatchingPropIds === null) {
      finalMatchingPropIds = tokenPropIds;
    } else {
      finalMatchingPropIds = new Set(
        Array.from(finalMatchingPropIds).filter((id) => tokenPropIds.has(id))
      );
    }
  }

  return finalMatchingPropIds ? Array.from(finalMatchingPropIds) : [];
}

async function resolveUserSearchIds(searchStr: string): Promise<string[] | null> {
  const q = searchStr.trim();
  if (!q) return null;

  const tokens = q.split(/\s+/).filter(Boolean);
  let finalMatchingUserIds: Set<string> | null = null;

  for (const token of tokens) {
    const [matchedUsersRes, matchedPropsRes] = await Promise.all([
      supabase.from('User').select('id').or(`name.ilike.%${token}%,phoneNumber.ilike.%${token}%`).limit(5000),
      supabase.from('Property').select('id').or(`account_no.ilike.%${token}%,valuationNo.ilike.%${token}%,ownerDigitalAddress.ilike.%${token}%,physicalAddress.ilike.%${token}%`).limit(5000)
    ]);

    const directUserIds = (matchedUsersRes.data || []).map((u: any) => u.id);
    const propIds = (matchedPropsRes.data || []).map((p: any) => p.id);

    let userIdsFromProps: string[] = [];
    if (propIds.length > 0) {
      const { data: links } = await supabase
        .from('_PropertyToUser')
        .select('B')
        .in('A', propIds)
        .limit(5000);
      userIdsFromProps = (links || []).map((l: any) => l.B);
    }

    const tokenUserIds = new Set([...directUserIds, ...userIdsFromProps]);

    if (finalMatchingUserIds === null) {
      finalMatchingUserIds = tokenUserIds;
    } else {
      finalMatchingUserIds = new Set(
        Array.from(finalMatchingUserIds).filter((id) => tokenUserIds.has(id))
      );
    }
  }

  return finalMatchingUserIds ? Array.from(finalMatchingUserIds) : [];
}

function chunkArray<T>(array: T[], size = 60): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function applyRequiredFieldsFilter(query: any, requiredFields?: string[]) {
  if (!requiredFields || !Array.isArray(requiredFields) || requiredFields.length === 0) {
    return query;
  }
  for (const field of requiredFields) {
    const f = field?.trim();
    if (!f || f === 'ALL') continue;

    if (f === 'telephone' || f === 'ownerPhone') {
      query = query.not('telephone', 'is', null).neq('telephone', '').neq('telephone', '0');
    } else if (f === 'name' || f === 'ownerName') {
      query = query.not('name', 'is', null).neq('name', '').not('name', 'ilike', '%NO NAME%');
    } else if (f === 'ownerDigitalAddress') {
      query = query.not('ownerDigitalAddress', 'is', null).neq('ownerDigitalAddress', '').neq('ownerDigitalAddress', 'N/A');
    } else if (f === 'houseNo') {
      query = query.not('houseNo', 'is', null).neq('houseNo', '');
    } else if (f === 'plotNo') {
      query = query.not('plotNo', 'is', null).neq('plotNo', '');
    } else if (f === 'valuationNo') {
      query = query.not('valuationNo', 'is', null).neq('valuationNo', '');
    } else if (f === 'property_cat' || f === 'propertyClassification') {
      query = query.not('property_cat', 'is', null).neq('property_cat', '');
    } else if (f === 'electoral_area') {
      query = query.not('electoral_area', 'is', null).neq('electoral_area', '');
    } else if (f === 'account_no' || f === 'accountNumber') {
      query = query.not('account_no', 'is', null).neq('account_no', '');
    } else if (f === 'arrears') {
      query = query.not('arrears', 'is', null).gt('arrears', 0);
    } else if (f === 'current_bill' || f === 'currentFee') {
      query = query.not('current_bill', 'is', null).gt('current_bill', 0);
    } else if (f === 'outstanding_amt' || f === 'totalAmountDue') {
      query = query.not('outstanding_amt', 'is', null).gt('outstanding_amt', 0);
    } else if (f === 'rateableValue') {
      query = query.not('rateableValue', 'is', null).gt('rateableValue', 0);
    } else if (f === 'amount_paid' || f === 'amountPaidLastYear') {
      query = query.not('amount_paid', 'is', null).gt('amount_paid', 0);
    } else {
      query = query.not(f, 'is', null);
    }
  }
  return query;
}

export const adminDb = {
  adminUser: {
    async findUnique(args: { where: { username?: string; id?: string } }) {
      let query = supabase.from('AdminUser').select('*');
      if (args.where.username) {
        query = query.ilike('username', args.where.username.trim());
      }
      if (args.where.id) {
        query = query.eq('id', args.where.id);
      }
      const { data, error } = await query.maybeSingle();
      if (error || !data) return null;
      return data;
    },

    async findMany(args?: { where?: any; orderBy?: any }) {
      let query = supabase.from('AdminUser').select('id, username, name, role, isActive, createdAt, updatedAt');
      if (args?.where?.role) query = query.eq('role', args.where.role);
      if (args?.where?.isActive !== undefined) query = query.eq('isActive', args.where.isActive);
      const { data, error } = await query;
      if (error || !data) return [];
      return data;
    },
  },

  user: {
    async findUnique(args: { where: { phoneNumber?: string; id?: string }; include?: any }) {
      let query = supabase.from('User').select('*');
      if (args.where.phoneNumber) query = query.eq('phoneNumber', args.where.phoneNumber);
      if (args.where.id) query = query.eq('id', args.where.id);
      const { data, error } = await query.maybeSingle();
      if (error || !data) return null;

      if (args.include?.properties) {
        const [linksRes, ownersRes] = await Promise.all([
          supabase.from('_PropertyToUser').select('A').eq('B', data.id),
          data.phoneNumber
            ? supabase.from('PropertyOwner').select('ownerId').or(`tel.eq.${data.phoneNumber},mobileNumber.eq.${data.phoneNumber}`)
            : Promise.resolve({ data: [] } as any)
        ]);

        const directPropIds = (linksRes.data || []).map((l: any) => l.A);
        const ownerIds = (ownersRes.data || []).map((o: any) => o.ownerId);

        const propQueries: any[] = [];
        if (directPropIds.length > 0) {
          propQueries.push(supabase.from('Property').select('*').in('id', directPropIds));
        }
        if (ownerIds.length > 0) {
          propQueries.push(supabase.from('Property').select('*').in('ownerId', ownerIds));
        }
        if (data.phoneNumber) {
          propQueries.push(supabase.from('Property').select('*').eq('telephone', data.phoneNumber));
        }

        if (propQueries.length > 0) {
          const propRes = await Promise.all(propQueries);
          const allProps = propRes.flatMap((r) => (r.data || []).map(mapPropertyRow));
          const dedupedMap = new Map<string, any>();
          for (const p of allProps) {
            dedupedMap.set(p.id, p);
          }
          data.properties = Array.from(dedupedMap.values());
        } else {
          data.properties = [];
        }
      }
      if (args.include?.receipts) {
        const { data: receipts } = await supabase.from('Receipt').select('*').eq('userId', data.id).order('datePaid', { ascending: false });
        data.receipts = receipts || [];
      }
      if (args.include?.notifications) {
        const { data: notifs } = await supabase.from('Notification').select('*').eq('userId', data.id).order('createdAt', { ascending: false });
        data.notifications = notifs || [];
      }
      return data;
    },

    async findMany(args?: { where?: any; include?: any; orderBy?: any; take?: number; skip?: number }) {
      let query = supabase.from('User').select('id, name, phoneNumber, role, isVerified, createdAt, updatedAt');
      if (args?.where?.role) query = query.eq('role', args.where.role);
      if (args?.where?.search) {
        const matchedIds = await resolveUserSearchIds(String(args.where.search));
        if (matchedIds !== null) {
          if (matchedIds.length === 0) return [];
          query = query.in('id', matchedIds);
        }
      }

      if (args?.orderBy) {
        const field = Object.keys(args.orderBy)[0];
        const dir = args.orderBy[field] === 'desc' ? { ascending: false } : { ascending: true };
        query = query.order(field, dir);
      }

      if (args?.take) query = query.limit(args.take);
      if (args?.skip) query = query.range(args.skip, (args.skip + (args.take || 10)) - 1);

      const { data, error } = (await query) as { data: any[] | null; error: any };
      if (error || !data || data.length === 0) return data || [];

      const userIds = data.map((u: any) => u.id);

      if (args?.include?.properties) {
        const phoneNumbers = data.map((u: any) => u.phoneNumber).filter(Boolean);
        const userChunks = chunkArray(userIds, 60);
        const phoneChunks = chunkArray(phoneNumbers, 40);

        const [linkResults, ownerResults] = await Promise.all([
          Promise.all(userChunks.map((chunk) => supabase.from('_PropertyToUser').select('A, B').in('B', chunk))),
          Promise.all(phoneChunks.map((chunk) =>
            supabase.from('PropertyOwner').select('ownerId, tel, mobileNumber').or(chunk.map((p: string) => `tel.eq.${p},mobileNumber.eq.${p}`).join(','))
          )),
        ]);

        const allLinks: any[] = linkResults.flatMap((r) => r.data || []);
        const allOwners: any[] = ownerResults.flatMap((r) => r.data || []);

        const phoneToOwnerIds: Record<string, string[]> = {};
        for (const o of allOwners) {
          if (o.tel) {
            if (!phoneToOwnerIds[o.tel]) phoneToOwnerIds[o.tel] = [];
            phoneToOwnerIds[o.tel].push(o.ownerId);
          }
          if (o.mobileNumber && o.mobileNumber !== o.tel) {
            if (!phoneToOwnerIds[o.mobileNumber]) phoneToOwnerIds[o.mobileNumber] = [];
            phoneToOwnerIds[o.mobileNumber].push(o.ownerId);
          }
        }

        const directPropIds = Array.from(new Set(allLinks.map((l: any) => l.A)));
        const allOwnerIds = Array.from(new Set(Object.values(phoneToOwnerIds).flat()));

        const directPropChunks = chunkArray(directPropIds, 60);
        const ownerPropChunks = chunkArray(allOwnerIds, 60);

        const propQueries = [
          ...directPropChunks.map((chunk) =>
            supabase.from('Property').select('id, account_no, valuationNo, ownerId, ownerDigitalAddress, property_cat, rateableValue, arrears, current_bill, amount_paid, billYear, municipality, telephone').in('id', chunk)
          ),
          ...ownerPropChunks.map((chunk) =>
            supabase.from('Property').select('id, account_no, valuationNo, ownerId, ownerDigitalAddress, property_cat, rateableValue, arrears, current_bill, amount_paid, billYear, municipality, telephone').in('ownerId', chunk)
          ),
          ...phoneChunks.map((chunk) =>
            supabase.from('Property').select('id, account_no, valuationNo, ownerId, ownerDigitalAddress, property_cat, rateableValue, arrears, current_bill, amount_paid, billYear, municipality, telephone').in('telephone', chunk)
          ),
        ];

        const propResults = await Promise.all(propQueries);
        const allProps = propResults.flatMap((r) => (r.data || []).map(mapPropertyRow));

        const propsById: Record<string, any> = {};
        const propsByOwnerId: Record<string, any[]> = {};

        for (const p of allProps) {
          propsById[p.id] = p;
          if (p.ownerId) {
            if (!propsByOwnerId[p.ownerId]) propsByOwnerId[p.ownerId] = [];
            propsByOwnerId[p.ownerId].push(p);
          }
        }

        for (const u of data) {
          const uDirectIds = allLinks.filter((l: any) => l.B === u.id).map((l: any) => l.A);
          const uOwnerIds = phoneToOwnerIds[u.phoneNumber] || [];

          const userPropMap = new Map<string, any>();
          for (const pid of uDirectIds) {
            if (propsById[pid]) userPropMap.set(pid, propsById[pid]);
          }
          for (const oid of uOwnerIds) {
            const oProps = propsByOwnerId[oid] || [];
            for (const op of oProps) {
              userPropMap.set(op.id, op);
            }
          }
          for (const p of allProps) {
            if (p.telephone && p.telephone === u.phoneNumber) {
              userPropMap.set(p.id, p);
            }
          }

          u.properties = Array.from(userPropMap.values());
        }
      }

      if (args?.include?.receipts) {
        const { data: allReceipts } = await supabase
          .from('Receipt')
          .select('id, receiptNumber, amount, datePaid, userId, propertyId, gcrNumber')
          .in('userId', userIds);

        const receiptsByUserId = (allReceipts || []).reduce((acc: any, r: any) => {
          if (!acc[r.userId]) acc[r.userId] = [];
          acc[r.userId].push(r);
          return acc;
        }, {});

        for (const u of data) {
          u.receipts = receiptsByUserId[u.id] || [];
        }
      }

      if (args?.include?.notifications) {
        const { data: allNotifs } = await supabase
          .from('Notification')
          .select('id, title, message, type, deliveryMethod, deliveryStatus, createdAt, userId')
          .in('userId', userIds);

        const notifsByUserId = (allNotifs || []).reduce((acc: any, n: any) => {
          if (!acc[n.userId]) acc[n.userId] = [];
          acc[n.userId].push(n);
          return acc;
        }, {});

        for (const u of data) {
          u.notifications = notifsByUserId[u.id] || [];
        }
      }

      return data;
    },

    async count(args?: { where?: any }) {
      let query = supabase.from('User').select('*', { count: 'exact', head: true });
      if (args?.where?.role) query = query.eq('role', args.where.role);
      if (args?.where?.search) {
        const matchedIds = await resolveUserSearchIds(String(args.where.search));
        if (matchedIds !== null) {
          if (matchedIds.length === 0) return 0;
          query = query.in('id', matchedIds);
        }
      }
      const { count, error } = await query;
      if (error) return 0;
      return count || 0;
    },

    async create(args: { data: any }) {
      const id = args.data.id || `usr_${args.data.phoneNumber.replace(/\D/g, '')}`;
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
  },

  property: {
    async findMany(args?: { where?: any; include?: any; orderBy?: any; take?: number; skip?: number }) {
      // Inside adminDb.property.findMany
      const buildBaseQuery = (accountInChunk?: string[]) => {
        let query = supabase
          .from('Property')
          // Fetch all columns directly from the Supabase DB to reflect the true schema
          .select('*');
        if (args?.where) {
          if (args.where.propertyClassification && args.where.propertyClassification !== 'ALL') {
            query = query.eq('property_cat', args.where.propertyClassification);
          }
          if (accountInChunk) {
            query = query.in('account_no', accountInChunk);
          } else if (args.where.accountNumber) {
            if (args.where.accountNumber.in) {
              query = query.in('account_no', args.where.accountNumber.in);
            } else {
              query = query.eq('account_no', args.where.accountNumber);
            }
          }
          if (args.where.ownerDigitalAddress) query = query.eq('ownerDigitalAddress', args.where.ownerDigitalAddress);
          if (args.where.municipality) query = query.eq('municipality', args.where.municipality);
          // Status filter at DB level using actual columns (no 'status' column in DB)
          if (args.where.status && args.where.status !== 'ALL') {
            if (args.where.status === 'UNPAID') {
              query = query.gt('outstanding_amt', 0);
            } else if (args.where.status === 'DEFAULTER') {
              query = query.gt('arrears', 0).gt('outstanding_amt', 0);
            } else if (args.where.status === 'PAID') {
              query = query.eq('outstanding_amt', 0);
            } else if (args.where.status === 'OVERPAID') {
              query = query.lt('outstanding_amt', 0);
            } else if (args.where.status === 'PARTIALLY_PAID') {
              query = query.gt('amount_paid', 0).gt('outstanding_amt', 0);
            } else if (typeof args.where.status === 'object' && args.where.status.not === 'PAID') {
              query = query.gt('outstanding_amt', 0);
            }
          }
          if (args.where.arrears && typeof args.where.arrears === 'object' && args.where.arrears.gt !== undefined) {
            query = query.gt('arrears', args.where.arrears.gt);
          }
          if (args.where.requiredFields) {
            query = applyRequiredFieldsFilter(query, args.where.requiredFields);
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

        return query;
      };

      let matchedSearchIds: string[] | null = null;
      if (args?.where?.search) {
        matchedSearchIds = await resolvePropertySearchIds(String(args.where.search));
        if (matchedSearchIds !== null && matchedSearchIds.length === 0) return [];
      }

      let data: any[] = [];

      if (args?.where?.accountNumber?.in && args.where.accountNumber.in.length > 80) {
        const accChunks = chunkArray(args.where.accountNumber.in as string[], 80);
        const chunkResults = await Promise.all(
          accChunks.map(async (chunk) => {
            let chunkQuery = buildBaseQuery(chunk);
            if (matchedSearchIds !== null) chunkQuery = chunkQuery.in('id', matchedSearchIds);
            const { data: chunkData } = (await chunkQuery) as { data: any[] | null; error: any };
            return chunkData || [];
          })
        );
        data = chunkResults.flat();
      } else if (args?.take !== undefined && args.take <= 1000) {
        let query = buildBaseQuery();
        if (matchedSearchIds !== null) query = query.in('id', matchedSearchIds);
        if (args?.take) query = query.limit(args.take);
        if (args?.skip) query = query.range(args.skip, (args.skip + (args.take || 10)) - 1);
        const { data: resData, error: resError } = (await query) as { data: any[] | null; error: any };


        if (resError) {
          console.error('ADMIN DB PROPERTY QUERY ERROR:', resError);
        }

        data = resData || [];
      } else {
        let offset = args?.skip || 0;
        const targetTotal = args?.take !== undefined ? args.take : Infinity;
        while (data.length < targetTotal) {
          const fetchCount = Math.min(1000, targetTotal - data.length);
          let pageQuery = buildBaseQuery();
          if (matchedSearchIds !== null) pageQuery = pageQuery.in('id', matchedSearchIds);
          pageQuery = pageQuery.range(offset, offset + fetchCount - 1);

          const { data: pageData, error } = (await pageQuery) as { data: any[] | null; error: any };


          if (error) {
            console.error('ADMIN DB PROPERTY PAGED QUERY ERROR:', error);
          }

          if (error || !pageData || pageData.length === 0) break;
          data.push(...pageData);
          if (pageData.length < fetchCount) break;
          offset += pageData.length;
        }
      }

      if (data.length === 0) return [];

      data = data.map(mapPropertyRow);

      // Status is now filtered at DB level inside buildBaseQuery — no JS post-filter needed.
      const propIds = data.map((p: any) => p.id);

      const ownerIds = Array.from(new Set(data.map((p: any) => p.ownerId).filter(Boolean)));
      if (ownerIds.length > 0) {
        const ownerChunks = chunkArray(ownerIds, 80);
        const ownerResults = await Promise.all(
          ownerChunks.map((chunk) =>
            supabase
              .from('PropertyOwner')
              .select('ownerId, name, tel, mobileNumber, email, address, streetAddress, corporationPartnership')
              .in('ownerId', chunk)
          )
        );
        const allOwners = ownerResults.flatMap((r) => r.data || []);
        const ownersById = allOwners.reduce((acc: any, o: any) => {
          acc[o.ownerId] = o;
          return acc;
        }, {});

        for (const prop of data) {
          if (prop.ownerId && ownersById[prop.ownerId]) {
            prop.owner = ownersById[prop.ownerId];
          }
        }
      }

      if (args?.include?.receipts && propIds.length > 0) {
        const propChunks = chunkArray(propIds, 80);
        const receiptResults = await Promise.all(
          propChunks.map((chunk) =>
            supabase
              .from('Receipt')
              .select('id, receiptNumber, amount, datePaid, propertyId, gcrNumber, settlementType')
              .in('propertyId', chunk)
          )
        );
        const allReceipts = receiptResults.flatMap((r) => r.data || []);
        const receiptsByPropId = allReceipts.reduce((acc: any, r: any) => {
          if (!acc[r.propertyId]) acc[r.propertyId] = [];
          acc[r.propertyId].push(r);
          return acc;
        }, {});

        for (const prop of data) {
          prop.receipts = receiptsByPropId[prop.id] || [];
        }
      }

      if (args?.include?.users && propIds.length > 0) {
        const propChunks = chunkArray(propIds, 80);
        const linkResults = await Promise.all(
          propChunks.map((chunk) =>
            supabase
              .from('_PropertyToUser')
              .select('A, B')
              .in('A', chunk)
          )
        );
        const allLinks = linkResults.flatMap((r) => r.data || []);
        const userIds = Array.from(new Set(allLinks.map((l: any) => l.B)));
        let usersById: Record<string, any> = {};

        if (userIds.length > 0) {
          const userChunks = chunkArray(userIds, 80);
          const userResults = await Promise.all(
            userChunks.map((chunk) =>
              supabase
                .from('User')
                .select('id, name, phoneNumber, role, isVerified')
                .in('id', chunk)
            )
          );
          const allUsers = userResults.flatMap((r) => r.data || []);
          usersById = allUsers.reduce((acc: any, u: any) => {
            acc[u.id] = u;
            return acc;
          }, {});
        }

        const propToUsers = allLinks.reduce((acc: any, l: any) => {
          if (!acc[l.A]) acc[l.A] = [];
          if (usersById[l.B]) acc[l.A].push(usersById[l.B]);
          return acc;
        }, {});

        for (const prop of data) {
          prop.users = propToUsers[prop.id] || [];
        }
      }

      return data;
    },

    async findFirst(args?: { where?: any; include?: any }) {
      if (!args?.where) {
        const { data: rawData, error } = await supabase.from('Property').select('*').limit(1).maybeSingle();
        if (error || !rawData) return null;
        return mapPropertyRow(rawData);
      }

      let query = supabase.from('Property').select('*');
      const w = args.where;

      if (w.OR && Array.isArray(w.OR)) {
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
        const { data: owner } = await supabase
          .from('PropertyOwner')
          .select('*')
          .eq('ownerId', data.ownerId)
          .maybeSingle();
        if (owner) data.owner = owner;
      }

      if (args.include?.receipts) {
        const { data: receipts } = await supabase.from('Receipt').select('*').eq('propertyId', data.id);
        data.receipts = receipts || [];
      }

      return data;
    },

    async findUnique(args: { where: { accountNumber?: string; id?: string }; include?: any }) {
      let query = supabase.from('Property').select('*');
      if (args.where.accountNumber) query = query.eq('account_no', args.where.accountNumber);
      if (args.where.id) query = query.eq('id', args.where.id);
      const { data: rawData, error } = await query.maybeSingle();
      if (error || !rawData) return null;

      const data = mapPropertyRow(rawData);

      if (data.ownerId) {
        const { data: owner } = await supabase
          .from('PropertyOwner')
          .select('*')
          .eq('ownerId', data.ownerId)
          .maybeSingle();
        if (owner) data.owner = owner;
      }

      if (args.include?.receipts) {
        const { data: receipts } = await supabase.from('Receipt').select('*').eq('propertyId', data.id);
        data.receipts = receipts || [];
      }

      if (args.include?.users) {
        const { data: links } = await supabase.from('_PropertyToUser').select('B').eq('A', data.id);
        if (links && links.length > 0) {
          const userIds = links.map((l: any) => l.B);
          const { data: users } = await supabase.from('User').select('*').in('id', userIds);
          data.users = users || [];
        } else {
          data.users = [];
        }
      }

      return data;
    },

    async create(args: { data: any }) {
      const { row, users } = preparePropertyWritePayload(args.data);
      const id = row.id || `prop_${Math.random().toString(36).substring(2, 12)}`;
      row.id = id;
      row.createdAt = new Date().toISOString();

      const { data, error } = await supabase.from('Property').insert([row]).select().single();
      if (error) throw new Error(error.message);

      if (users?.connect?.length) {
        for (const u of users.connect) {
          try {
            await supabase.from('_PropertyToUser').insert([{ A: id, B: u.id }]);
          } catch (e) { }
        }
      }
      return mapPropertyRow(data);
    },

    async update(args: { where: { id?: string; accountNumber?: string }; data: any }) {
      const { row, users } = preparePropertyWritePayload(args.data);
      let query = supabase.from('Property').update(row);
      if (args.where.id) query = query.eq('id', args.where.id);
      if (args.where.accountNumber) query = query.eq('account_no', args.where.accountNumber);
      const { data, error } = await query.select().single();
      if (error) throw new Error(error.message);

      if (users?.set?.length && (args.where.id || data?.id)) {
        const propId = args.where.id || data.id;
        try {
          await supabase.from('_PropertyToUser').delete().eq('A', propId);
          for (const u of users.set) {
            await supabase.from('_PropertyToUser').insert([{ A: propId, B: u.id }]);
          }
        } catch (e) { }
      }

      return mapPropertyRow(data);
    },

    async count(args?: { where?: any }) {
      let query = supabase.from('Property').select('*', { count: 'exact', head: true });
      if (args?.where) {
        if (args.where.status && args.where.status !== 'ALL') {
          if (args.where.status === 'UNPAID') {
            query = query.gt('outstanding_amt', 0);
          } else if (args.where.status === 'DEFAULTER') {
            query = query.gt('arrears', 0).gt('outstanding_amt', 0);
          } else if (args.where.status === 'PAID') {
            query = query.eq('outstanding_amt', 0);
          } else if (args.where.status === 'OVERPAID') {
            query = query.lt('outstanding_amt', 0);
          } else if (args.where.status === 'PARTIALLY_PAID') {
            query = query.gt('amount_paid', 0).gt('outstanding_amt', 0);
          } else if (typeof args.where.status === 'object' && args.where.status.not === 'PAID') {
            query = query.gt('outstanding_amt', 0);
          }
        }
        if (args.where.totalAmountDue && typeof args.where.totalAmountDue === 'object' && args.where.totalAmountDue.gt !== undefined) {
          query = query.or('arrears.gt.0,current_bill.gt.0');
        }
        if (args.where.arrears && typeof args.where.arrears === 'object' && args.where.arrears.gt !== undefined) {
          query = query.gt('arrears', args.where.arrears.gt);
        }
        if (args.where.propertyClassification) {
          query = query.eq('property_cat', args.where.propertyClassification);
        }
        if (args.where.accountNumber) {
          if (args.where.accountNumber.in) {
            query = query.in('account_no', args.where.accountNumber.in);
          } else {
            query = query.eq('account_no', args.where.accountNumber);
          }
        }
        if (args.where.municipality) query = query.eq('municipality', args.where.municipality);
        if (args.where.requiredFields) {
          query = applyRequiredFieldsFilter(query, args.where.requiredFields);
        }
        if (args.where.search) {
          const matchedIds = await resolvePropertySearchIds(String(args.where.search));
          if (matchedIds !== null) {
            if (matchedIds.length === 0) return 0;
            query = query.in('id', matchedIds);
          }
        }
      }
      const { count, error } = await query;
      if (error) return 0;
      return count || 0;
    },

    async aggregate(args?: { where?: any; _sum?: any }) {
      let query = supabase.from('Property').select('arrears, current_bill');
      if (args?.where) {
        if (args.where.status && args.where.status !== 'ALL') {
          if (args.where.status === 'UNPAID') {
            query = query.gt('outstanding_amt', 0);
          } else if (args.where.status === 'DEFAULTER') {
            query = query.gt('arrears', 0).gt('outstanding_amt', 0);
          } else if (args.where.status === 'PAID') {
            query = query.eq('outstanding_amt', 0);
          } else if (args.where.status === 'OVERPAID') {
            query = query.lt('outstanding_amt', 0);
          } else if (args.where.status === 'PARTIALLY_PAID') {
            query = query.gt('amount_paid', 0).gt('outstanding_amt', 0);
          } else if (typeof args.where.status === 'object' && args.where.status.not === 'PAID') {
            query = query.gt('outstanding_amt', 0);
          }
        }
        if (args.where.propertyClassification && args.where.propertyClassification !== 'ALL') {
          query = query.eq('property_cat', args.where.propertyClassification);
        }
        if (args.where.municipality && args.where.municipality !== 'ALL') {
          query = query.eq('municipality', args.where.municipality);
        }
        if (args.where.requiredFields) {
          query = applyRequiredFieldsFilter(query, args.where.requiredFields);
        }
        if (args.where.search) {
          const matchedIds = await resolvePropertySearchIds(String(args.where.search));
          if (matchedIds !== null) {
            if (matchedIds.length === 0) return { _sum: { arrears: 0, currentFee: 0, totalAmountDue: 0 } };
            query = query.in('id', matchedIds);
          }
        }
      }

      const { data, error } = await query;
      if (error || !data) return { _sum: { arrears: 0, currentFee: 0, totalAmountDue: 0 } };

      const sum = data.reduce(
        (acc: any, curr: any) => {
          const arr = Number(curr.arrears || 0);
          const currFee = Number(curr.current_bill || 0);
          return {
            arrears: acc.arrears + arr,
            currentFee: acc.currentFee + currFee,
            totalAmountDue: acc.totalAmountDue + arr + currFee,
          };
        },
        { arrears: 0, currentFee: 0, totalAmountDue: 0 }
      );
      return { _sum: sum };
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

    async findUnique(args: { where: { id?: string; receiptNumber?: string } }) {
      let query = supabase.from('Receipt').select('*');
      if (args.where.id) query = query.eq('id', args.where.id);
      if (args.where.receiptNumber) query = query.eq('receiptNumber', args.where.receiptNumber);
      const { data, error } = await query.single();
      if (error || !data) return null;
      return data;
    },

    async update(args: { where: { id: string }; data: any }) {
      const { data, error } = await supabase
        .from('Receipt')
        .update({
          ...args.data,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', args.where.id)
        .select()
        .single();
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

    async aggregate(args?: { where?: any; _sum?: any }) {
      let query = supabase.from('Receipt').select('amount');
      const { data, error } = await query;
      if (error || !data) return { _sum: { amount: 0 } };
      const total = data.reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0);
      return { _sum: { amount: total } };
    },
  },

  notification: {
    async findMany(args?: { where?: any; orderBy?: any; take?: number; skip?: number }) {
      let query = supabase.from('Notification').select('*');
      if (args?.where?.userId) query = query.eq('userId', args.where.userId);
      if (args?.where?.deliveryMethod) query = query.eq('deliveryMethod', args.where.deliveryMethod);
      if (args?.orderBy?.createdAt) {
        query = query.order('createdAt', { ascending: args.orderBy.createdAt === 'asc' });
      } else {
        query = query.order('createdAt', { ascending: false });
      }
      if (args?.take) query = query.limit(args.take);
      if (args?.skip) query = query.range(args.skip, (args.skip + (args.take || 10)) - 1);
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

    async createMany(args: { data: any[] }) {
      const rows = args.data.map((item) => ({
        ...item,
        id: item.id || `notif_${Math.random().toString(36).substring(2, 12)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      const { data, error } = await supabase.from('Notification').insert(rows).select();
      if (error) throw new Error(error.message);
      return { count: data?.length || rows.length };
    },

    async updateMany(args: { where: { userId?: string }; data: any }) {
      let query = supabase.from('Notification').update({ ...args.data, updatedAt: new Date().toISOString() });
      if (args.where.userId) query = query.eq('userId', args.where.userId);
      const { data, error } = await query.select();
      if (error) throw new Error(error.message);
      return { count: data?.length || 0 };
    },
  },

  auditLog: {
    async findMany(args?: { where?: any; orderBy?: any; take?: number; skip?: number }) {
      try {
        let query = supabase.from('AuditLog').select('*');
        if (args?.where?.adminId) query = query.eq('adminId', args.where.adminId);
        if (args?.where?.entityId) query = query.eq('entityId', args.where.entityId);
        if (args?.where?.action) query = query.eq('action', args.where.action);
        if (args?.where?.entityType) query = query.eq('entityType', args.where.entityType);
        if (args?.where?.search) {
          const s = args.where.search;
          query = query.or(`action.ilike.%${s}%,details.ilike.%${s}%,entityType.ilike.%${s}%`);
        }
        if (args?.orderBy?.createdAt) {
          query = query.order('createdAt', { ascending: args.orderBy.createdAt === 'asc' });
        } else {
          query = query.order('createdAt', { ascending: false });
        }
        if (args?.skip !== undefined && args?.take !== undefined) {
          query = query.range(args.skip, args.skip + args.take - 1);
        } else if (args?.take) {
          query = query.limit(args.take);
        }
        const { data, error } = await query;
        if (error || !data) return [];
        return data;
      } catch (e) {
        return [];
      }
    },

    async count(args?: { where?: any }) {
      try {
        let query = supabase.from('AuditLog').select('*', { count: 'exact', head: true });
        if (args?.where?.adminId) query = query.eq('adminId', args.where.adminId);
        if (args?.where?.entityId) query = query.eq('entityId', args.where.entityId);
        if (args?.where?.action) query = query.eq('action', args.where.action);
        if (args?.where?.entityType) query = query.eq('entityType', args.where.entityType);
        if (args?.where?.search) {
          const s = args.where.search;
          query = query.or(`action.ilike.%${s}%,details.ilike.%${s}%,entityType.ilike.%${s}%`);
        }
        const { count, error } = await query;
        if (error) return 0;
        return count || 0;
      } catch (e) {
        return 0;
      }
    },

    async create(args: { data: any }) {
      const id = args.data.id || `log_${Math.random().toString(36).substring(2, 12)}`;
      const row = {
        ...args.data,
        id,
        createdAt: new Date().toISOString(),
      };
      try {
        const { data, error } = await supabase.from('AuditLog').insert([row]).select().single();
        if (error) return row;
        return data;
      } catch (e) {
        return row;
      }
    },
  },

  session: {
    async findFirst(args: { where: { userId?: string } }) {
      try {
        let query = supabase.from('Session').select('*');
        if (args.where?.userId) query = query.eq('userId', args.where.userId);
        const { data, error } = await query.order('createdAt', { ascending: false }).limit(1).maybeSingle();
        if (error || !data) return null;
        return data;
      } catch (e) {
        return null;
      }
    },
    async create(args: { data: any }) {
      const id = args.data.id || `sess_${Math.random().toString(36).substring(2, 12)}`;
      const row = {
        ...args.data,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      try {
        const { data, error } = await supabase.from('Session').insert([row]).select().single();
        if (error) return row;
        return data;
      } catch (e) {
        return row;
      }
    },
  },

  systemSetting: {
    async findUnique(args: { where: { key: string } }) {
      try {
        const { data, error } = await supabase
          .from('SystemSetting')
          .select('*')
          .eq('key', args.where.key)
          .maybeSingle();
        if (error || !data) return null;
        return data;
      } catch {
        return null;
      }
    },
    async findMany() {
      try {
        const { data, error } = await supabase
          .from('SystemSetting')
          .select('*');
        if (error || !data) return [];
        return data;
      } catch {
        return [];
      }
    },
    async upsert(args: { where: { key: string }; update: { value: string }; create: { key: string; value: string } }) {
      const row = {
        key: args.where.key,
        value: args.update?.value ?? args.create?.value,
        updatedAt: new Date().toISOString(),
      };
      try {
        const { data, error } = await supabase
          .from('SystemSetting')
          .upsert(row)
          .select()
          .single();
        if (error) return row;
        return data;
      } catch {
        return row;
      }
    },
  },

  smsRolloutJob: {
    async create(args: { data: any }) {
      const id = args.data.id || `job_${Math.random().toString(36).substring(2, 12)}`;
      const row = {
        ...args.data,
        id,
        status: args.data.status || 'QUEUED',
        totalCount: args.data.totalCount || 0,
        sentCount: args.data.sentCount || 0,
        failedCount: args.data.failedCount || 0,
        accountNumbers: args.data.accountNumbers || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      try {
        const { data, error } = await supabase.from('SmsRolloutJob').insert([row]).select().single();
        if (error) {
          console.error('[adminDb.smsRolloutJob.create] error:', error);
          return row;
        }
        return data;
      } catch (e) {
        console.error('[adminDb.smsRolloutJob.create] exception:', e);
        return row;
      }
    },
    async update(args: { where: { id: string }; data: any }) {
      const row = {
        ...args.data,
        updatedAt: new Date().toISOString(),
      };
      try {
        const { data, error } = await supabase
          .from('SmsRolloutJob')
          .update(row)
          .eq('id', args.where.id)
          .select()
          .single();
        if (error) {
          console.error('[adminDb.smsRolloutJob.update] error:', error);
          return null;
        }
        return data;
      } catch (e) {
        console.error('[adminDb.smsRolloutJob.update] exception:', e);
        return null;
      }
    },
    async findUnique(args: { where: { id: string }; select?: any }) {
      try {
        const { data, error } = await supabase
          .from('SmsRolloutJob')
          .select('*')
          .eq('id', args.where.id)
          .maybeSingle();
        if (error || !data) return null;
        return data;
      } catch (e) {
        return null;
      }
    },
  },

  accessGrant: {
    async findUnique(args: { where: { token?: string; id?: string } }) {
      try {
        let query = supabase.from('AccessGrant').select('*');
        if (args.where.token) query = query.eq('token', args.where.token);
        if (args.where.id) query = query.eq('id', args.where.id);
        const { data, error } = await query.maybeSingle();
        if (error || !data) return null;
        return data;
      } catch (e) {
        return null;
      }
    },

    async create(args: { data: any }) {
      try {
        const row = {
          ...args.data,
          createdAt: new Date().toISOString(),
        };
        const { data, error } = await supabase.from('AccessGrant').insert([row]).select().single();
        if (error) {
          console.error('[adminDb.accessGrant.create] error:', error);
          return null;
        }
        return data;
      } catch (e) {
        console.error('[adminDb.accessGrant.create] exception:', e);
        return null;
      }
    },

    async update(args: { where: { id?: string; token?: string }; data: any }) {
      try {
        let query = supabase.from('AccessGrant').update(args.data);
        if (args.where.id) query = query.eq('id', args.where.id);
        if (args.where.token) query = query.eq('token', args.where.token);
        const { data, error } = await query.select().single();
        if (error) return null;
        return data;
      } catch (e) {
        return null;
      }
    },
  },

  async $transaction(promisesOrFn: any) {
    if (typeof promisesOrFn === 'function') {
      return await promisesOrFn(adminDb);
    }
    if (Array.isArray(promisesOrFn)) {
      return await Promise.all(promisesOrFn);
    }
    return promisesOrFn;
  },
};