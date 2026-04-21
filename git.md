# Git a nasazování – průvodce krok za krokem

Průvodce git workflow pro projekt **APPIntegraf Next.js**. Popis obsahuje i setup test prostředí (vedle produkce) na Ubuntu serveru.

---

## Přehled prostředí

| Prostředí | Větev | Adresář na serveru | PM2 proces | Port | Databáze | URL |
|---|---|---|---|---|---|---|
| **Localhost** (vývoj) | `main` (pracovní), `test` (k testům) | `C:\Program Files\Ampps\www\APPIntegraf-NEXT` | – (AMPPS) | – | `appintegraf` (lokální) | http://localhost:3000 |
| **Test** (server) | `test` | `/var/www/appintegraf-test` | `appintegraf-test` | 3011 | `appintegraf_test` | dočasně `IP:3011`, později `https://test.appintegraf.integraf.cz` |
| **Produkce** (server) | `main` | `/var/www/appintegraf` | `appintegraf` | 3010 | `appintegraf` | `https://appintegraf.integraf.cz` |

---

## 1. Git Credential Manager (jednorázová konfigurace na Windows)

Pokud vás Git prosí o heslo a hlásí `Password authentication is not supported`:

```powershell
git --version
git credential-manager --version
git config --global credential.helper manager
```

Při prvním pushi se otevře okno prohlížeče, přihlásíte se na GitHub a GCM si údaje zapamatuje.

**Smazání starých/špatných pověření** (pokud se Windows pokoušejí použít špatné heslo):

1. `Ovládací panely → Správce pověření → Přihlašovací údaje systému Windows`
2. Smazat vše obsahující `github.com`
3. Znovu `git push` → otevře se prohlížeč.

---

## 2. Denní workflow – jak pracovat s větvemi

### 2.1 Stav a orientace

```powershell
git status                     # co je rozpracované
git branch                     # lokální větve (* = aktuální)
git branch -r                  # vzdálené větve
git log --oneline -10          # posledních 10 commitů
```

### 2.2 Běžný vývoj (na `main`)

```powershell
git checkout main
# ... upravíte kód ...
git add -A
git commit -m "Popis změny"
git push origin main
```

Po pushnutí na `main` → na produkčním serveru se pouští `./scripts/deploy-server.sh` (bez parametrů = výchozí `main`).

### 2.3 Nahrání změn do test prostředí

Když máte funkce, které chcete dát testerům (ještě ne do produkce):

```powershell
# 1) přepnout na test větev
git checkout test

# 2) vzít si aktuální main (nebo konkrétní commity)
git merge main                  # celá historie mainu se přelije do test
#   nebo jen vybrané commity:
#   git cherry-pick <SHA1> <SHA2>

# 3) pushnout na GitHub
git push origin test

# 4) vrátit se zpátky, abyste dál vyvíjel na mainu
git checkout main
```

Na serveru pak v `/var/www/appintegraf-test` spustíte deploy skript s parametrem pro test větev (viz sekce 4).

### 2.4 Povýšení otestované verze do produkce

Když tester odsouhlasí, že je vše v pořádku:

```powershell
git checkout main
git pull origin main              # pro jistotu synchronizovat
git merge test                    # přelít vše z test do main (nebo rebase dle chuti)
git push origin main
```

Na produkčním serveru `./scripts/deploy-server.sh`.

---

## 3. Užitečné příkazy pro ladění

```powershell
git diff                          # rozdíly v rozpracovaných souborech
git diff --staged                 # rozdíly v naindexovaných souborech
git log --oneline --graph --all   # strom větví
git restore <soubor>              # zahodit změny v souboru
git restore --staged <soubor>     # odstranit z indexu (neruší změny v souboru)
git stash                         # dočasně odložit rozpracované
git stash pop                     # vrátit odložené
```

Pokud se lokálně a na originu rozejdou commit stromy (typicky po force-push někoho jiného):

```powershell
git fetch origin
git reset --hard origin/main      # POZOR: zahodí lokální commity na main!
```

---

## 4. Nasazení na server

### 4.1 Produkce (stávající, beze změn)

Na serveru:

```bash
cd /var/www/appintegraf
./scripts/deploy-server.sh
```

### 4.2 Test prostředí

Na serveru:

```bash
cd /var/www/appintegraf-test
DEPLOY_BRANCH=test PM2_APP_NAME=appintegraf-test ./scripts/deploy-server.sh
```

**Proměnné skriptu:**

| Proměnná / přepínač | Default | Význam |
|---|---|---|
| `DEPLOY_BRANCH` (env) | `main` | Kterou větev pullnout a ověřit |
| `PM2_APP_NAME` (env) nebo `--pm2-name` | `appintegraf` | Který PM2 proces restartovat |
| `--skip-migrate` | – | Přeskočí `prisma migrate deploy` |
| `--skip-build` | – | Přeskočí `next build` (nouzově) |
| `--planovani-upgrade` | – | Spustí SQL upgrade modulu Plánování |
| `--apply-sql SOUBOR` | – | Aplikuje konkrétní SQL z `prisma/migrations/` |

---

## 5. Jednorázový setup test prostředí na serveru
<a id="setup-test-prostredi"></a>

> Jen poprvé, kdy test instanci zakládáte. Produkce (`/var/www/appintegraf`) zůstává naprosto beze změn.

**Předpoklady**: Ubuntu server, kde už běží produkce. Máte `sudo` práva, MySQL/MariaDB, Node.js 20+, PM2 (globálně), `git` a `nginx` (ten až ve fázi subdomény).

### 5.1 Klon repa do test adresáře

```bash
# Přihlaste se na server přes SSH a proveďte:
sudo git clone https://github.com/itintegraf-IT/appintegraf.git /var/www/appintegraf-test
sudo chown -R $USER:$USER /var/www/appintegraf-test
cd /var/www/appintegraf-test
git checkout test
git status          # musí být "On branch test, up to date with origin/test"
```

Pokud git na serveru požádá o přihlášení, použijte **PAT** (Personal Access Token z GitHubu, scope `repo`):

- username: `itintegraf-IT` (GitHub login, ne email)
- password: `ghp_…` (PAT)

GCM na serveru obvykle neběží graficky, takže PAT + `git config --global credential.helper store` si ho zapamatuje (`~/.git-credentials`).

### 5.2 Klon databáze `appintegraf` → `appintegraf_test`

```bash
# Dump produkční databáze (bezpečné, jen čte):
mysqldump -u root -p --single-transaction --routines --triggers --hex-blob appintegraf \
  > /tmp/appintegraf_prod_dump.sql

# Vytvoření nové databáze:
mysql -u root -p -e "CREATE DATABASE appintegraf_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Import dumpu do testu:
mysql -u root -p appintegraf_test < /tmp/appintegraf_prod_dump.sql

# (volitelně) smazání dumpu:
rm /tmp/appintegraf_prod_dump.sql
```

> **Pokud máte MariaDB** (ne MySQL 8) a dump hlásí `utf8mb4_0900_ai_ci` → v dumpu nahraďte kolaci za `utf8mb4_unicode_ci`:
> `sed -i 's/utf8mb4_0900_ai_ci/utf8mb4_unicode_ci/g' /tmp/appintegraf_prod_dump.sql`

### 5.3 Vytvoření `.env` v test projektu

```bash
cd /var/www/appintegraf-test
cp .env.example .env
nano .env
```

Obsah `.env`:

```env
DATABASE_URL="mysql://root:<heslo>@localhost:3306/appintegraf_test"

# Vygenerujte NOVÝ secret, aby session cookies z prod a test nekolidovaly:
#   openssl rand -base64 32
AUTH_SECRET="<nový náhodný řetězec>"

# Dočasně (než bude subdoména), použijte IP serveru:
AUTH_URL="http://<IP_SERVERU>:3011"
NEXT_PUBLIC_API_URL="http://<IP_SERVERU>:3011"

# Označení, že běží testovací instance (využitelné v UI bannerem):
APP_ENV="test"
```

Heslo databáze zjistíte z `/var/www/appintegraf/ecosystem.config.js` (stávající produkce), typicky `mysql://root:mysql@localhost:3306/appintegraf`.

> Později, až přidáme subdoménu, v `.env` změníte jen `AUTH_URL` a `NEXT_PUBLIC_API_URL` na `https://test.appintegraf.integraf.cz`.

### 5.4 PM2 ecosystem config – **mimo repo**

PM2 config leží v `/etc/appintegraf/ecosystem.test.config.js`, aby v repu nebyla žádná secrets. Secrets stejně čte aplikace z `.env`, PM2 config slouží jen k definici procesu.

```bash
sudo mkdir -p /etc/appintegraf
sudo nano /etc/appintegraf/ecosystem.test.config.js
```

Obsah:

```javascript
module.exports = {
  apps: [
    {
      name: "appintegraf-test",
      cwd: "/var/www/appintegraf-test",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3011",
      env: {
        NODE_ENV: "production",
        APP_ENV: "test"
      }
    }
  ]
};
```

Neobsahuje `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` — ty si Next.js načte z `.env` v `/var/www/appintegraf-test/.env` při startu.

### 5.5 První build + start PM2

```bash
cd /var/www/appintegraf-test

# Instalace závislostí (legacy peer deps jako v produkci):
npm install --legacy-peer-deps

# Prisma generate proběhne v postinstall; pro jistotu:
npx prisma generate

# Build:
npm run build

# Start PM2 procesu z externí konfigurace:
pm2 start /etc/appintegraf/ecosystem.test.config.js

# Uložení seznamu procesů (aby se po restartu serveru samy spustily):
pm2 save

# Kontrola:
pm2 status
pm2 logs appintegraf-test --lines 50
```

V `pm2 status` musíte vidět **oba** procesy: `appintegraf` (produkce, port 3010) i `appintegraf-test` (test, port 3011), oba `online`.

### 5.6 Otevření portu 3011 (dočasně, než bude subdoména s proxy)

Pokud máte aktivní `ufw`:

```bash
sudo ufw allow 3011/tcp comment "APPIntegraf TEST (docasne)"
sudo ufw status
```

Pokud používáte pouze firewall na úrovni routeru/VPS poskytovatele, otevřete port 3011 tam.

**Test z vašeho PC:** v prohlížeči otevřete `http://<IP_SERVERU>:3011` — měla by naběhnout test instance.

> **Bezpečnost**: otevřený port 3011 bez omezení znamená, že test instanci vidí celý internet. Pro omezení přístupu zatím varianta „sdílet IP:port jen s testery“; ideálně co nejdřív dodáme subdoménu + nginx Basic Auth (krok 7).

### 5.7 Následné deploy (když pushnete změny do `test`)

```bash
cd /var/www/appintegraf-test
DEPLOY_BRANCH=test PM2_APP_NAME=appintegraf-test ./scripts/deploy-server.sh
```

---

## 6. Typické scénáře a řešení problémů

### „git pull hlásí konflikt na package-lock.json“

Deploy skript to řeší sám (`git restore package-lock.json` před `git pull`). Pokud pouštíte ručně, udělejte to také.

### „HEAD se neshoduje s origin/<branch>“

Někdo pushnul nový commit těsně před vámi, nebo na serveru zůstal lokální commit. Na serveru:

```bash
git fetch origin
git reset --hard origin/<branch>
```

**POZOR:** `reset --hard` zahodí vše neuložené! Prověřte `git status` před tímto krokem.

### „Musím otestovat změnu bez pushnutí“

Na test serveru můžete udělat:

```bash
cd /var/www/appintegraf-test
git checkout test
git fetch origin
git reset --hard origin/test
npm install --legacy-peer-deps
npm run build
pm2 restart appintegraf-test
```

Stejně jako deploy skript, jen ručně.

---

## 7. Související dokumenty

- [`nasazeni.md`](./nasazeni.md) – obecné nasazení, PM2, Prisma
- [`scripts/deploy-server.sh`](./scripts/deploy-server.sh) – automatický deploy skript
- [`ecosystem.config.js`](./ecosystem.config.js) – PM2 konfigurace produkce
- `/etc/appintegraf/ecosystem.test.config.js` – PM2 konfigurace testu (**pouze na serveru, mimo repo**)
