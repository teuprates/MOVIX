/** Validações e máscaras brasileiras (CPF, CNPJ, telefone, CEP, placa, CNH). */
export const onlyDigits = (v: string) => v.replace(/\D/g, "");

export function isValidCpf(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

export function isValidCnpj(value: string) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + Number(cnpj[i]) * w, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}

/** CNH: apenas formato (11 dígitos). Não há verificação de autenticidade no MVP. */
export function isValidCnh(value: string) {
  const cnh = onlyDigits(value);
  return /^\d{11}$/.test(cnh) && !/^(\d)\1{10}$/.test(cnh);
}

export const normalizePlate = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");
/** Placa antiga (ABC1234) ou Mercosul (ABC1D23). */
export const isValidPlate = (v: string) => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(normalizePlate(v));

export function maskCpf(v: string) {
  return onlyDigits(v).slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function maskCnpj(v: string) {
  return onlyDigits(v).slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export const maskDocument = (v: string) => (onlyDigits(v).length > 11 ? maskCnpj(v) : maskCpf(v));

export function maskPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

export const maskCep = (v: string) => onlyDigits(v).slice(0, 8).replace(/(\d{5})(\d{1,3})$/, "$1-$2");

export function maskPlate(v: string) {
  const p = normalizePlate(v).slice(0, 7);
  return p.length > 3 ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
}

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ",
  "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;
