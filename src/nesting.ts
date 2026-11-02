// Pure nesting logic: no VS Code imports, so it can be unit tested with plain Node.
import { scan, ScanOptions, TagMatch } from './scanner';

export interface NestedTag extends TagMatch {
  /** How many elements this tag sits inside. The root element is 0. */
  depth: number;
}

/** The open elements at the start of a line, outermost first. */
export interface Checkpoint {
  line: number;
  stack: readonly string[];
}

/** Tracks which elements are open while walking tags in document order. */
export class Nesting {
  private readonly stack: string[];

  constructor(stack: readonly string[] = []) {
    this.stack = [...stack];
  }

  snapshot(): readonly string[] {
    return [...this.stack];
  }

  /** Returns the depth of this tag and updates the open elements. */
  enter(tag: TagMatch): number {
    switch (tag.kind) {
      case 'open':
        this.stack.push(tag.name);
        return this.stack.length - 1;
      case 'selfClosing':
        return this.stack.length;
      case 'close': {
        // Close back to the nearest element with this name, so one unclosed
        // tag doesn't shift every color after it.
        const i = this.stack.lastIndexOf(tag.name);
        if (i === -1) {
          return Math.max(0, this.stack.length - 1); // stray closing tag: leave the stack alone
        }
        this.stack.length = i;
        return i;
      }
    }
  }
}

/**
 * Scans lines starting from a known set of open elements. Returns every tag
 * with its depth, plus checkpoints (about one per `safeLineEvery` lines)
 * where a later scan can resume. Checkpoint lines are relative to `lines`.
 */
export function scanNested(
  lines: readonly string[],
  startStack: readonly string[] = [],
  options: ScanOptions = {},
): { tags: NestedTag[]; checkpoints: Checkpoint[] } {
  const { tags, safeLines } = scan(lines, options);
  const nesting = new Nesting(startStack);
  const nested: NestedTag[] = new Array(tags.length);
  const checkpoints: Checkpoint[] = [];
  let s = 0;
  for (let i = 0; i <= tags.length; i++) {
    for (; s < safeLines.length && safeLines[s].tagsBefore === i; s++) {
      checkpoints.push({ line: safeLines[s].line, stack: nesting.snapshot() });
    }
    if (i < tags.length) {
      nested[i] = { ...tags[i], depth: nesting.enter(tags[i]) };
    }
  }
  return { tags: nested, checkpoints };
}
