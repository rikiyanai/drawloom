import type { PoseResult } from '../pose/detect';

export type PortraitPose = NonNullable<PoseResult>;
export type PortraitSettings = { rows: number; detail: number; hair: number; tone: number; exposure: number };
export const DEFAULT_PORTRAIT: PortraitSettings = { rows: 48, detail: .55, hair: .5, tone: .25, exposure: 0 };
export type NativeGlyph = { x: number; row: number; text: string; owner: string };
export type NativePortrait = {
  schema: 'drawloom.native-portrait.v1'; width: number; height: number; rows: string[];
  glyphs: NativeGlyph[]; groups: { id: string; role: string; marks: number }[];
  conflicts: number; crop: { x: number; y: number; width: number; height: number };
  sourceSize: { width: number; height: number }; settings: PortraitSettings;
};
export type PortraitSource = { name: string; dataUrl: string; pose: PortraitPose };
export const FONT_PROFILE = { family: 'Saitamaar', fontSha256: '592bf6be803ed76311841b95a10b20db3df0ec693a15f858757d47420b9b3a28', fontPx: 16, rowPitchPx: 17, spacing: 'saitamaar-unicode-pixel-v1' };

export function checkedSettings(value: unknown): PortraitSettings {
  const v = value as Partial<PortraitSettings>;
  if (!v || !Number.isInteger(v.rows) || v.rows! < 28 || v.rows! > 90 ||
    ![v.detail, v.hair, v.tone].every(x => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1) ||
    typeof v.exposure !== 'number' || !Number.isFinite(v.exposure) || Math.abs(v.exposure) > 1) throw Error('Invalid portrait settings.');
  return { rows: v.rows!, detail: v.detail!, hair: v.hair!, tone: v.tone!, exposure: v.exposure };
}
