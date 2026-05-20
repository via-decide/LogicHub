# Constraint Library Spec (Phase 1.3)

## Constraint Taxonomy

### Visual
- Monochrome Density
- Scanline Rendering
- Game Boy Look
- Glitch Corruption
- Neon Palette
- Minimalist Grid
- Vintage CRT
- Pixel Bloom

### Interaction
- Delayed Feedback
- Mechanical Response
- Lonely Interaction
- Glitchy Behavior
- Tactile Resistance
- Async Timing
- One-action-at-a-time

### Temporal
- Slow Pulse
- Stutter Rhythm
- Delayed Cascade
- Fractured Tempo
- Silent Pause
- Double-time Jitter

### Emotional
- Melancholic
- Mechanical
- Playful
- Eerie
- Nostalgic
- Lonely
- Tense

## Mixing Rules

### High-synergy pairings
- Scanline Rendering + Nostalgic + Slow Pulse
- Monochrome Density + Lonely Interaction + Silent Pause
- Glitch Corruption + Fractured Tempo + Tense
- Game Boy Look + Playful + Stutter Rhythm
- Vintage CRT + Delayed Feedback + Melancholic

### Contradictory pairings (use intentionally)
- Minimalist Grid + Glitch Corruption (order vs fracture)
- Playful + Silent Pause (energy vs suspension)
- Neon Palette + Melancholic (brightness vs mood)

### Guardrails
- Recommend 1 primary visual, up to 2 interaction, 1 temporal, 1 emotional.
- Warn when >2 temporal constraints are selected.
- Warn when emotional set contains both Playful and Tense unless user confirms.

## Constraint Selector UI
- Grid grouped by four constraint families.
- Each tile shows icon, label, and “feeling impact” sentence.
- Hover preview: before/after mini animation.
- Selection summary panel: “This combination feels ___.”
- Zayvora suggestion strip: 3 mutation recommendations.

## Rename Map (UI language migration)
- Color palette → Visual constraint
- Animation speed → Temporal constraint
- User experience → Interaction constraint
- Theme/mood → Emotional constraint

## Deliverable Notes
- Provide before/after visual examples for every constraint.
- Include compatibility matrix with “works well / risky / contradictory.”
- Expose selector as reusable artifact-creation component.
