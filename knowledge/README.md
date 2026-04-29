# Knowledge Directory

This directory stores learned knowledge from agent task executions. Knowledge is automatically captured when agents complete tasks and organized by domain.

## Directory Structure

```
knowledge/
├── marketing/          # Marketing strategies, campaigns, content
├── product/            # Pricing, features, product decisions
├── engineering/        # Architecture, code patterns, tech decisions
├── sales/              # Sales approaches, pitches, objection handling
├── design/             # UI/UX patterns, visual designs
└── operations/         # Workflows, processes, automation
```

## Knowledge Types

- `landing_page_pattern` - Landing page designs and structures
- `pricing_strategy` - Pricing models and tier configurations
- `architecture_pattern` - System architecture decisions
- `marketing_strategy` - Marketing campaigns and approaches
- `coding_pattern` - Reusable code patterns and implementations
- `sales_approach` - Sales scripts and techniques
- `design_pattern` - UI/UX design patterns
- `workflow_process` - Business process definitions

## How It Works

1. **Capture**: After successful task completion, the `knowledge_capture` module analyzes the output
2. **Classification**: Patterns are detected and classified by type and domain
3. **Embedding**: Text embeddings are generated for semantic search
4. **Storage**: Knowledge is stored in SQLite and as markdown files here
5. **Retrieval**: Before task execution, relevant knowledge is retrieved and injected

## Configuration

Set `OPENAI_API_KEY` for high-quality embeddings. Without it, simple TF-IDF embeddings are used.

## API Access

```python
from orchestration import (
    store_agent_knowledge,
    retrieve_relevant_knowledge,
    get_knowledge_context
)

# Store knowledge
entries = store_agent_knowledge(
    agent_name='developer',
    task_output='...',
    project_id='my-project'
)

# Retrieve knowledge
matches = retrieve_relevant_knowledge(
    'Build a landing page with pricing',
    top_k=5
)

# Get context for injection
context = get_knowledge_context('Build a landing page')
```
