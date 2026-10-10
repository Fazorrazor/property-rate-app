export const formatGhc = (val: number | string | null | undefined): string =>
  `GH₵ ${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatDateGb = (d: string | Date | null | undefined): string =>
  new Date(d || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
