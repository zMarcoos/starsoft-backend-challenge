# 🎬 StarSoft Backend Challenge - Sistema de Reservas



## 📌 Visão Geral
Esta é uma API RESTful robusta desenvolvida para gerenciar a reserva e venda de assentos de cinema. O grande desafio deste domínio não é o CRUD em si, mas sim a **concorrência**. 

O sistema foi arquitetado para lidar com cenários de alto tráfego, garantindo que o temido problema de *double-booking* (venda do mesmo ingresso para duas pessoas no mesmo milissegundo) seja impossível de acontecer, além de gerenciar autonomamente o ciclo de vida temporário (30 segundos) de ingressos não pagos através de processamento assíncrono.

---

## 🛠️ Tecnologias Escolhidas

* **Node.js + NestJS:** Framework modular que facilita a Injeção de Dependências e a criação de uma arquitetura limpa (híbrida entre REST e Microserviços).
* **PostgreSQL + Prisma ORM (Pg Adapter):** Banco de dados relacional (ACID) para garantir a integridade absoluta das transações financeiras e estado dos assentos. O uso do adapter nativo `pg` previne gargalos de conexão.
* **Redis (ioredis):** Escolhido especificamente como gerenciador de *Distributed Locks*. Devido à sua natureza *single-threaded* e operações em memória atômicas, é a barreira perfeita para barrar requisições concorrentes em microssegundos antes de tocarem no banco de dados.
* **RabbitMQ:** Sistema de mensageria adotado para garantir a expiração das reservas. Em vez de usar `setTimeout` (que é volátil e se perde se a aplicação reiniciar), usamos filas duráveis com a técnica de **Dead Letter Queue (DLQ)**.

---

## 🚀 Como Executar

### Pré-requisitos
* Docker e Docker Compose instalados.
* Node.js (v20+) e NPM/PNPM instalados (para rodar a API localmente durante o desenvolvimento).

### 1. Configurando o Ambiente
Clone o repositório e crie o seu arquivo de variáveis de ambiente a partir do exemplo fornecido:
```bash
cp .env.example .env
```

### 2. Subindo a infraestrutura
Inicie o PostgreSQL, Redis e RabbitMQ via Docker:
```bash
docker-compose up -d
```

### 3. Instalando dependências e preparando o banco
```bash
npm install
npx prisma migrate dev
```

### 4. Populando dados iniciais (Seed)
Para criar os filmes, sessões e 50 assentos disponíveis, rode:
```bash
npx prisma db seed
```

### 5. Iniciando a aplicação
Para criar os filmes, sessões e 50 assentos disponíveis, rode:
```bash
npm run start:dev
```

A API estará disponível em `http://localhost:3000/api/v1`.

### 6. Executando os testes
Para rodar a suíte de testes (que valida especificamente a lógica de controle de concorrência com Redis):
```bash
npm run test
```

---

## 🧠 Estratégias Implementadas

### Como resolveu Race Conditions?
Implementamos um **Distributed Lock Atômico no Redis**. Quando o usuário tenta reservar um assento, a API envia um comando `SET key value NX EX 30`. 
O parâmetro `NX` (Not eXists) garante que apenas a primeira requisição consiga gravar a chave. Requisições concorrentes (mesmo que no exato mesmo milissegundo) recebem `null` do Redis e a API retorna imediatamente um erro `409 Conflict`, barrando a *Race Condition* sem onerar o banco de dados.

### Como garantiu coordenação entre múltiplas instâncias?
Tanto o cache (Redis) quanto a mensageria (RabbitMQ) e o banco (Postgres) estão externalizados. Se subirmos 10 réplicas dessa API, todas consultarão o mesmo nó do Redis para checar o Lock, e todas poderão atuar como *Consumers* (Padrão Competing Consumers) na fila do RabbitMQ. O estado não fica preso na memória RAM do Node.js.

### Como preveniu Deadlocks?
1. **No Redis:** O parâmetro `EX 30` acopla um Time-To-Live (TTL) ao Lock. Se o servidor Node "morrer" no meio do processo antes de liberar a trava, o Redis a expira automaticamente em 30 segundos, impedindo o "assento fantasma".
2. **No Postgres:** As transações (`$transaction`) são mantidas extremamente curtas e simples, manipulando apenas as tabelas `Ticket` e `Seat` simultaneamente para evitar concorrência de recursos no disco. Operações de update condicional (`where: { status: 'PENDING' }`) delegam a validação final para o motor transacional do banco.

---

## 📡 Endpoints da API

**1. Listar Assentos Disponíveis**
* `GET /reservations`
* *Retorna as sessões, filmes e o array de assentos ordenados.*

**2. Criar Reserva (Bloqueio de 30s)**
* `POST /reservations`
* *Body:* `{ "userId": "uuid", "seatId": "uuid" }`
* *Retorna:* Dados da reserva temporária e `ticketId`.

**3. Consultar Status do Ingresso**
* `GET /reservations/ticket/:id`
* *Retorna:* Status atual do ingresso (`PENDING`, `PAID` ou `CANCELED`).

**4. Pagar Ingresso**
* `PATCH /reservations/ticket/:id/pay`
* *Retorna:* Confirmação de sucesso. Muda o status do Ticket para `PAID` e do Assento para `SOLD`.

---

## ⚖️ Decisões Técnicas
* **O Problema da Escrita Dupla (Dual-Write Problem):** Disparamos o evento para o RabbitMQ *estritamente após* o commit da transação do Prisma. Isso garante que não teremos mensagens órfãs na fila caso o banco de dados falhe.
* **Dead Letter Queue (DLQ) vs Cronjob/setTimeout:** A responsabilidade de contar os 30 segundos foi delegada ao RabbitMQ (usando `messageTtl`). Se a reserva não for paga, a mensagem "morre" e cai na fila principal, onde nosso *Consumer* a processa e cancela a reserva de forma autônoma e resiliente à queda do servidor Node.js.

---

## ⚠️ Limitações Conhecidas
* **Ausência do Padrão Outbox:** Embora emitamos a mensagem após a transação do banco, existe uma pequena janela de falha (se a rede do RabbitMQ cair no milissegundo exato após o commit do Postgres). O ideal seria salvar o evento no próprio banco de dados na mesma transação e ter um *Relay* lendo isso.
* **Testes End-to-End (E2E):** O foco principal foi criar testes unitários/funcionais críticos para o Lock de Concorrência. A cobertura E2E completa foi omitida por questões de escopo de tempo.

---

## 🔮 Melhorias Futuras
* **Implementar Transactional Outbox Pattern** para garantia de 100% de consistência eventual entre o Postgres e o RabbitMQ.
* **Adicionar Autenticação (JWT) e Autorização**, extraindo o `userId` do token da requisição em vez do corpo do payload.
* **Implementar CI/CD** (GitHub Actions) com pipeline de verificação de testes e lint antes do merge na `main`.
