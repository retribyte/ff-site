# Building a race for the portrait creator

Starbound gives a race hair plus two more style choices, facial hair and a facial mask, all
drawn on the head. The portrait creator (`/portraits`) can do more: **any number of style
layers**, each drawing on the head, the body and both arms, and a **clothing fit** for races
built shorter or wider than the standard humanoid.

> Both are extra keys in your `.species` file. The game ignores keys it does not know, so your
> mod works in Starbound exactly as before. These layers show up in the portrait creator only,
> never in the game.

Hair, facial hair and facial masks keep working as they do in Starbound
(`headOptionAsFacialhair`, `altOptionAsFacialMask` and the rest). The keys below come on top of
them.

For developers: the creator reads these keys in `src/lib/portrait/species.ts` and draws them in
`humanoid.ts` and `compose.ts`. Keep this file in step with them.

## Style layers: `ffLayers`

A list at the top level of the species file. Each entry is one more set of choices in the
creator's Body tab. A gender can have its own `ffLayers` list too: an entry there with the same
`id` changes that layer for that gender only (only the keys it gives), and a new `id` adds a
layer.

| Key | What it does | Default |
|---|---|---|
| `id` | Required. Letters, digits, `_` and `-`. Saved portraits remember picks by it, so keep it once published. Not `hair`, `facialHair` or `facialMask`. | |
| `label` | The heading in the creator. | the id |
| `group` | Folder under `/humanoid/<species>/` holding the styles. | the id |
| `options` | The style names in the order shown; `""` is "none". The first is what a new portrait starts with, so put `""` first for an optional layer. | none, then every style folder found, in name order |
| `color` | Which colours recolour it (a name or a list, applied in order): `body`, `hair`, `undy` (the alt/detail colour), `facialMask`, `own` (its own palette, picked on its own) or `none`. | `body` |
| `colors` | The palette for `own`: a list of colour options, written like `bodyColor`. | |
| `stack` | `true` lets a portrait wear several styles of this layer at once, drawn in the order picked. | `false` |
| `masked` | `true` cuts the head part with the helmet's mask, as hair is cut. Leave it off for things painted on the skin. | `false` |
| `above` | Where each part is drawn, e.g. `{ "head": "hair" }`. See [Layer order](#layer-order). | just above the part it covers |

### The sprite files

Each style is a folder, with one sheet for each body part it covers:

```
humanoid/squoat/
  malebody.png  malehead.png  frontarm.png  backarm.png  ...   (the race itself)
  markings/
    stripes/
      head.png        drawn over the head
      body.png        over the body
      frontarm.png    over the front arm
      backarm.png     over the back arm
    belly/
      body.png        a style needs only the parts it covers
      femalebody.png  a gender's own sheet wins over the shared one
  horns/
    small/head.png
    curled/head.png
```

- **Lay each sheet out exactly like the race's own sheet for that part**: same size, same frames
  in the same places. The simplest way is to copy `malebody.png` (or `frontarm.png`, ...), draw
  the marking over every frame, then erase the body. The creator cuts frames from your sheet with
  the body part's own `.frames` file, so the marking follows every pose. Your style folder needs
  no `.frames` file.
- **Draw every pose the race uses**: at least the five idle frames (`idle.1` to `idle.5`) of the
  body and both arms, since the creator's poses are made of them, and the head's `normal` frame.
  A pose whose frame you leave empty simply shows no marking in that pose; nothing warns you.
- File names are `head.png`, `body.png`, `frontarm.png` and `backarm.png`. A gendered name
  (`femalebody.png`, using the gender's `name`) wins over the plain one for that gender.
- A style is offered only if at least one of its sheets exists.

### Colours

Colour options are Starbound's palette swaps: `{ "402010": "20a040" }` turns every pixel of
#402010 into #20a040. So to follow the player's pick, draw the marking in the source colours of
the palette you name. For `"color": "undy"`, use the colours that are keys in your `undyColor`
options. Pixels in any other colour keep the colour you drew them in. Members can still change
any colour by hand in the Colours tab.

### Layer order

From back to front, the portrait is drawn in this order:

```
backArm, backSleeve, back, head, emote, (hair), body, legs, chest,
(facialHair, facialMask), headwear, frontArm, frontSleeve
```

A layer's part goes just above the body part it covers: the head part above `head` (under the
eyes and hair), the body part above `body` (under clothing), each arm part above its arm. Set
`above` for a part to put it over something else, for example `"above": { "head": "hair" }` for
horns over the hair, or `{ "body": "chest" }` for something worn over the shirt. Any name in the
list works, and so does another layer's `id`. Layers placed above the same thing stack in the
order they are listed.

## Clothing fit: `ffClothingFit`

Clothing is drawn for the standard humanoid body. If your race is shorter, taller, wider or
narrower, this moves and stretches every piece of clothing it wears, in the portrait creator
only. One rule per clothing sprite: `headwear`, `chest`, `frontSleeve`, `backSleeve`, `legs`,
`back`. Each rule takes any of:

| Key | What it does |
|---|---|
| `offset` | `[x, y]` in pixels; y counts up, so `[0, -2]` moves it down 2. |
| `columns` | `{ "at": 21, "add": 2 }` repeats column 21 of the frame twice more, making the sprite 2 pixels wider; a negative `add` removes that many columns starting at `at`. The sprite stays centred: what is left of the column moves left by half, the rest right. |
| `rows` | The same with rows, counted from the top of the frame. Everything below the changed rows stays where it was; everything above moves up (adding) or down (removing). |

Columns and rows count from the top-left of the 43 by 43 frame, as an image editor shows it.
Resizing happens first, then the move. A helmet's mask moves and resizes with the helmet. A
gender can carry its own `ffClothingFit`; each of its rules replaces the species' rule for that
sprite.

(Starbound's `headArmorOffset`, `chestArmorOffset` and so on in `humanoid.config` are anchor
points for effects; they don't move clothing sprites, so the creator doesn't read them.)

## An example

```json
{
  "kind": "squoat",
  "genders": [
    { "name": "male", "hair": ["", "1", "2"] },
    { "name": "female", "hair": ["", "1", "2"] }
  ],

  "ffLayers": [
    { "id": "markings", "label": "Markings", "color": "undy", "stack": true },
    { "id": "horns", "label": "Horns", "color": "own", "masked": true,
      "options": ["", "small", "curled"],
      "colors": [ { "ffffff": "f0f0e0" }, { "ffffff": "d0a050" } ] }
  ],

  "ffClothingFit": {
    "headwear": { "offset": [0, -2] },
    "chest": { "offset": [0, -2], "columns": { "at": 21, "add": 2 } },
    "frontSleeve": { "offset": [1, -2] },
    "backSleeve": { "offset": [-1, -2] },
    "legs": { "rows": { "at": 34, "add": -1 } }
  }
}
```

## Adding layers to someone else's race

These are ordinary species keys, so a separate mod can add them with a `.species.patch` and ship
the sprites beside it. A race in the creator that leaves that mod out (an admin setting) loses
the layer along with the mod's sprites.

```json
[
  [ { "op": "test", "path": "/ffLayers", "inverse": true },
    { "op": "add", "path": "/ffLayers", "value": [] } ],
  [ { "op": "add", "path": "/ffLayers/-", "value": { "id": "warpaint", "label": "War paint", "color": "own",
      "colors": [ { "ff0000": "c02020" }, { "ff0000": "2040c0" } ] } } ]
]
```

The first batch makes the list only if the species has none yet (a plain `add` to `/ffLayers`
would replace layers the race already has); the second appends the new layer.

## Trying it out

1. Put the keys in your species file and the sprites in their folders.
2. Upload the mod at `/portraits/mods`. It is live as soon as the upload finishes.
3. Open the portrait creator, pick your race and look in the Body tab.

A layer with no styles left, or a style whose sheets are all missing, is quietly left out. If a
layer you expect is not there, check the folder names against `group` and `options` (paths are
not case-sensitive). An admin can fix a layer to one style for a race at Admin, Portraits, by
its `id`.
