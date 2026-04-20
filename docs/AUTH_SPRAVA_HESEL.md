# Správa hesel a aktivace účtů

Dokument popisuje tři navazující toky:

1. **Obnova hesla** – uživatel zapomněl heslo a žádá o nový odkaz.
2. **Admin pošle odkaz** – administrátor odešle existujícímu uživateli buď odkaz pro obnovu hesla, nebo znovu aktivační odkaz.
3. **Aktivace nového účtu** – uživatel si při vytvoření účtu nastaví heslo sám přes odkaz v e-mailu.

## Datový model

Migrace: `prisma/migrations/20260420_auth_tokens.sql`.

### `users.password_version`
Celé číslo, default `1`. Zvyšuje se o 1 při každé změně hesla (self-service reset, aktivace, změna adminem). Používá se k invalidaci všech stávajících JWT session tohoto uživatele.

### Tabulka `user_tokens`
| Sloupec | Popis |
|---------|-------|
| `id` | PK |
| `user_id` | FK → `users.id` |
| `purpose` | `password_reset` \| `account_activation` |
| `token_hash` | SHA‑256 hex plaintextu tokenu (64 znaků). **Plaintext v DB nikdy není.** |
| `expires_at` | Expirace (30 min reset, 7 dní aktivace) |
| `used_at` | Nastaveno po úspěšném použití – token je pak jednorázový. |
| `ip_created` / `ip_used` | IP pro audit |
| `created_at` | Vytvoření |

Při vytvoření tokenu se smažou všechny ostatní nepoužité tokeny stejného `purpose` téhož uživatele – starý odkaz tedy přestane platit.

### Tabulka `rate_limit_hits`
Jednoduchý sliding window rate limit (řádek na klíč × minutový slot). Používá se u `/api/auth/forgot-password`.

## Knihovny

| Soubor | Funkce |
|--------|--------|
| `lib/password-policy.ts` | `validatePassword`, `PASSWORD_RULES_TEXT`, `PASSWORD_MIN_LENGTH` (8). |
| `lib/tokens.ts` | `createUserToken`, `verifyUserToken`, `consumeUserToken`, `hashToken`, `tokenReasonText`. |
| `lib/rate-limit.ts` | `rateLimit({ key, max, windowMs })`, `cleanupOldRateLimitHits`. |
| `lib/auth-audit.ts` | `logAuthAudit` – zápisy do `audit_log` pod modulem `auth`. |
| `lib/email.ts` | `sendPasswordResetEmail`, `sendAccountActivationEmail`, `sendPasswordChangedEmail`. |

## Politika hesla

- Minimum 8 znaků (`PASSWORD_MIN_LENGTH`).
- Alespoň 1 písmeno a 1 číslice.
- Doporučené: 12+ znaků se speciálním znakem (skóre 4/4).
- Validace běží na klientovi (live progress bar v `SetPasswordForm`) i na serveru v každém endpointu, který heslo zapisuje.

## API

### `POST /api/auth/forgot-password`
Body: `{ "login": "<username | email>" }`.
- Odpověď je **vždy stejná** (prevence enumerace účtů).
- Rate-limit: per-IP 10/h, per-uživatel 3/h.
- Při úspěchu: vygeneruje `password_reset` token, odešle `sendPasswordResetEmail`, zapíše `password_reset_requested` do audit_log.

### `GET /api/auth/validate-token?token=...&purpose=password_reset|account_activation`
Ověří token a vrátí `user` pro zobrazení na stránce (`username`, `email`, jméno). Token se **nespotřebovává**.

### `POST /api/auth/reset-password`
Body: `{ "token": "...", "password": "..." }`.
- Validuje heslo politikou.
- Ověří + **spotřebuje** token.
- Zapíše nový hash, `password_version = password_version + 1` (odhlásí všechny ostatní sessiony).
- Odešle `sendPasswordChangedEmail`.
- Audit: `password_reset_completed`.

### `POST /api/auth/activate`
Analogicky jako `/reset-password`, ale s tokenem `account_activation`. Navíc nastaví `is_active = true`. Audit: `account_activated`.

### `POST /api/admin/users/{id}/send-reset`
Body: `{ "kind": "reset" | "activation" }` (default `reset`).
- Vyžaduje role admin.
- Vytvoří token a odešle e-mail.
- Audit: `admin_sent_reset_link` / `account_activation_sent`.

### `POST /api/admin/users`
Vytvoření uživatele. Nově podporuje:
- `send_activation_email: true` – uživatel se založí s náhodným (nepoužitelným) hashem hesla, vygeneruje se aktivační token a odešle e-mail.
- `password_custom: "..."` – admin nastaví heslo ručně; projde `validatePassword`.

### `PUT /api/admin/users/{id}`
Při změně hesla (`password_new`):
- Projde `validatePassword`.
- Zvyšuje `password_version` (invalidace ostatních sessionů).
- Audit: `password_set_by_admin`.

## Stránky

| URL | Komponenta | Účel |
|-----|------------|------|
| `/login` | `app/login/page.tsx` | Přihlášení. Obsahuje odkaz **„Zapomenuté heslo?“**. |
| `/forgot-password` | `app/forgot-password/page.tsx` | Zadání username/e-mailu → odeslání odkazu. |
| `/reset-password?token=...` | `app/reset-password/page.tsx` | Nastavení nového hesla. Používá `SetPasswordForm` s `purpose="password_reset"`. |
| `/activate?token=...` | `app/activate/page.tsx` | První nastavení hesla. Po úspěchu rovnou přihlásí (credentials signIn). |

Sdílené komponenty:
- `components/auth/AuthCard.tsx` – jednotný layout a styly.
- `components/auth/SetPasswordForm.tsx` – formulář pro `/reset-password` i `/activate`. Obsahuje progress-bar síly hesla a kontrolu shody obou polí.

## Admin formulář uživatele

V `app/(dashboard)/admin/users/AdminUserForm.tsx`:
- **Při vytváření** nového uživatele je radio-button:
  - *Odeslat aktivační odkaz e-mailem* (doporučeno) – backend založí účet s náhodným hashem a odešle token.
  - *Zadat heslo ručně* – pole pro heslo, validace podle politiky.
- **Při editaci**:
  - Pole pro ruční změnu hesla (volitelné, validace podle politiky).
  - Tlačítka **„Poslat odkaz pro obnovu hesla“** a **„Poslat aktivační odkaz“**, která volají `/api/admin/users/{id}/send-reset`.

## Invalidace sessionů

V `auth.ts` (JWT callback):
- Uvnitř `jwt({ token, user })` po přihlášení uložíme `token.passwordVersion`.
- Při každém dalším obnovení JWT porovnáme `token.passwordVersion` s aktuální hodnotou v DB.
- Pokud se liší (heslo bylo změněno – self‑service, aktivace, admin), vrátíme `null` → next‑auth session zneplatní.
- Stejně se zachováme, pokud je uživatel `is_active = false`.

Efekt: po změně hesla jsou odhlášeny **všechny** aktivní prohlížeče / zařízení. Uživatel, který heslo změnil, se přihlásí znovu novým heslem (po aktivaci se přihlásí automaticky).

## Audit log

V modulu `auth` se zapisují následující akce (`action`):

| Akce | Kdo | Kdy |
|------|-----|-----|
| `password_reset_requested` | anonym (user_id=null) | Žádost o obnovu z `/forgot-password`. |
| `password_reset_rate_limited` | anonym | Žádost odmítnuta rate-limitem. |
| `password_reset_completed` | sám uživatel | Úspěšné nastavení nového hesla z `/reset-password`. |
| `account_activation_sent` | admin | Odeslání aktivačního odkazu (z formuláře při vytvoření nebo tlačítkem). |
| `account_activated` | sám uživatel | Úspěšná aktivace přes `/activate`. |
| `admin_sent_reset_link` | admin | Admin poslal uživateli reset link. |
| `password_set_by_admin` | admin | Admin ručně změnil heslo. |

Kompletní záznam obsahuje `user_id` (kdo akci provedl), `record_id` (kterého uživatele se týká), IP a user-agent.

## Bezpečnostní opatření

- **Plaintext token v DB nikdy neuložíme.** V URL je pouze plaintext (256 bitů base64url), v DB jen SHA‑256 hash.
- **Jednorázové tokeny** – `used_at` po použití.
- **Krátká expirace** – 30 min pro reset, 7 dní pro aktivaci.
- **Rate-limit** – per-IP 10/h a per-uživatel 3/h u `/api/auth/forgot-password`.
- **Generická odpověď** – `/forgot-password` nikdy neprozradí, zda účet existuje.
- **Invalidace sessionů** – po změně hesla se zvýší `password_version` a všechny JWT sessiony přestanou platit.
- **Notifikační e-mail** – po každé změně hesla je žadatel informován mailem (ochrana před neoprávněnou změnou).
- **Politika hesla** – `validatePassword` se volá na klientu i na všech serverových endpointech.

## Co zatím není

- **2FA (TOTP)** – připraveno k následné fázi; vyžaduje pole `totp_secret`, `totp_enabled` v `users`, stránku pro zapnutí/vypnutí a mezikrok v přihlášení.
- **Cron úklid expirovaných tokenů** – dnes se staré tokeny přemazávají při vytvoření nového; volitelně je možné přidat periodický `DELETE FROM user_tokens WHERE expires_at < NOW() - INTERVAL 30 DAY`.

## Spuštění migrace

```sql
-- V MySQL (phpMyAdmin / klient):
SOURCE prisma/migrations/20260420_auth_tokens.sql;
```

Nebo jednorázově přes Prismu:

```bash
npx prisma db push
```
