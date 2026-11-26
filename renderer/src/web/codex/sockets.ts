// Socket colours: chances of Chromatic Orbs and crafting bench recipes, PoE 1 3.29+.
//
// The model is Siveran's Vorici Chromatic Calculator (CC0), https://siveran.github.io/calc.html,
// https://github.com/Siveran/siveran.github.io (src/Main.ts). Its constants come from crowd-sourced
// socket data. Since 3.29 sockets are white by default and only have a chance to be coloured,
// which grows with item level and quality.

export interface Colors {
  r: number
  g: number
  b: number
  w: number
}

export type Reqs = [str: number, dex: number, int: number]

const ZERO: Colors = { r: 0, g: 0, b: 0, w: 0 }

// [(Requirement + X + C) / (Requirement + 3X + C)] for the on-colour of a single requirement item
const X = 5
const C = 5
// what the on-colour chance approaches with very high requirements
const MAX_ON_COLOR = 0.9

// Chances of red / green / blue for a coloured socket (white not included, they sum to 1).
export function colorChances ([str, dex, int]: Reqs): Colors {
  const reqs = [str, dex, int].map(x => Math.max(0, x))
  const total = reqs[0] + reqs[1] + reqs[2]
  const count = reqs.filter(x => x > 0).length
  let chance: (req: number) => number
  if (count === 0) {
    chance = () => 1 / 3
  } else if (count === 1) {
    chance = req => req > 0
      ? MAX_ON_COLOR * (X + C + req) / (total + 3 * X + C)
      : (1 - MAX_ON_COLOR) / 2 + MAX_ON_COLOR * (X / (total + 3 * X + C))
  } else if (count === 2) {
    chance = req => req > 0 ? MAX_ON_COLOR * req / total : 1 - MAX_ON_COLOR
  } else {
    chance = req => req / total
  }
  return { r: chance(reqs[0]), g: chance(reqs[1]), b: chance(reqs[2]), w: 0 }
}

// chance of one socket to be white (3.29+)
export function whiteChance (itemLevel: number, quality: number): number {
  const white = 1 - 0.00375 * Math.max(itemLevel - 14, 1) * (1 + Math.min(Math.max(quality, 0), 30) / 100)
  return Math.min(1, Math.max(0, white))
}

export function dilute (rgb: Colors, white: number): Colors {
  const colored = 1 - white
  return { r: rgb.r * colored, g: rgb.g * colored, b: rgb.b * colored, w: white }
}

// ---- recipes ----

export type RecipeKey = 'drop' | 'chromatic' | 'nonwhite2' | 'nonwhite3' | 'nonwhite4' | 'trichromatism' | 'tainted'

interface Recipe {
  key: RecipeKey
  // colours it gives for sure
  forced: Colors
  // sockets it makes non-white (of a random colour)
  nonWhite: number
  // in Chromatic Orbs; null = not paid with Chromatic Orbs
  cost: number | null
}

const RECIPES: Recipe[] = [
  { key: 'drop', forced: ZERO, nonWhite: 0, cost: null },
  { key: 'chromatic', forced: ZERO, nonWhite: 1, cost: 1 },
  { key: 'nonwhite2', forced: ZERO, nonWhite: 2, cost: 5 },
  { key: 'nonwhite3', forced: ZERO, nonWhite: 3, cost: 20 },
  { key: 'nonwhite4', forced: ZERO, nonWhite: 4, cost: 75 },
  // Omen of Trichromatism: the next Chromatic Orb gives at least one red, green and blue
  { key: 'trichromatism', forced: { r: 1, g: 1, b: 1, w: 0 }, nonWhite: 0, cost: null },
  // colours are not weighted by the attribute requirements
  { key: 'tainted', forced: ZERO, nonWhite: 1, cost: null }
]

export interface RecolorInput {
  reqs: Reqs
  sockets: number
  // the colours wanted, the rest of the sockets can be anything
  want: Colors
  itemLevel: number
  quality: number
}

export interface RecolorOption {
  key: RecipeKey
  // of one try
  chance: number
  // average tries
  tries: number
  // average cost in Chromatic Orbs, null = not paid with them
  cost: number | null
  costPerTry: number | null
}

const FACT = [1, 1, 2, 6, 24, 120, 720]
const fact = (n: number) => FACT[n] ?? Infinity

// chance of these exact counts of colours, `rgbOnly` of them from the sockets that can't be white
function targetChance (full: Colors, rgb: Colors, target: Colors, rgbOnly: Colors): number {
  const rgbOnlyTotal = rgbOnly.r + rgbOnly.g + rgbOnly.b
  const rgbOnlyShuffles = fact(rgbOnlyTotal) / (fact(rgbOnly.r) * fact(rgbOnly.g) * fact(rgbOnly.b))
  const total = target.r + target.g + target.b + target.w
  const shuffles = fact(total) / (fact(target.r) * fact(target.g) * fact(target.b) * fact(target.w))
  const normal = full.r ** target.r * full.g ** target.g * full.b ** target.b * full.w ** target.w
  const forced = rgb.r ** rgbOnly.r * rgb.g ** rgbOnly.g * rgb.b ** rgbOnly.b
  return rgbOnlyShuffles * shuffles * normal * forced
}

// Sum of the chances of every final set of colours that has the wanted ones:
// `free` sockets can be any colour, `rgbOnly` of the counted ones can't be white.
// The branches keep RGGB and RGBG from being counted twice.
function multinomial (
  full: Colors, rgb: Colors, target: Colors, free: number, freeBranch = 1,
  rgbOnly = 0, rgbOnlyBranch = 1, rgbOnlyTarget: Colors = ZERO,
  leaf: (target: Colors, rgbOnlyTarget: Colors) => number = (t, o) => targetChance(full, rgb, t, o)
): number {
  const next = (t: Colors, f: number, fb: number, ro: number, rob: number, rot: Colors) =>
    multinomial(full, rgb, t, f, fb, ro, rob, rot, leaf)
  if (free > 0) {
    return (freeBranch <= 1 ? next({ ...target, r: target.r + 1 }, free - 1, 1, rgbOnly, 1, rgbOnlyTarget) : 0) +
      (freeBranch <= 2 ? next({ ...target, g: target.g + 1 }, free - 1, 2, rgbOnly, 1, rgbOnlyTarget) : 0) +
      (freeBranch <= 3 ? next({ ...target, b: target.b + 1 }, free - 1, 3, rgbOnly, 1, rgbOnlyTarget) : 0) +
      next({ ...target, w: target.w + 1 }, free - 1, 4, rgbOnly, 1, rgbOnlyTarget)
  }
  if (rgbOnly > 0) {
    // which of the counted sockets are the ones that can't be white
    return (rgbOnlyBranch <= 1 && target.r > 0 ? next({ ...target, r: target.r - 1 }, free, 0, rgbOnly - 1, 1, { ...rgbOnlyTarget, r: rgbOnlyTarget.r + 1 }) : 0) +
      (rgbOnlyBranch <= 2 && target.g > 0 ? next({ ...target, g: target.g - 1 }, free, 0, rgbOnly - 1, 2, { ...rgbOnlyTarget, g: rgbOnlyTarget.g + 1 }) : 0) +
      (rgbOnlyBranch <= 3 && target.b > 0 ? next({ ...target, b: target.b - 1 }, free, 0, rgbOnly - 1, 3, { ...rgbOnlyTarget, b: rgbOnlyTarget.b + 1 }) : 0)
  }
  return leaf(target, rgbOnlyTarget)
}

// A Chromatic Orb can't give the same colours again, so a roll that would repeat is free:
// the chance that two rolls in a row give the same outcome.
function repeatChance (full: Colors, rgb: Colors, sockets: number, rgbOnly: number): number {
  return multinomial(full, rgb, ZERO, sockets, 1, rgbOnly, 1, ZERO, (target, rgbOnlyTarget) => {
    const all: Colors = {
      r: target.r + rgbOnlyTarget.r,
      g: target.g + rgbOnlyTarget.g,
      b: target.b + rgbOnlyTarget.b,
      w: target.w
    }
    const unordered = targetChance(full, rgb, target, rgbOnlyTarget)
    const sameOrder = (fact(all.r) * fact(all.g) * fact(all.b) * fact(all.w)) / fact(all.r + all.g + all.b + all.w)
    return unordered * unordered * sameOrder
  })
}

const TAINTED: Colors = { r: 1 / 3, g: 1 / 3, b: 1 / 3, w: 0 }

// The ways to get the wanted colours that can work for this item, with their chances.
export function recolorOptions (input: RecolorInput): RecolorOption[] {
  const { sockets, want } = input
  const wanted = want.r + want.g + want.b
  if (sockets < 1 || sockets > 6 || wanted < 1 || wanted > sockets || input.itemLevel < 1) return []
  const rgb = colorChances(input.reqs)
  const white = whiteChance(input.itemLevel, input.quality)
  const full = dilute(rgb, white)

  const out: RecolorOption[] = []
  for (const recipe of RECIPES) {
    const fits = recipe.nonWhite <= sockets &&
      recipe.forced.r <= want.r && recipe.forced.g <= want.g && recipe.forced.b <= want.b
    if (!fits && !(recipe.key === 'trichromatism' && sockets >= 3)) continue

    const rest: Colors = {
      r: Math.max(0, want.r - recipe.forced.r),
      g: Math.max(0, want.g - recipe.forced.g),
      b: Math.max(0, want.b - recipe.forced.b),
      w: 0
    }
    let free = sockets - wanted
    if (recipe.key === 'trichromatism') {
      // the colours it gives that are not wanted take sockets we don't care about
      free -= (want.r === 0 ? 1 : 0) + (want.g === 0 ? 1 : 0) + (want.b === 0 ? 1 : 0)
      if (free < 0) continue
    }
    // a Chromatic Orb makes a socket coloured only when all of them roll white:
    // that helps only when one coloured socket is wanted
    const rgbOnly = (recipe.key === 'chromatic' || recipe.key === 'tainted') && wanted > 1 ? 0 : recipe.nonWhite
    const chances = recipe.key === 'tainted' ? dilute(TAINTED, white) : full
    const rgbChances = recipe.key === 'tainted' ? TAINTED : rgb
    let chance = multinomial(chances, rgbChances, rest, free, 1, rgbOnly)

    if (recipe.key === 'chromatic') {
      const collision = repeatChance(full, rgb, sockets, 0)
      const allWhite = full.w ** sockets
      const collisionOnGuaranteed = allWhite * repeatChance(full, rgb, sockets, 1)
      const totalCollision = collision + (1 - collision) * collisionOnGuaranteed
      chance = 1 - (1 - chance) ** (1 / (1 - Math.min(totalCollision, 1 - chance)))
    }
    chance = Math.min(1, Math.max(0, chance))
    if (!(chance > 0)) continue
    out.push({
      key: recipe.key,
      chance,
      tries: 1 / chance,
      cost: recipe.cost == null ? null : recipe.cost / chance,
      costPerTry: recipe.cost
    })
  }
  return out
}

// the cheapest way paid with Chromatic Orbs
export function bestOption (options: RecolorOption[]): RecolorOption | null {
  return options.filter(o => o.cost != null).sort((a, b) => a.cost! - b.cost!)[0] ?? null
}

// `R-G-B W` -> colours of the sockets that can be recoloured (abyssal and others are left out)
export function parseSockets (text: string | undefined): Array<'R' | 'G' | 'B' | 'W'> {
  return (text ?? '').toUpperCase().split('').filter((c): c is 'R' | 'G' | 'B' | 'W' => 'RGBW'.includes(c))
}
