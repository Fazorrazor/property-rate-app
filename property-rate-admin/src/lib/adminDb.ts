import { supabase } from './supabase';

/**
 * Enterprise Admin DB Client
 * Provides complete administrative access to municipal back-office tables, master cadastre,
 * audit trails, value books, GCR pools, staff mobilizations, and SMS campaign rollouts.
 */
export const adminDb = {
  user: {
    async findUnique(args: { where: { phoneNumber?: string; id?: string }; include?: any }) {
      let query = supabase.from('User').select('*');
      if (args.where.phoneNumber) query = query.eq('phoneNumber', args.where.phoneNumber);
      if (args.where.id) query = query.eq('id', args.where.id);
      const { data, error } = await query.maybeSingle();
      if (error || !data) return null;

      if (args.include?.properties) {
        const { data: links } = await supabase.from('_PropertyToUser').select('A').eq('B', data.id);
        const propIds = (links || []).map((l: any) => l.A);
        if (propIds.length > 0) {
          const { data: props } = await supabase.from('Property').select('*').in('id', propIds);
          data.properties = props || [];
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
      let query = supabase.from('User').select('*');
      if (args?.where?.role) query = query.eq('role', args.where.role);
      
      if (args?.orderBy) {
        const field = Object.keys(args.orderBy)[0];
        const dir = args.orderBy[field] === 'desc' ? { ascending: false } : { ascending: true };
        query = query.order(field, dir);
      }

      if (args?.take) query = query.limit(args.take);
      if (args?.skip) query = query.range(args.skip, (args.skip + (args.take || 10)) - 1);

      const { data, error } = await query;
      if (error || !data || data.length === 0) return data || [];

      const userIds = data.map((u: any) => u.id);

      // 1. Batch fetch linked properties for all users in a single query
      if (args?.include?.properties) {
        const { data: allLinks } = await supabase
          .from('_PropertyToUser')
          .select('A, B')
          .in('B', userIds);
        
        const propIds = Array.from(new Set((allLinks || []).map((l: any) => l.A)));
        let propsById: Record<string, any> = {};

        if (propIds.length > 0) {
          const { data: allProps } = await supabase
            .from('Property')
            .select('id, accountNumber, ownerDigitalAddress, propertyClassification, rateableValue, arrears, currentFee, totalAmountDue, status')
            .in('id', propIds);
          
          propsById = (allProps || []).reduce((acc: any, p: any) => {
            acc[p.id] = p;
            return acc;
          }, {});
        }

        const userToProps = (allLinks || []).reduce((acc: any, l: any) => {
          if (!acc[l.B]) acc[l.B] = [];
          if (propsById[l.A]) acc[l.B].push(propsById[l.A]);
          return acc;
        }, {});

        for (const u of data) {
          u.properties = userToProps[u.id] || [];
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
      const { count, error } = await query;
      if (error) return 0;
      return count || 0;
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
  },

  property: {
    async findMany(args?: { where?: any; include?: any; orderBy?: any; take?: number; skip?: number }) {
      let query = supabase.from('Property').select('*');

      if (args?.where) {
        if (args.where.status) query = query.eq('status', args.where.status);
        if (args.where.accountNumber) {
          if (args.where.accountNumber.in) {
            query = query.in('accountNumber', args.where.accountNumber.in);
          } else {
            query = query.eq('accountNumber', args.where.accountNumber);
          }
        }
        if (args.where.ownerDigitalAddress) query = query.eq('ownerDigitalAddress', args.where.ownerDigitalAddress);
        if (args.where.municipality) query = query.eq('municipality', args.where.municipality);
      }

      if (args?.orderBy) {
        const field = Object.keys(args.orderBy)[0];
        const dir = args.orderBy[field] === 'desc' ? { ascending: false } : { ascending: true };
        query = query.order(field, dir);
      }

      if (args?.take) query = query.limit(args.take);
      if (args?.skip) query = query.range(args.skip, (args.skip + (args.take || 10)) - 1);

      const { data, error } = await query;
      if (error || !data || data.length === 0) return data || [];

      const propIds = data.map((p: any) => p.id);

      // 1. Batch fetch receipts for all properties in a single query
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

      // 2. Batch fetch linked users for all properties in a single query
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
      if (args?.where?.status) query = query.eq('status', args.where.status);
      if (args?.where?.municipality) query = query.eq('municipality', args.where.municipality);
      const { count, error } = await query;
      if (error) return 0;
      return count || 0;
    },

    async aggregate(args?: { where?: any; _sum?: any }) {
      let query = supabase.from('Property').select('arrears, currentFee, totalAmountDue');
      if (args?.where?.status) query = query.eq('status', args.where.status);
      if (args?.where?.municipality) query = query.eq('municipality', args.where.municipality);
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
    async findMany(args?: { where?: any; orderBy?: any; take?: number }) {
      try {
        let query = supabase.from('AuditLog').select('*');
        if (args?.where?.adminId) query = query.eq('adminId', args.where.adminId);
        if (args?.where?.entityId) query = query.eq('entityId', args.where.entityId);
        if (args?.orderBy?.createdAt) {
          query = query.order('createdAt', { ascending: args.orderBy.createdAt === 'asc' });
        } else {
          query = query.order('createdAt', { ascending: false });
        }
        if (args?.take) query = query.limit(args.take);
        const { data, error } = await query;
        if (error || !data) return [];
        return data;
      } catch (e) {
        return [];
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
