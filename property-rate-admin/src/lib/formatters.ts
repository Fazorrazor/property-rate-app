const ghcNumberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatGhc = (val: number | string | null | undefined): string =>
  `GH₵ ${ghcNumberFormatter.format(Number(val || 0))}`;

const gbDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export const formatDateGb = (d: string | Date | null | undefined): string =>
  gbDateFormatter.format(d ? new Date(d) : new Date());

export const formatDateSlash = (d: string | Date | null | undefined): string => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
};
