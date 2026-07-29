import type { PhysicalKitDefinition } from '@logichub-engineering/kit-matching';
import type {
  ChecklistItem,
  ChecklistOutcome,
  ChecklistResponse,
} from '../schemas/loop.schema.js';

/**
 * Checks that apply to any kit before power is first applied. These are
 * blocking: none of them is optional.
 */
const UNIVERSAL_CHECKS: readonly Omit<ChecklistItem, 'sourceStep'>[] = [
  {
    id: 'prepower.polarity',
    prompt: 'Confirm supply polarity at every connector before connecting the pack.',
    blocking: true,
  },
  {
    id: 'prepower.shorts',
    prompt: 'Confirm no exposed conductor touches another, and no strand bridges two pads.',
    blocking: true,
  },
  {
    id: 'prepower.supply-range',
    prompt: 'Confirm the pack voltage sits inside the range every powered part accepts.',
    blocking: true,
  },
  {
    id: 'prepower.mechanical-clear',
    prompt: 'Confirm moving parts are clear of hands, cables and the work surface.',
    blocking: true,
  },
  {
    id: 'prepower.disconnect-usb',
    prompt: 'Confirm the board is not powered from USB and the pack at the same time.',
    blocking: true,
  },
];

/**
 * Build the pre-power checklist for a kit.
 *
 * The universal checks come first, then every caution the kit's own assembly
 * steps carry — a caution written into an assembly step is something that can
 * hurt someone or damage hardware, so it becomes a blocking check rather than
 * advice buried in a paragraph.
 */
export function buildPrePowerChecklist(kit: PhysicalKitDefinition): ChecklistItem[] {
  const items: ChecklistItem[] = UNIVERSAL_CHECKS.map(check => ({ ...check, sourceStep: null }));

  for (const step of kit.assemblySteps) {
    step.cautions.forEach((caution, index) => {
      items.push({
        id: `prepower.step-${step.order}.caution-${index + 1}`,
        prompt: caution,
        sourceStep: step.order,
        blocking: true,
      });
    });
  }

  return items;
}

/**
 * Evaluate responses against the checklist.
 *
 * The checklist fails closed. An item nobody answered blocks power exactly as
 * a failed item does — silence is not consent, and an unrun check is not a
 * passed check.
 */
export function evaluateChecklist(
  items: readonly ChecklistItem[],
  responses: Readonly<Record<string, ChecklistResponse>>,
): ChecklistOutcome {
  const failedItemIds: string[] = [];
  const uncheckedItemIds: string[] = [];

  for (const item of items) {
    const response = responses[item.id] ?? 'NOT_CHECKED';
    if (response === 'FAIL') failedItemIds.push(item.id);
    else if (response === 'NOT_CHECKED') uncheckedItemIds.push(item.id);
  }

  failedItemIds.sort();
  uncheckedItemIds.sort();

  const blockingFailed = items.some(
    i => i.blocking && failedItemIds.includes(i.id),
  );
  const blockingUnchecked = items.some(
    i => i.blocking && uncheckedItemIds.includes(i.id),
  );

  const clearedForPower = !blockingFailed && !blockingUnchecked;

  return {
    clearedForPower,
    failedItemIds,
    uncheckedItemIds,
    summary: buildSummary(items.length, failedItemIds.length, uncheckedItemIds.length),
  };
}

function buildSummary(total: number, failed: number, unchecked: number): string {
  if (failed === 0 && unchecked === 0) {
    return `All ${total} pre-power checks passed.`;
  }
  const parts: string[] = [];
  if (failed > 0) parts.push(`${failed} failed`);
  if (unchecked > 0) parts.push(`${unchecked} not checked`);
  return (
    `Not cleared for power: ${parts.join(', ')} of ${total} checks. `
    + 'An unchecked item blocks power exactly as a failed one does.'
  );
}
