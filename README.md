# pg-sse

Real-Time PostgreSQL Subscriptions for Next.js & React via Server-Sent Events (SSE).
Zero external SaaS dependencies. Zero vendor lock-in.

## Workspace Structure

This repository is organized as a **pnpm monorepo workspace**:

- **[`packages/pg-sse`](./packages/pg-sse/README.md)**: The core standalone library providing React Server Component boundaries (`pg-sse/server`, `pg-sse/client`), browser tab multiplexing via `BroadcastChannel`, keep-alive proxy headers, and automated leader election.
- **[`examples/nextjs`](./examples/nextjs/README.md)**: A complete, real-time live monitoring dashboard built with Next.js (App Router), Tailwind CSS, and Docker Compose.

## Development

```bash
# 1. Install dependencies
pnpm install

# 2. Build all packages and examples
pnpm build

# 3. Run all test suites
pnpm test

# 4. Spin up the example application
pnpm --filter nextjs-example dev
```

## Publishing

Deployment to npm is fully automated via GitHub Actions:

- **`ci.yml`**: Verifies builds and test suites on Push & Pull Request.
- **`publish.yml`**: Deploys `pg-sse` to npm (with provenance support) when a production release is published on GitHub.

## License

MIT
