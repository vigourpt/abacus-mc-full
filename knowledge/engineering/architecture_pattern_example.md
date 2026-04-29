# Architecture Pattern

**Agent:** developer  
**Domain:** engineering  
**Created:** 2026-03-16T00:00:00Z  
**Project:** example-saas-startup

---

## Next.js + Python Microservices Architecture

### Frontend Layer
```
┌─────────────────────────────────────────┐
│           Next.js Application           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Pages   │ │ API     │ │ Static  │   │
│  │ (SSR)   │ │ Routes  │ │ Assets  │   │
│  └─────────┘ └─────────┘ └─────────┘   │
└─────────────────────────────────────────┘
```

### Backend Services
```
┌─────────────────────────────────────────┐
│           API Gateway (Nginx)           │
└─────────────────────────────────────────┘
         │         │         │
    ┌────┴──┐ ┌────┴──┐ ┌────┴──┐
    │ Auth  │ │ Core  │ │  AI   │
    │Service│ │Service│ │Service│
    └───────┘ └───────┘ └───────┘
         │         │         │
    ┌────┴─────────┴─────────┴────┐
    │       Message Queue         │
    │       (Redis/RabbitMQ)      │
    └─────────────────────────────┘
```

### Data Layer
- **Primary DB:** PostgreSQL (structured data)
- **Cache:** Redis (sessions, hot data)
- **Search:** Elasticsearch (full-text)
- **Object Storage:** S3 (files, images)

### Key Decisions
1. **SQLite for MVP** - Upgrade to PostgreSQL at scale
2. **Server Actions** - Use Next.js 14+ server actions for forms
3. **Edge Functions** - Deploy auth at edge for low latency
4. **Type Safety** - Share types between frontend and backend via OpenAPI

### Deployment
```yaml
services:
  frontend:
    image: nextjs-app
    replicas: 3
    resources:
      memory: 512Mi
      cpu: 0.5
  
  backend:
    image: python-api
    replicas: 2
    resources:
      memory: 1Gi
      cpu: 1
```
