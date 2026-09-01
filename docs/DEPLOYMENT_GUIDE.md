# Vercel Deployment & Production Setup Guide

This guide walks you through deploying both the **Ratepayer Portal** and the **Municipal Admin Portal** to Vercel using a single repository with PostgreSQL database and continuous deployment.

---

## 1. Database Provisioning (PostgreSQL)

Vercel functions run in a serverless environment. For persistent production storage, provision a managed PostgreSQL database:
- **Recommended Free Options:** [Neon Postgres](https://neon.tech), [Supabase](https://supabase.com), or [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres).
- Obtain your connection string:
  ```env
  DATABASE_URL="postgresql://<user>:<password>@<host>/<dbname>?sslmode=require"
  ```
- Run migrations against your production database:
  ```bash
  npx prisma db push
  ```

---

## 2. Deploying to Vercel

Because this repository contains two interconnected Next.js apps, create **two projects** on Vercel:

### Project 1: Ratepayer Portal (Main App)
1. In your [Vercel Dashboard](https://vercel.com/new), import the `Fazorrazor/property-rate-app` repository.
2. **Project Name:** `property-rate-app` (or custom name).
3. **Framework Preset:** `Next.js`.
4. **Root Directory:** `./` (Default).
5. **Build Command:** `npm run build` (or leave default, `postinstall` runs `prisma generate`).
6. **Environment Variables:**
   - `DATABASE_URL`: Your PostgreSQL connection string.
   - `PAYSTACK_PUBLIC_KEY`: Live or Test Paystack Public Key.
   - `PAYSTACK_SECRET_KEY`: Live or Test Paystack Secret Key.
   - `NEXT_PUBLIC_APP_URL`: Your Vercel domain (e.g. `https://property-rate-app.vercel.app`).
   - `NEXT_PUBLIC_ADMIN_URL`: Admin portal domain.

---

### Project 2: Municipal Admin Portal
1. In Vercel, click **Add New Project** and select the same `Fazorrazor/property-rate-app` repository.
2. **Project Name:** `property-rate-admin`.
3. **Framework Preset:** `Next.js`.
4. **Root Directory:** `property-rate-admin`.
5. Under **Root Directory Settings**, ensure **"Include source files outside of the Root Directory"** is enabled.
6. **Build Command:** `npm run build` (or `cd .. && npx prisma generate && cd property-rate-admin && next build`).
7. **Environment Variables:**
   - `DATABASE_URL`: The same PostgreSQL connection string.
   - `NEXT_PUBLIC_APP_URL`: Ratepayer app URL.

---

## 3. GitHub Actions CI/CD

Automated CI/CD is active via [`.github/workflows/ci-cd.yml`](file:///c:/Users/PC/OneDrive/Documents/DOCS/coding/PROJECTS/SYSTEMS/property-rate-app/.github/workflows/ci-cd.yml).

Every `push` or `pull_request` to `master` / `main` triggers:
- Dependency installation
- Prisma Client code generation
- TypeScript strict typecheck across both apps
- Production build validation for both apps

When connected to Vercel with GitHub integration:
- Pull requests automatically receive live **Preview Deployments**.
- Merging to `master`/`main` automatically triggers **Production Deployments**.
