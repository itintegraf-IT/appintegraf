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

## 5. Typické scénáře a řešení problémů

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

## 6. Související dokumenty

- [`nasazeni.md`](./nasazeni.md) – obecné nasazení, PM2, Prisma
- [`scripts/deploy-server.sh`](./scripts/deploy-server.sh) – automatický deploy skript
- [`ecosystem.config.js`](./ecosystem.config.js) – PM2 konfigurace produkce
