# Example Tasks

This directory contains example task definitions demonstrating the new Mission Control features.

## Task Dependency Chain

These examples show a realistic project workflow with dependencies:

```
task_design_001 (Design System)
        |
        v
task_dev_002 (Frontend Components) --+
                                      |
                                      +--> task_dev_004 (Integration)
task_dev_003 (Backend API) -----------+          |
                                                 v
                                      task_qa_005 (Testing)
```

## Using Dependencies

Add `depends_on` field to your task JSON:

```json
{
  "task_id": "task_002",
  "depends_on": ["task_001"],
  "description": "This task waits for task_001 to complete"
}
```

## Running with Scheduler

To process tasks with dependency resolution:

```bash
python run_mission_control.py --use-scheduler
```

The scheduler will:
1. Check dependencies before executing each task
2. Keep tasks in backlog until dependencies are satisfied
3. Execute tasks in topological order
4. Handle failed dependencies (blocked tasks)

## Copying Examples

To use these examples, copy them to the backlog:

```bash
cp tasks/examples/*.json tasks/backlog/
```
