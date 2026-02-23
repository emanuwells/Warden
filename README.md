# Warden — System Resource Monitor

> O guardião da tua infraestrutura. Monitoriza CPU, RAM, Disco e Rede em semi-real time.

## Visão Geral

O **Warden** é um monitor de recursos de sistema de alta performance para servidores Ubuntu. Recolhe métricas vitais via `psutil`, armazena em MariaDB (JSON), e alimenta um dashboard frontend com design MAIATRON.

Complementa o monitor de pipelines **Overseer**.

## Arquitetura

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│  warden.py       │────>│  MariaDB          │────>│ export_payload.py    │
│  (Collector)     │     │  warden_metrics   │     │ (cron every 15s)     │
│  psutil @ 15s    │     │  - id             │     └──────────┬───────────┘
│                  │     │  - captured_at    │                │
│  Janitor         │     │  - metrics (JSON) │                v
│  (daily cleanup) │     └──────────────────┘     ┌──────────────────────┐
└──────────────────┘                               │ warden_payload.json  │
                                                   │ (static file)        │
                                                   └──────────┬───────────┘
                                                              │
                                                              v
                                                   ┌──────────────────────┐
                                                   │ index.html           │
                                                   │ (MAIATRON Dashboard) │
                                                   │ - Gauges             │
                                                   │ - Line Charts        │
                                                   │ - Per-core bars      │
                                                   │ - Dark/Light mode    │
                                                   └──────────────────────┘
```

## Quick Start

### 1. Instalar dependências
```bash
cd Warden
pip install -r requirements.txt
```

### 2. Configurar
```bash
cp .env.example .env
cp secrets/database.json.example secrets/database.json
# Editar com as credenciais reais
```

### 3. Criar tabela
```bash
python warden.py --setup
```

### 4. Testar captura
```bash
python warden.py --once
```

### 5. Arrancar collector
```bash
python warden.py
```

### 6. Deploy como serviço
```bash
sudo cp systemd/warden.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now warden
```

### 7. Configurar export (cron)
```bash
crontab -e
# Adicionar linhas de scripts/crontab.example
```

### 7.1. Configurar alertas Slack (opcional, recomendado)
```bash
cp secrets/slack.json.example secrets/slack.json
# Editar webhook_url e channel
```

Jobs de cron recomendados (já incluídos em `scripts/crontab.example`):
- `scripts/slack_alerts.py` a cada minuto (warnings/criticals + recovery)
- `scripts/slack_daily_digest.py` às `08:00` (hora local do servidor)

Comportamento atual de notificações Slack:
- Alertas `warning` e `critical` enviam mensagem imediata com menção `<!channel>`
- Recoveries podem ser enviados (controlado por `notify_on_recovery` em `secrets/slack.json`)
- Digest diário envia resumo com menção `<!channel>`

### 8. Servir frontend (nginx)
```nginx
server {
    listen 80;
    server_name warden.example.com;
    root /opt/warden/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## Estrutura

```
Warden/
├── warden.py                # CLI principal
├── requirements.txt
├── .env.example
├── .gitignore
├── AGENTS.md
├── CHANGELOG.md
├── README.md
│
├── src/
│   ├── __init__.py
│   ├── settings.py          # Configuração
│   ├── collector.py         # Captura métricas (psutil)
│   ├── db_writer.py         # MariaDB read/write
│   ├── slack_notifier.py    # Webhook Slack
│   └── janitor.py           # Cleanup automático
│
├── frontend/
│   ├── index.html           # Dashboard (MAIATRON)
│   ├── warden.css           # Estilos
│   ├── warden.js            # Lógica SPA
│   └── warden_payload.json  # (gerado, gitignored)
│
├── scripts/
│   ├── setup_db.sql         # DDL MariaDB
│   ├── export_payload.py    # DB → JSON
│   ├── janitor.py           # Cleanup manual
│   ├── slack_alerts.py      # Alertas imediatos para Slack
│   ├── slack_daily_digest.py # Digest diário para Slack
│   └── crontab.example
│
├── config/
│   └── auth.local.json.example
│
├── secrets/
│   ├── database.json.example
│   └── README.md
│
├── systemd/
│   └── warden.service
│
└── runtime/
    └── logs/
```

## Métricas Capturadas

| Categoria | Métricas |
|---|---|
| **CPU** | Total %, per-core %, frequência, load average |
| **RAM** | Total, usada, livre, %, swap |
| **Disco** | Total, usado, livre, %, I/O read/write, top consumidores (ficheiros) |
| **Rede** | Upload/Download Mbps, bytes, pacotes |

## Frontend Features

- **Dashboard Overview:** 4 gauges + 2 gráficos 24h
- **CPU Tab:** Gráfico tempo real + barras per-core + histórico 7 dias
- **Memória Tab:** Info cards + gráfico tempo real + histórico 7 dias
- **Disco Tab:** Info cards + I/O tempo real + doughnut de espaço + top consumidores de disco
- **Rede Tab:** Info cards + gráfico tempo real + histórico 7 dias
- **Auth:** Login com sessão persistente (MAIATRON auth)
- **Theme:** Dark mode (padrão) / Light mode toggle
- **Auto-refresh:** Cada 15 segundos
- **Responsivo:** Mobile-first

## Slack Notifications

### Alertas imediatos (`scripts/slack_alerts.py`)
- Avalia thresholds do payload exportado (`CPU`, `RAM`, `Disco`, `MariaDB`)
- Envia `warning` e `critical` para Slack com deduplicação + cooldown (`SLACK_ALERT_COOLDOWN_MINUTES`)
- Envia recoveries quando o alerta volta a `resolved` (se `notify_on_recovery=true`)
- Mensagens incluem `<!channel>`, severidade, valor atual, limite e timestamps

Exemplo de execução manual:
```bash
cd /home/eferreira/MAIATRON/Warden
.venv/bin/python scripts/slack_alerts.py --dry-run
```

### Digest diário (`scripts/slack_daily_digest.py`)
- Resume o dia anterior (UTC) com:
  - Host (uptime estimado + picos CPU/RAM/Disco)
  - MariaDB (QPS/TPS médios, slow_qps max, threads_running max)
  - Alertas (eventos, firing, critical, warning, top recorrentes)
- Mensagem inclui menção `<!channel>`

Exemplo de execução manual:
```bash
cd /home/eferreira/MAIATRON/Warden
.venv/bin/python scripts/slack_daily_digest.py --dry-run
```

### Variáveis e segredos de Slack
- `.env`:
  - `SLACK_ENABLED=true`
  - `SLACK_ALERT_COOLDOWN_MINUTES=15`
  - `SLACK_DIGEST_HOUR_UTC=8`
  - `SLACK_DIGEST_MINUTE_UTC=0`
- `secrets/slack.json`:
  - `webhook_url`
  - `channel`
  - `notify_on_recovery`

### Cron (exemplo)
```cron
* * * * * flock -n /tmp/warden_slack_alerts.lock -c 'cd /home/eferreira/MAIATRON/Warden && .venv/bin/python scripts/slack_alerts.py >> runtime/logs/slack_alerts.log 2>&1'
0 8 * * * cd /home/eferreira/MAIATRON/Warden && .venv/bin/python scripts/slack_daily_digest.py >> runtime/logs/slack_digest.log 2>&1
```

## Requisitos

- **Python:** 3.10+
- **MariaDB:** 10.2+ (suporte JSON)
- **SO:** Ubuntu Server (recomendado)
- **Browser:** Chrome, Firefox, Safari, Edge (moderno)

## Retenção de dados (30 dias)

- `RETENTION_DAYS=30` por defeito
- limpeza diária via janitor (`src/janitor.py`)
- query aplicada: `DELETE FROM warden_metrics WHERE captured_at < NOW() - INTERVAL %s DAY`

### Verificação manual (SQL)

```sql
SELECT COUNT(*) AS old_rows
FROM warden_metrics
WHERE captured_at < NOW() - INTERVAL 30 DAY;
```

Resultado esperado após janitor: `old_rows = 0`

### Execução manual do janitor

```bash
cd /home/eferreira/MAIATRON/Warden
.venv/bin/python scripts/janitor.py
```

## Top consumidores de disco (visibilidade total via helper root)

Por defeito, o `warden.service` corre como utilizador não-root (`eferreira`), por isso o scan local de disco só vê ficheiros legíveis por esse utilizador.

Para mostrar **top ficheiros do sistema inteiro** no dashboard (`source=sudo_helper`, `visibility_scope=system`), usar helper root dedicado:

1. Instalar helper root-owned:
   - `/usr/local/libexec/warden-disk-top-helper.py`
   - `/usr/local/sbin/warden-disk-top-helper`
2. Criar sudoers restrito:
   - `/etc/sudoers.d/warden-disk-top`
3. Configurar `.env`:
   - `DISK_TOP_SCAN_MODE=sudo_helper`
   - `DISK_TOP_SUDO_HELPER_CMD=/usr/local/sbin/warden-disk-top-helper`

Templates para instalação:
- `scripts/warden_disk_top_helper.py`
- `scripts/warden-disk-top-helper.wrapper.sh`
- `scripts/warden-disk-top.sudoers`

Se o helper root falhar, o collector faz fallback automático para scan local e o payload marca:
- `source=local_scan`
- `visibility_scope=user_limited`
- `warning=\"root helper unavailable; using local scan\"`
