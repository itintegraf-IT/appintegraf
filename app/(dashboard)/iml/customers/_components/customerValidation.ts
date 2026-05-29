import {
  validateEmail,
  validateInternationalPhone,
  validateTaxIds,
} from "@/lib/iml-validation";
import { normalizeTaxCountry } from "@/lib/iml-customer-units";
import { vatPrefixToPhoneCountry } from "@/lib/iml-eu-tax";
import type {
  CustomerFormErrors,
  CustomerFormState,
} from "./CustomerFormSections";

function taxCountryForForm(form: CustomerFormState): string | null {
  const c = form.tax_country === "OTHER" ? null : normalizeTaxCountry(form.tax_country);
  return c ?? (form.tax_country === "OTHER" ? null : "CZ");
}

/** Validace formuláře pobočky (stejná pravidla jako zákazník, jiný text u názvu). */
export function validateBranchForm(form: CustomerFormState): CustomerFormErrors {
  const errors = validateCustomerForm(form);
  if (!form.name.trim()) {
    errors.name = "Vyplňte název pobočky";
  }
  return errors;
}

export function validateCustomerForm(form: CustomerFormState): CustomerFormErrors {
  const errors: CustomerFormErrors = {};
  const taxCountry = taxCountryForForm(form);

  if (!form.name.trim()) {
    errors.name = "Vyplňte název zákazníka";
  }

  const emailV = validateEmail(form.email);
  if (!emailV.ok) errors.email = emailV.error;

  const phoneV = validateInternationalPhone(
    form.phone,
    vatPrefixToPhoneCountry(taxCountry)
  );
  if (!phoneV.ok) errors.phone = phoneV.error;

  const { ico: icoV, dic: dicV } = validateTaxIds(taxCountry, form.ico, form.dic);
  if (!icoV.ok) errors.ico = icoV.error;
  if (!dicV.ok) errors.dic = dicV.error;

  if (form.billing_email.trim()) {
    const billingV = validateEmail(form.billing_email);
    if (!billingV.ok) errors.billing_email = billingV.error;
  }

  return errors;
}

export function validateCustomerField(
  field: keyof CustomerFormState,
  form: CustomerFormState
): string | undefined {
  const taxCountry = taxCountryForForm(form);

  switch (field) {
    case "name":
      return form.name.trim() ? undefined : "Vyplňte název zákazníka";
    case "email": {
      const r = validateEmail(form.email);
      return r.ok ? undefined : r.error;
    }
    case "phone": {
      const r = validateInternationalPhone(form.phone, vatPrefixToPhoneCountry(taxCountry));
      return r.ok ? undefined : r.error;
    }
    case "ico": {
      const r = validateTaxIds(taxCountry, form.ico, null).ico;
      return r.ok ? undefined : r.error;
    }
    case "dic": {
      const r = validateTaxIds(taxCountry, null, form.dic).dic;
      return r.ok ? undefined : r.error;
    }
    case "billing_email": {
      if (!form.billing_email.trim()) return undefined;
      const r = validateEmail(form.billing_email);
      return r.ok ? undefined : r.error;
    }
    default:
      return undefined;
  }
}
