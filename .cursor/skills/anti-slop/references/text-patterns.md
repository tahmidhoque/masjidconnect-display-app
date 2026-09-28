# Text Slop Patterns

Catalog of natural-language patterns that signal generic AI-generated writing.

## High-Confidence Slop (remove or rewrite)

### Filler openers and preambles

| Pattern | Example | Cleanup |
|---------|---------|---------|
| Delve phrases | "Let's delve into…" | Delete or use "examine", "look at" |
| Fast-paced world | "In today's fast-paced world…" | Delete entirely |
| Landscape framing | "In the ever-evolving landscape of…" | Start with the subject |
| Journey metaphors | "Embark on a journey to…" | State the goal directly |
| Meta-commentary | "This article will explore…" | Delete; start with content |

### Hedge stacks

| Pattern | Example | Cleanup |
|---------|---------|---------|
| Important to note | "It's important to note that…" | Delete |
| Worth mentioning | "It's worth mentioning that…" | Delete |
| Crucial to understand | "It's crucial to understand…" | Delete or state the fact |
| Needless to say | "Needless to say…" | Delete (contradicts itself) |

### Buzzword substitutions

| Slop | Replacement |
|------|-------------|
| leverage | use |
| utilise / utilize | use |
| synergistic | cooperative, combined |
| paradigm shift | major change |
| holistic | complete, whole |
| robust | strong, reliable (or be specific) |
| seamless | smooth (or describe how) |
| cutting-edge | new, recent (or name the tech) |
| game-changer | significant (or explain why) |
| empower | enable, help |
| unlock | enable, open |
| elevate | improve, raise |
| foster | encourage, build |
| spearhead | lead |
| navigate (complexities) | handle, manage |
| tapestry (of) | mix, range (or delete) |
| realm | area, field |
| delve | examine, study |
| multifaceted | complex, varied |
| pivotal | key, central |

### Wordy constructions

| Slop | Replacement |
|------|-------------|
| in order to | to |
| due to the fact that | because |
| has the ability to | can |
| at this point in time | now |
| in the event that | if |
| for the purpose of | to, for |
| with regard to | about, on |
| in terms of | for, regarding (or delete) |
| a large number of | many |
| the vast majority of | most |

### Empty intensifiers

- very, really, extremely, incredibly, absolutely (when they add no precision)
- truly, deeply, profoundly (without specific meaning)
- Stacked adjectives: "rich, vibrant, dynamic ecosystem"

### Structural tells

- Every paragraph starts the same way (Moreover, Furthermore, Additionally)
- Uniform sentence length (all medium-length)
- Bullet lists where every item starts with a verb in the same form
- Conclusion that restates the introduction verbatim
- Rhetorical questions as section headers

## Medium-Confidence Slop (context-dependent)

| Pattern | When acceptable |
|---------|-----------------|
| "Furthermore" / "Moreover" | Academic papers with formal transitions |
| Passive voice | Scientific writing, when actor is unknown |
| Hedging ("may", "might") | Speculation, medical/legal content |
| "Solutions" as a noun | Actual software product category |
| "Best practices" | Technical documentation (prefer naming the practice) |

## Detection Signals

**High slop density indicators:**
- 3+ buzzwords per paragraph
- Opening paragraph contains no concrete nouns
- No specific numbers, names, dates, or examples
- Abstract nouns outnumber concrete nouns 3:1

**Authentic writing signals:**
- Named entities (people, products, places)
- Specific metrics or timeframes
- Varied sentence rhythm
- Occasional short sentences for emphasis
- Opinion or stance (when appropriate)

## Cleanup Strategies

1. **Delete first** — Remove filler openers and meta-commentary before rewriting
2. **Replace buzzwords** — One pass with substitution table above
3. **Shorten** — Collapse wordy phrases
4. **Specify** — Replace "things", "items", "aspects" with concrete nouns
5. **Lead with point** — Move the thesis to the first sentence
6. **Read aloud** — Slop often sounds unnatural when spoken

## Scoring Weights (used by detect_slop.py)

| Category | Weight |
|----------|--------|
| High-risk phrases | 8 pts each |
| Buzzwords | 4 pts each |
| Wordy constructions | 3 pts each |
| Hedge stacks | 5 pts each |
| Empty intensifiers | 2 pts each |
| Structural tells | 6 pts each |

Score normalises to 0–100 based on text length and pattern density.
