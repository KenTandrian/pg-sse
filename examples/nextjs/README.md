# Next.js Real-Time PostgreSQL Monitor Example

A fully isolated Next.js (App Router) live dashboard demonstrating real-time PostgreSQL subscriptions powered by **`pg-sse`**.

## Quickstart (Docker Compose)

The fastest way to test live streaming is to spin up the local PostgreSQL container, which automatically initializes `setup.sql` on launch:

```bash
# 1. Start the PostgreSQL container (runs on localhost:5432)
docker compose -f docker/docker-compose.yml up -d

# 2. Start the Next.js development server
pnpm --filter nextjs-example dev
```

Open [http://localhost:3000](http://localhost:3000) to view the live dashboard.

## Testing Real-Time Feed

1. Open your terminal or database GUI (DBeaver, TablePlus, `psql`) connected to `postgres://postgres:postgres@localhost:5432/postgres`.
2. Insert or update a row in the `users` table:
   ```sql
   INSERT INTO users (name, email) VALUES ('Ken', 'ken@example.com');
   ```
3. The dashboard feed will instantly capture the incoming `INSERT` payload without reloading.

## Using Your Own Database

If you already have a PostgreSQL instance running locally or on Neon/Supabase:

1. Create a `.env.local` file (copying [.env.example](./.env.example)):
   ```env
   DATABASE_URL="postgres://username:password@localhost:5432/my_database"
   ```
2. Run [setup.sql](./docker/setup.sql) against your database to attach the notification trigger.
