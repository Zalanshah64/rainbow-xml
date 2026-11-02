import * as vscode from 'vscode';
import { resolveOverrides, resolvePalette, ThemedColor } from './palette';

export const SECTION = 'rainbowXml';

export interface RainbowConfig {
  enabled: boolean;
  palette: readonly ThemedColor[];
  colorBrackets: boolean;
  colorAttributes: boolean;
  overrides: Map<string, string>;
  languages: ReadonlySet<string>;
}

export function readConfig(): RainbowConfig {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  const languages = cfg.get<unknown>('languages');
  return {
    enabled: cfg.get<boolean>('enabled', true),
    palette: resolvePalette(cfg.get<unknown>('palette')),
    colorBrackets: cfg.get<boolean>('colorBrackets', false),
    colorAttributes: cfg.get<boolean>('colorAttributes', true),
    overrides: resolveOverrides(cfg.get<unknown>('overrides')),
    languages: new Set(
      Array.isArray(languages) ? languages.filter((l): l is string => typeof l === 'string') : ['xml'],
    ),
  };
}
