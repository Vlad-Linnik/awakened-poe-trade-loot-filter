// Visual style of a filter block (what FilterBlade lets you edit per tier)

import type { FilterLine } from './filter-parser'

export interface RGBA { r: number, g: number, b: number, a: number }

export interface FilterStyle {
  fontSize: number | null
  text: RGBA | null
  border: RGBA | null
  background: RGBA | null
  // built-in sound (id 1..16 or a name) or a custom sound file from the filter folder
  sound: { id: string, volume: number, positional: boolean, custom?: string | null, optional?: boolean } | null
  // the item drop sound (off = DisableDropSound)
  dropSound: boolean
  minimap: { size: number, color: string, shape: string } | null
  effect: { color: string, temp: boolean } | null
}

export const STYLE_KEYWORDS = [
  'SetFontSize', 'SetTextColor', 'SetBorderColor', 'SetBackgroundColor',
  'PlayAlertSound', 'PlayAlertSoundPositional', 'CustomAlertSound', 'CustomAlertSoundOptional',
  'DisableDropSound', 'MinimapIcon', 'PlayEffect'
] as const

export const EFFECT_COLORS = ['Red', 'Green', 'Blue', 'Brown', 'White', 'Yellow', 'Cyan', 'Grey', 'Orange', 'Pink', 'Purple']
export const ICON_SHAPES = ['Circle', 'Diamond', 'Hexagon', 'Square', 'Star', 'Triangle', 'Cross', 'Moon', 'Raindrop', 'Kite', 'Pentagon', 'UpsideDownHouse']

// in-game defaults when the block doesn't set them
export const DEFAULT_TEXT: RGBA = { r: 200, g: 200, b: 200, a: 255 }
export const DEFAULT_BACKGROUND: RGBA = { r: 0, g: 0, b: 0, a: 240 }

export function styleFromActions (actions: FilterLine[]): FilterStyle {
  const style: FilterStyle = {
    fontSize: null, text: null, border: null, background: null, sound: null, minimap: null, effect: null, dropSound: true
  }
  for (const a of actions) {
    const v = a.values
    switch (a.keyword) {
      case 'SetFontSize': style.fontSize = Number(v[0]); break
      case 'SetTextColor': style.text = rgba(v); break
      case 'SetBorderColor': style.border = rgba(v); break
      case 'SetBackgroundColor': style.background = rgba(v); break
      case 'PlayAlertSound':
      case 'PlayAlertSoundPositional':
        style.sound = { id: v[0] ?? '1', volume: v[1] != null ? Number(v[1]) : 300, positional: a.keyword === 'PlayAlertSoundPositional' }
        break
      case 'CustomAlertSound':
      case 'CustomAlertSoundOptional':
        style.sound = {
          id: '1',
          volume: v[1] != null ? Number(v[1]) : 300,
          positional: false,
          custom: v[0] ?? '',
          optional: a.keyword === 'CustomAlertSoundOptional'
        }
        break
      case 'DisableDropSound': style.dropSound = false; break
      case 'MinimapIcon':
        if (v[0] !== '-1') style.minimap = { size: Number(v[0]), color: v[1] ?? 'White', shape: v[2] ?? 'Circle' }
        break
      case 'PlayEffect':
        if (v[0] !== 'None') style.effect = { color: v[0] ?? 'White', temp: v[1] === 'Temp' }
        break
    }
  }
  return style
}

// keyword -> full action line (null = remove the action)
export function styleToActions (style: FilterStyle): Record<string, string | null> {
  return {
    SetFontSize: style.fontSize != null ? `SetFontSize ${clamp(Math.round(style.fontSize), 1, 45)}` : null,
    SetTextColor: style.text ? `SetTextColor ${rgbaStr(style.text)}` : null,
    SetBorderColor: style.border ? `SetBorderColor ${rgbaStr(style.border)}` : null,
    SetBackgroundColor: style.background ? `SetBackgroundColor ${rgbaStr(style.background)}` : null,
    PlayAlertSound: (style.sound && !style.sound.custom && !style.sound.positional) ? `PlayAlertSound ${style.sound.id} ${clamp(Math.round(style.sound.volume), 0, 300)}` : null,
    PlayAlertSoundPositional: (style.sound && !style.sound.custom && style.sound.positional) ? `PlayAlertSoundPositional ${style.sound.id} ${clamp(Math.round(style.sound.volume), 0, 300)}` : null,
    CustomAlertSound: (style.sound?.custom && !style.sound.optional) ? `CustomAlertSound "${style.sound.custom}" ${clamp(Math.round(style.sound.volume), 0, 300)}` : null,
    CustomAlertSoundOptional: (style.sound?.custom && style.sound.optional) ? `CustomAlertSoundOptional "${style.sound.custom}" ${clamp(Math.round(style.sound.volume), 0, 300)}` : null,
    DisableDropSound: style.dropSound ? null : 'DisableDropSound',
    MinimapIcon: style.minimap ? `MinimapIcon ${style.minimap.size} ${style.minimap.color} ${style.minimap.shape}` : null,
    PlayEffect: style.effect ? `PlayEffect ${style.effect.color}${style.effect.temp ? ' Temp' : ''}` : null
  }
}

export function styleCss (style: FilterStyle, hidden: boolean): Record<string, string> {
  const text = style.text ?? DEFAULT_TEXT
  const bg = style.background ?? DEFAULT_BACKGROUND
  const css: Record<string, string> = {
    color: cssColor(text),
    background: cssColor(bg),
    border: style.border ? `2px solid ${cssColor(style.border)}` : '2px solid transparent',
    fontSize: `${clamp((style.fontSize ?? 32) * 0.5, 12, 26)}px`
  }
  if (hidden) css.opacity = '0.45'
  return css
}

export function toHex (c: RGBA) {
  return '#' + [c.r, c.g, c.b].map(n => n.toString(16).padStart(2, '0')).join('')
}

export function fromHex (hex: string, alpha: number): RGBA {
  const n = parseInt(hex.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: alpha }
}

function rgba (v: string[]): RGBA {
  const [r, g, b, a] = v.map(Number)
  return { r: r || 0, g: g || 0, b: b || 0, a: Number.isFinite(a) ? a : 255 }
}

function rgbaStr (c: RGBA) {
  return `${c.r} ${c.g} ${c.b} ${c.a}`
}

function cssColor (c: RGBA) {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a / 255})`
}

function clamp (n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}
