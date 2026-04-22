import {
  validateCzPhone,
  validateDic,
  validateEmail,
  validateIco,
} from "@/lib/iml-validation";
import type {
  CustomerFormErrors,
  CustomerFormState,
} from "./CustomerFormSections";

/**
 * Klientská validace formuláře zákazníka. Vrací mapu chyb (pokud je objekt prázdný,
 * formulář je validní). Používá stejné validátory jako server (lib/iml-validation),
 * takže UX zpětná vazba a serverová odpověď se shodují.
 */
export function validateCustomerForm(form: CustomerFormState): CustomerFormErrors {
  const errors: CustomerFormErrors = {};

  if (!form.name.trim()) {
    errors.name = "Vyplňte název zákazníka";
  }

  const emailV = validateEmail(form.email);
  if (!emailV.ok) errors.email = emailV.error;

  const phoneV = validateCzPhone(form.phone);
  if (!phoneV.ok) errors.phone = phoneV.error;

  const icoV = validateIco(form.ico);
  if (!icoV.ok) errors.ico = icoV.error;

  const dicV = validateDic(form.dic);
  if (!dicV.ok) errors.dic = dicV.error;

  return errors;
}

/**
 * Validace jednoho konkrétního pole (pro on-blur handler).
 */
export function validateCustomerField(
  field: keyof CustomerFormState,
  form: CustomerFormState
): string | undefined {
  switch (field) {
    case "name":
      return form.name.trim() ? undefined : "Vyplňte název zákazníka";
    case "email": {
      const r = validateEmail(form.email);
      return r.ok ? undefined : r.error;
    }
    case "phone": {
      const r = validateCzPhone(form.phone);
      return r.ok ? undefined : r.error;
    }
    case "ico": {
      const r = validateIco(form.ico);
      return r.ok ? undefined : r.error;
    }
    case "dic": {
      const r = validateDic(form.dic);
      return r.ok ? undefined : r.error;
    }
    default:
      return undefined;
  }
}
