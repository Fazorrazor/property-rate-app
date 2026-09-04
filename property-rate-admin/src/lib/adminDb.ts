import { supabase } from './supabase';

/**
 * Enterprise Admin DB Client
 * Provides complete administrative access to municipal back-office tables, master cadastre,
 * audit trails, value books, GCR pools, staff mobilizations, and SMS campaign rollouts.
 */
// Helper to resolve multi-entity, multi-token property search
async function resolvePropertySearchIds(searchStr: string): Promise<string[] | null> {
  const q = searchStr.trim();
  if (!q) return null;

  const tokens = q.split(/\s+/).filter(Boolean);
  let finalMatchingPropIds: Set<string> | null = null;

  for (const token of tokens) {
    const [matchedUsersRes, matchedOwnersRes, matchedReceiptsRes, matchedPropsRes] = await Promise.all([
      supabase.from('User').select('id').or(`name.ilike.%${token}%,phoneNumber.ilike.%${token}%`).limit(5000),
      supabase.from('PropertyOwner').select('ownerId').or(`name.ilike.%${token}%,tel.ilike.%${token}%,mobileNumber.ilike.%${token}%,address.ilike.%${token}%,streetAddress.ilike.%${token}%,corporationPartnership.ilike.%${token}%,email.ilike.%${token}%`).limit(5000),
      supabase.from('Receipt').select('propertyId').or(`receiptNumber.ilike.%${token}%,paymentPhoneNumber.ilike.%${token}%`).limit(5000),
      supabase.from('Property').select('id').or(`accountNumber.ilike.%${token}%,valuationNo.ilike.%${token}%,ownerDigitalAddress.ilike.%${token}%,physicalAddress.ilike.%${token}%,houseNo.ilike.%${token}%,plotNo.ilike.%${token}%,propertyClassification.ilike.%${token}%,municipality.ilike.%${token}%`).limit(5000)
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

// Helper to resolve multi-entity, multi-token ratepayer user search
async function resolveUserSearchIds(searchStr: string): Promise<string[] | null> {
  const q = searchStr.trim();
  if (!q) return null;

  const tokens = q.split(/\s+/).filter(Boolean);
  let finalMatchingUserIds: Set<string> | null = null;

  for (const token of tokens) {
    const [matchedUsersRes, matchedPropsRes] = await Promise.all([
      supabase.from('User').select('id').or(`name.ilike.%${token}%,phoneNumber.ilike.%${token}%`).limit(5000),
      supabase.from('Property').select('id').or(`accountNumber.ilike.%${token}%,valuationNo.ilike.%${token}%,ownerDigitalAddress.ilike.%${token}%,physicalAddress.ilike.%${token}%`).limit(5000)
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

export const adminDb = {
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

        if (propQueries.length > 0) {
          const propRes = await Promise.all(propQueries);
          const allProps = propRes.flatMap((r) => r.data || []);
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

      // 1. Dual-source Batch fetch linked properties (via _PropertyToUser & PropertyOwner telephone match with safe batch chunking)
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
            supabase.from('Property').select('id, accountNumber, ownerId, ownerDigitalAddress, propertyClassification, rateableValue, arrears, currentFee, totalAmountDue, status').in('id', chunk)
          ),
          ...ownerPropChunks.map((chunk) =>
            supabase.from('Property').select('id, accountNumber, ownerId, ownerDigitalAddress, propertyClassification, rateableValue, arrears, currentFee, totalAmountDue, status').in('ownerId', chunk)
          ),
        ];

        const propResults = await Promise.all(propQueries);
        const allProps = propResults.flatMap((r) => r.data || []);

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

          u.properties = Array.from(userPropMap.values());
        }
      }

      // 2. Batch fetch receipts for all users in a single query
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

      // 3. Batch fetch notifications for all users in a single query
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
      let query = supabase.from('Property').select('id, accountNumber, valuationNo, ownerId, ownerDigitalAddress, propertyClassification, billYear, rateableValue, rateImposed, previousYearBill, amountPaidLastYear, arrears, currentFee, totalAmountDue, status, billDate, settlementDeadline, municipality');

      if (args?.where) {
        if (args.where.status) {
          if (typeof args.where.status === 'object' && args.where.status.not) {
            query = query.neq('status', args.where.status.not);
          } else {
            query = query.eq('status', args.where.status);
          }
        }
        if (args.where.totalAmountDue) {
          if (typeof args.where.totalAmountDue === 'object' && args.where.totalAmountDue.gt !== undefined) {
            query = query.gt('totalAmountDue', args.where.totalAmountDue.gt);
          }
        }
        if (args.where.arrears) {
          if (typeof args.where.arrears === 'object' && args.where.arrears.gt !== undefined) {
            query = query.gt('arrears', args.where.arrears.gt);
          }
        }
        if (args.where.propertyClassification) {
          query = query.eq('propertyClassification', args.where.propertyClassification);
        }
        if (args.where.accountNumber) {
          if (args.where.accountNumber.in) {
            query = query.in('accountNumber', args.where.accountNumber.in);
          } else {
            query = query.eq('accountNumber', args.where.accountNumber);
          }
        }
        if (args.where.ownerDigitalAddress) query = query.eq('ownerDigitalAddress', args.where.ownerDigitalAddress);
        if (args.where.municipality) query = query.eq('municipality', args.where.municipality);
        if (args.where.search) {
          const matchedIds = await resolvePropertySearchIds(String(args.where.search));
          if (matchedIds !== null) {
            if (matchedIds.length === 0) return [];
            query = query.in('id', matchedIds);
          }
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

      const propIds = data.map((p: any) => p.id);

      // 1. Batch fetch PropertyOwner for all properties in a single query
      const ownerIds = Array.from(new Set(data.map((p: any) => p.ownerId).filter(Boolean)));
      if (ownerIds.length > 0) {
        const { data: allOwners } = await supabase
          .from('PropertyOwner')
          .select('ownerId, name, tel, mobileNumber, email, address, streetAddress, corporationPartnership')
          .in('ownerId', ownerIds);
        
        const ownersById = (allOwners || []).reduce((acc: any, o: any) => {
          acc[o.ownerId] = o;
          return acc;
        }, {});

        for (const prop of data) {
          if (prop.ownerId && ownersById[prop.ownerId]) {
            prop.owner = ownersById[prop.ownerId];
          }
        }
      }

      // 2. Batch fetch receipts for all properties in a single query
      if (args?.include?.receipts) {
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

      // 3. Batch fetch linked users for all properties in a single query
      if (args?.include?.users) {
        const { data: allLinks } = await supabase
          .from('_PropertyToUser')
          .select('A, B')
          .in('A', propIds);
        
        const userIds = Array.from(new Set((allLinks || []).map((l: any) => l.B)));
        let usersById: Record<string, any> = {};

        if (userIds.length > 0) {
          const { data: allUsers } = await supabase
            .from('User')
            .select('id, name, phoneNumber, role, isVerified')
            .in('id', userIds);
          
          usersById = (allUsers || []).reduce((acc: any, u: any) => {
            acc[u.id] = u;
            return acc;
          }, {});
        }

        const propToUsers = (allLinks || []).reduce((acc: any, l: any) => {
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

    async findUnique(args: { where: { accountNumber?: string; id?: string }; include?: any }) {
      let query = supabase.from('Property').select('*');
      if (args.where.accountNumber) query = query.eq('accountNumber', args.where.accountNumber);
      if (args.where.id) query = query.eq('id', args.where.id);
      const { data, error } = await query.maybeSingle();
      if (error || !data) return null;

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
      const { users, receipts, bills, ...cleanData } = args.data;
      const id = cleanData.id || `prop_${Math.random().toString(36).substring(2, 12)}`;
      const row = {
        ...cleanData,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('Property').insert([row]).select().single();
      if (error) throw new Error(error.message);

      if (users?.connect?.length) {
        for (const u of users.connect) {
          try {
            await supabase.from('_PropertyToUser').insert([{ A: id, B: u.id }]);
          } catch (e) {
            // non-fatal relation link
          }
        }
      }
      return data;
    },

    async update(args: { where: { id?: string; accountNumber?: string }; data: any }) {
      const { users, receipts, bills, ...cleanData } = args.data;
      let query = supabase.from('Property').update({ ...cleanData, updatedAt: new Date().toISOString() });
      if (args.where.id) query = query.eq('id', args.where.id);
      if (args.where.accountNumber) query = query.eq('accountNumber', args.where.accountNumber);
      const { data, error } = await query.select().single();
      if (error) throw new Error(error.message);

      if (users?.set?.length && (args.where.id || data?.id)) {
        const propId = args.where.id || data.id;
        try {
          await supabase.from('_PropertyToUser').delete().eq('A', propId);
          for (const u of users.set) {
            await supabase.from('_PropertyToUser').insert([{ A: propId, B: u.id }]);
          }
        } catch (e) {
          // non-fatal
        }
      }

      return data;
    },

    async count(args?: { where?: any }) {
      let query = supabase.from('Property').select('*', { count: 'exact', head: true });
      if (args?.where) {
        if (args.where.status) {
          if (typeof args.where.status === 'object' && args.where.status.not) {
            query = query.neq('status', args.where.status.not);
          } else {
            query = query.eq('status', args.where.status);
          }
        }
        if (args.where.totalAmountDue) {
          if (typeof args.where.totalAmountDue === 'object' && args.where.totalAmountDue.gt !== undefined) {
            query = query.gt('totalAmountDue', args.where.totalAmountDue.gt);
          }
        }
        if (args.where.arrears) {
          if (typeof args.where.arrears === 'object' && args.where.arrears.gt !== undefined) {
            query = query.gt('arrears', args.where.arrears.gt);
          }
        }
        if (args.where.propertyClassification) {
          query = query.eq('propertyClassification', args.where.propertyClassification);
        }
        if (args.where.municipality) query = query.eq('municipality', args.where.municipality);
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
      let query = supabase.from('Property').select('arrears, currentFee, totalAmountDue');
      if (args?.where) {
        if (args.where.status) {
          if (typeof args.where.status === 'object' && args.where.status.not) {
            query = query.neq('status', args.where.status.not);
          } else {
            query = query.eq('status', args.where.status);
          }
        }
        if (args.where.municipality) query = query.eq('municipality', args.where.municipality);
      }

      const { data, error } = await query;
      if (error || !data) return { _sum: { arrears: 0, currentFee: 0, totalAmountDue: 0 } };
      
      const sum = data.reduce(
        (acc: any, curr: any) => ({
          arrears: acc.arrears + (curr.arrears || 0),
          currentFee: acc.currentFee + (curr.currentFee || 0),
          totalAmountDue: acc.totalAmountDue + (curr.totalAmountDue || 0),
        }),
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
