# Guia de Produção — Warden

## Pré-requisitos

1. **Servidor Ubuntu** com Python 3.10+ e MariaDB 10.2+
2. **Nginx** para servir o frontend
3. **Acesso SSH** (se DB é remota)

## Passo a Passo

### 1. Clonar / Copiar para `/opt/warden`

```bash
sudo mkdir -p /opt/warden
sudo cp -r Warden/* /opt/warden/
sudo chown -R warden:warden /opt/warden
```

### 2. Ambiente Virtual Python

```bash
cd /opt/warden
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Configurar Credenciais

```bash
cp .env.example .env
nano .env  # Preencher DB_HOST, DB_USER, DB_PASSWORD, etc.

cp secrets/database.json.example secrets/database.json
nano secrets/database.json  # Alternativa: credenciais via JSON
```

### 4. Criar Base de Dados

```bash
# No servidor MariaDB:
mysql -u root -p < scripts/setup_db.sql
```

### 5. Testar

```bash
python warden.py --setup    # Cria tabela
python warden.py --once     # Captura teste
python warden.py --export   # Gera JSON
```

### 6. Instalar Serviço systemd

```bash
sudo cp systemd/warden.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable warden
sudo systemctl start warden
sudo systemctl status warden
```

### 7. Configurar Cron para Export

```bash
crontab -e
```
Adicionar (15 em 15 segundos + retenção 30d):
```
* * * * * cd /opt/warden && venv/bin/python scripts/export_payload.py >/dev/null 2>&1
* * * * * sleep 15 && cd /opt/warden && venv/bin/python scripts/export_payload.py >/dev/null 2>&1
* * * * * sleep 30 && cd /opt/warden && venv/bin/python scripts/export_payload.py >/dev/null 2>&1
* * * * * sleep 45 && cd /opt/warden && venv/bin/python scripts/export_payload.py >/dev/null 2>&1
0 3 * * * cd /opt/warden && venv/bin/python scripts/janitor.py >> runtime/logs/janitor.log 2>&1
```

### 8. Configurar Nginx

```bash
sudo nano /etc/nginx/sites-available/warden
```

```nginx
server {
    listen 80;
    server_name warden.maia.local;
    root /opt/warden/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    location ~* \.json$ {
        add_header Cache-Control "no-store, no-cache";
        add_header Access-Control-Allow-Origin "*";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/warden /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 9. Copiar Logo MAIATRON

```bash
cp /path/to/MAIATRON_LOGO_NOBG.png /opt/warden/frontend/assets/
```

### 10. Verificar

- Abrir `http://warden.maia.local` no browser
- Login com credenciais do `config/auth.local.json`
- Verificar gauges e gráficos

## Troubleshooting

| Problema | Solução |
|---|---|
| JSON não atualiza | Verificar cron: `crontab -l` |
| Serviço não arranca | `journalctl -u warden -f` |
| DB connection error | Verificar `.env` e que MariaDB aceita conexões |
| Frontend vazio | Verificar que `warden_payload.json` existe |
| Login não funciona | Copiar `config/auth.local.json.example` → `config/auth.local.json` |

## Verificação de retenção (30 dias)

```sql
SELECT COUNT(*) AS old_rows
FROM warden_metrics
WHERE captured_at < NOW() - INTERVAL 30 DAY;
```

O valor esperado após o janitor diário é `0`.

## Top consumidores de disco (visibilidade total)

O serviço `warden` corre como utilizador não-root. Para o painel **Top consumidores de disco** mostrar ficheiros do sistema inteiro, instalar helper root dedicado e sudoers restrito:

### 1) Instalar helper (root-owned)

Usar os templates do repo:
- `scripts/warden_disk_top_helper.py`
- `scripts/warden-disk-top-helper.wrapper.sh`
- `scripts/warden-disk-top.sudoers`

Destino final recomendado:
- `/usr/local/libexec/warden-disk-top-helper.py`
- `/usr/local/sbin/warden-disk-top-helper`
- `/etc/sudoers.d/warden-disk-top`

### 2) Configurar `.env`

```dotenv
DISK_TOP_SCAN_MODE=sudo_helper
DISK_TOP_SUDO_HELPER_CMD=/usr/local/sbin/warden-disk-top-helper
DISK_TOP_SUDO_TIMEOUT_SECONDS=12
```

### 3) Reiniciar serviço

```bash
sudo systemctl restart warden
```

### 4) Validar payload

O `warden_payload.json` deve passar a indicar:
- `current.disk.top_consumers.source = \"sudo_helper\"`
- `current.disk.top_consumers.visibility_scope = \"system\"`
