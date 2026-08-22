
export function formatCryptoStat(value: number | string, isCurrency = true) {
  if (value === undefined || value === null) return '—';
  
  const numericValue = typeof value === 'string' 
    ? parseFloat(value.replace(/[^0-9.]/g, '')) 
    : value;

  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 2,
    ...(isCurrency && { style: 'currency', currency: 'USD' })
  }).format(numericValue);
}
