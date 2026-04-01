---
name: maieutic
description: Socratic self-questioning for deeper task understanding. Use when starting tasks, when sensing drift, or when the user says "use Socratic method", "maieutics", "think socratically", "question yourself".
---

# Maieutic Method — Socratic Self-Questioning

You have access to the `maieutic-engine` MCP tools. Use them to question your own reasoning before, during, and after tasks.

## When to Activate

- **Before any non-trivial task** — automatically run Phase 1
- **When the user says:** "use Socratic method", "maieutics", "think socratically", "question yourself", "what are you assuming?"
- **When you sense drift** — you're adding unrequested features, optimizing for the wrong metric, or going deep on technically interesting but strategically irrelevant work

## The Core Principle: Anamnesis

You already KNOW the right approach — your training contains vast domain knowledge. But without the right framing questions, you retrieve whatever is *semantically nearest to the current context* (code patterns, syntax) rather than what's *strategically relevant* (business goals, user needs, domain principles). Socratic self-questioning forces retrieval through the right intermediate concepts.

## Phase 1: Before Action (Inquiry)

1. Call `maieutic_begin` with the task description. Accept the profile it suggests or override based on task type:
   - **feature** → Purpose, Point of View, Implications, Concepts
   - **bugfix** → Assumptions, Information, Inferences, Question at Issue
   - **refactor** → Purpose, Concepts, Implications, Assumptions

2. For each root question returned, dispatch a **parallel subagent** using the Agent tool:
   - Give each subagent the `inquiry_id` and its assigned question
   - Each subagent should:
     a. Call `maieutic_recall` to search for relevant past reasoning
     b. Reason about the question, incorporating what was found
     c. Call `maieutic_answer` with its answer, honest confidence score, and any follow-up questions in `spawn[]`
   - Dispatch all subagents simultaneously for parallel execution

3. After all subagents return, call `maieutic_synthesize`:
   - Summarize connections across branches
   - Flag contradictions
   - Identify open threads (low-confidence answers, unresolved questions)
   - Propose next-round questions if depth allows

4. If depth setting allows more rounds AND there are open threads:
   - Dispatch another round of subagents for the spawned questions
   - Repeat synthesis

5. Present a **briefing** to the user based on visibility setting:
   - **silent:** Only show unresolved questions that need user input
   - **summary:** Show "Here's what I understand, my assumptions, and questions I couldn't resolve"
   - **verbose:** Show the full Q&A tree

6. Proceed with the task, informed by the inquiry.

## Phase 2: During Action (Check-in)

Periodically ask yourself these drift-detection questions:

- **Scope creep:** "Am I adding things the user didn't ask for?"
- **Means-end inversion:** "Am I optimizing for code elegance when the goal is user engagement?"
- **Assumption violation:** "Did I discover something that contradicts my starting assumptions?"

When you detect drift:
1. Call `maieutic_recall` with the original task purpose
2. Call `maieutic_ask` with an alignment question
3. Call `maieutic_answer` honestly
4. If misaligned, surface to the user and course-correct

## Phase 3: After Action (Reflection)

When the task is complete, call `maieutic_reflect` with:
- **what_worked:** What did the Socratic process surface that was valuable?
- **what_missed:** What should have been questioned but wasn't?
- **key_insight:** The single most valuable takeaway (this gets indexed for future recall)

## Subagent Prompt Template

When dispatching subagents for parallel questioning, give each one this context:

```
You are investigating a specific aspect of a task using Socratic questioning.

TASK: {task_description}
YOUR ELEMENT: {element} (e.g., "assumptions")
YOUR QUESTION: {question_text}
INQUIRY CONTEXT: {synthesis_from_previous_rounds, if any}

You have access to maieutic_recall and maieutic_answer MCP tools.

Process:
1. Call maieutic_recall with a relevant search query to find past reasoning
2. Call maieutic_recall with the current inquiry to check sibling answers
3. Reason about your question, incorporating what you found
4. Call maieutic_answer with your answer, honest confidence (0.3=guessing, 0.8+=solid), and spawn[] for follow-ups
```

## Depth Guide

| Depth | Root Questions | Max Rounds | Use For |
|-------|---------------|------------|---------|
| shallow | 2-3 | 1 | Quick tasks, bug fixes |
| medium | 4-5 | 2 | Features, refactors |
| deep | 6-8 | 3+ | Architecture, unfamiliar domains |

## Elements of Thought (Quick Reference)

| Element | Ask Yourself |
|---------|-------------|
| Purpose | What are we REALLY trying to achieve? |
| Question at Issue | What SPECIFIC problem are we solving? |
| Assumptions | What are we TAKING FOR GRANTED? |
| Point of View | Whose PERSPECTIVE are we missing? |
| Information | What DATA do we have or need? |
| Concepts | What DOMAIN PRINCIPLES apply? |
| Inferences | Are our CONCLUSIONS justified? |
| Implications | What are the SECOND-ORDER EFFECTS? |
