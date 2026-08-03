const formatUnit = (value: number, maximumFractionDigits = 2) =>
  new Intl.NumberFormat("en-PK", { maximumFractionDigits }).format(value);

export const formatPKR = (value: number) => {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (absolute >= 10_000_000) {
    const crore = absolute / 10_000_000;
    return `${sign}Rs ${formatUnit(crore, crore >= 10 ? 0 : 2)} Crore`;
  }
  if (absolute >= 100_000) return `${sign}Rs ${formatUnit(absolute / 100_000)} Lakh`;
  return `${sign}Rs ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(absolute)}`;
};

const parseLocalDate = (value: string) =>
  new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+05:00` : value);

export const formatDate = (value: string, withTime = false) =>
  new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(parseLocalDate(value));

export const todayISO = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const startOfMonthMonthsAgoISO = (monthsAgo: number) => {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - monthsAgo);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
};

export const formatPakistanPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const localDigits = digits.startsWith("92") ? digits.slice(2) : digits.startsWith("0") ? digits.slice(1) : digits;
  if (localDigits.length !== 10) return value.trim();
  return `+92 ${localDigits.slice(0, 3)} ${localDigits.slice(3)}`;
};

export const isPakistanPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return (digits.startsWith("92") && digits.length === 12) ||
    (digits.startsWith("0") && digits.length === 11);
};
