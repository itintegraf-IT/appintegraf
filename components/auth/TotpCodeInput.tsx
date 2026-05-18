"use client";

type TotpCodeInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  autoFocus?: boolean;
};

export function TotpCodeInput({
  value,
  onChange,
  disabled,
  id = "totp",
  autoFocus,
}: TotpCodeInputProps) {
  return (
    <input
      id={id}
      name={id}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={8}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      required
      disabled={disabled}
      autoFocus={autoFocus}
      placeholder="000000"
      style={{
        width: "100%",
        boxSizing: "border-box",
        height: 40,
        borderRadius: 10,
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        color: "var(--text)",
        fontSize: 18,
        letterSpacing: "0.25em",
        textAlign: "center",
        padding: "0 12px",
        outline: "none",
        transition: "border-color 120ms ease-out",
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ring)")}
      onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
    />
  );
}
