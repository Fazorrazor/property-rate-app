import { supabase } from './supabase';

export const supabaseDb = {
  user: {
    async findUnique(args: { where: { phoneNumber?: string; id?: string }; include?: any }) {
      let query = supabase.from('User').select('*');
      if (args.where.phoneNumber) query = query.eq('phoneNumber', args.where.phoneNumber);
      if (args.where.id) query = query.eq('id', args.where.id);
      const { data, error } = await query.maybeSingle();
      if (error || !data) return null;

      if (args.include?.properties) {
        data.properties = await supabaseDb.property.findMany({ where: { users: { some: { id: data.id } } } });
      }
      return data;
    },

    async findFirst(args?: { include?: any }) {
      const { data, error } = await supabase.from('User').select('*').limit(1).maybeSingle();
      if (error || !data) return null;
      if (args?.include?.properties) {
        data.properties = await supabaseDb.property.findMany({ where: { users: { some: { id: data.id } } } });
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
      const existing = await supabaseDb.user.findUnique({ where: { phoneNumber: args.where.phoneNumber } });
      if (existing) {
        return supabaseDb.user.update({ where: { id: existing.id }, data: args.update });
      }
      return supabaseDb.user.create({ data: args.create });
    },
  },

  session: {
    async findUnique(args: { where: { token: string }; include?: any }) {
      const { data: session, error } = await supabase.from('Session').select('*').eq('token', args.where.token).maybeSingle();
      if (error || !session) return null;

      if (args.include?.user) {
        session.user = await supabaseDb.user.findUnique({
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
        if (args.where.status) query = query.eq('status', args.where.status);
        if (args.where.accountNumber) query = query.eq('accountNumber', args.where.accountNumber);
        if (args.where.ownerDigitalAddress) query = query.eq('ownerDigitalAddress', args.where.ownerDigitalAddress);
        
        // Handle relation link through _PropertyToUser
        if (args.where.users?.some?.id) {
          const userId = args.where.users.some.id;
          const { data: links } = await supabase.from('_PropertyToUser').select('A').eq('B', userId);
          const propIds = (links || []).map((l: any) => l.A);
          if (propIds.length === 0) return [];
          query = query.in('id', propIds);
        }
      }

      if (args?.orderBy) {
        const field = Object.keys(args.orderBy)[0];
        const dir = args.orderBy[field] === 'desc' ? { ascending: false } : { ascending: true };
        query = query.order(field, dir);
      }

      if (args?.take) query = query.limit(args.take);
      if (args?.skip) query = query.range(args.skip, (args.skip + (args.take || 10)) - 1);

      const { data, error } = await query;
      if (error || !data) return [];

      // Include receipts if requested
      if (args?.include?.receipts) {
        for (const prop of data) {
          const { data: receipts } = await supabase.from('Receipt').select('*').eq('propertyId', prop.id);
          prop.receipts = receipts || [];
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
      return data;
    },

    async update(args: { where: { id?: string; accountNumber?: string }; data: any }) {
      let query = supabase.from('Property').update({ ...args.data, updatedAt: new Date().toISOString() });
      if (args.where.id) query = query.eq('id', args.where.id);
      if (args.where.accountNumber) query = query.eq('accountNumber', args.where.accountNumber);
      const { data, error } = await query.select().single();
      if (error) throw new Error(error.message);
      return data;
    },

    async count(args?: { where?: any }) {
      let query = supabase.from('Property').select('*', { count: 'exact', head: true });
      if (args?.where?.status) query = query.eq('status', args.where.status);
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
};
