# Contributing Guide

Thank you for your interest in contributing to The Autonomous AI Startup Architecture!

## Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies: `pnpm install`
4. Create a branch: `git checkout -b feature/your-feature`

## Development Workflow

### Running Locally

```bash
# Start development server
pnpm dev

# Run type checking
pnpm typecheck

# Run linting
pnpm lint

# Run tests
pnpm test
```

### Code Style

- Use TypeScript for all new code
- Follow the existing code structure
- Use meaningful variable names
- Add comments for complex logic
- Keep functions small and focused

## Adding New Agents

### 1. Create Agent Directory

```bash
mkdir workspace/agents/your-agent-name
```

### 2. Create soul.md

```markdown
---
name: Your Agent Name
description: Brief description of the agent
color: blue
emoji: 🤖
vibe: One-line personality description
---

# Your Agent Name Personality

You are **Your Agent Name**, [detailed description]...

## 🧠 Your Identity & Memory
- **Role**: [Role description]
- **Personality**: [Traits]
- **Memory**: [What the agent remembers]
- **Experience**: [Background]

## 🎯 Your Core Mission
[Mission description]

## 🚨 Critical Rules You Must Follow
1. [Rule 1]
2. [Rule 2]

## 📋 Your Templates
[Code/output templates]

## 🌟 Success Metrics
[How success is measured]
```

### 3. Sync the Agent

```bash
curl -X POST http://localhost:3000/api/agents/sync
```

## Adding API Endpoints

### 1. Create Route File

```typescript
// src/app/api/your-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Implementation
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: 'Error message' },
      { status: 500 }
    );
  }
}
```

### 2. Add Types if Needed

```typescript
// src/types/index.ts
export interface YourType {
  id: string;
  // ...
}
```

## Adding UI Components

### Component Structure

```typescript
// src/components/category/YourComponent.tsx
'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface YourComponentProps {
  // Props
}

export function YourComponent({ ...props }: YourComponentProps) {
  // Implementation
  return (
    <div className={cn('base-classes')}>
      {/* Content */}
    </div>
  );
}
```

## Database Changes

### Adding New Tables

1. Add migration to `src/lib/db.ts`:

```typescript
// In the migrations array
`CREATE TABLE IF NOT EXISTS your_table (
  id TEXT PRIMARY KEY,
  -- columns
  created_at TEXT DEFAULT (datetime('now'))
)`,
```

2. Add types to `src/types/index.ts`

## Pull Request Process

1. Update documentation if needed
2. Add tests for new features
3. Run `pnpm lint` and `pnpm typecheck`
4. Write a clear PR description
5. Link related issues

### PR Template

```markdown
## Description
[What does this PR do?]

## Changes
- [Change 1]
- [Change 2]

## Testing
- [How was this tested?]

## Checklist
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] No breaking changes
```

## Reporting Issues

### Bug Reports

- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Environment details

### Feature Requests

- Clear description of the feature
- Use case explanation
- Proposed implementation (optional)

## Questions?

Open a discussion on GitHub or reach out to the maintainers.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
