import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './guide.module.scss';

export const metadata: Metadata = {
    title: 'Building a race for the portrait creator',
    robots: { index: false, follow: false },
};

// For mod authors: the portrait creator's own additions to a .species file (style layers on
// any body part, as many as wanted, and clothing fit). Starbound ignores these keys, so they
// change nothing in the game. The engine reads them in src/lib/portrait/species.ts; keep this
// page in step with it.

const EXAMPLE = `{
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
}`;

const TREE = `humanoid/squoat/
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
    curled/head.png`;

const PATCH = `[
  [ { "op": "test", "path": "/ffLayers", "inverse": true },
    { "op": "add", "path": "/ffLayers", "value": [] } ],
  [ { "op": "add", "path": "/ffLayers/-", "value": { "id": "warpaint", "label": "War paint", "color": "own",
      "colors": [ { "ff0000": "c02020" }, { "ff0000": "2040c0" } ] } } ]
]`;

export default function PortraitGuidePage() {
    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <h1>Building a race for the portrait creator</h1>
                <p>
                    <Link href='/portraits'>Portrait creator</Link>{' '}and <Link href='/portraits/mods'>add mods</Link>
                </p>
            </header>

            <article className={`pixel-panel ${styles.panel}`}>
                <p>
                    Starbound gives a race hair plus two more style choices, facial hair and a facial mask, all drawn on the head.
                    The portrait creator can do more: <strong>any number of style layers</strong>, each drawing on the head, the
                    body and both arms, and a <strong>clothing fit</strong>{' '}for races built shorter or wider than the standard humanoid.
                </p>
                <p className={styles.note}>
                    Both are extra keys in your <code>.species</code>{' '}file. The game ignores keys it does not know, so your mod
                    works in Starbound exactly as before. These layers show up in the portrait creator only, never in the game.
                </p>
                <p>
                    Hair, facial hair and facial masks keep working as they do in Starbound (<code>headOptionAsFacialhair</code>,
                    <code> altOptionAsFacialMask</code>{' '}and the rest). The keys below come on top of them.
                </p>

                <h2>Style layers: <code>ffLayers</code></h2>
                <p>
                    A list at the top level of the species file. Each entry is one more set of choices in the creator&apos;s Body
                    tab. A gender can have its own <code>ffLayers</code>{' '}list too: an entry there with the same <code>id</code>{' '}
                    changes that layer for that gender only (only the keys it gives), and a new <code>id</code>{' '}adds a layer.
                </p>
                <table className={styles.table}>
                    <thead>
                        <tr><th>Key</th><th>What it does</th><th>Default</th></tr>
                    </thead>
                    <tbody>
                        <tr><td><code>id</code></td><td>Required. Letters, digits, <code>_</code>{' '}and <code>-</code>. Saved portraits remember picks by it, so keep it once published. Not <code>hair</code>, <code>facialHair</code>{' '}or <code>facialMask</code>.</td><td></td></tr>
                        <tr><td><code>label</code></td><td>The heading in the creator.</td><td>the id</td></tr>
                        <tr><td><code>group</code></td><td>Folder under <code>/humanoid/&lt;species&gt;/</code>{' '}holding the styles.</td><td>the id</td></tr>
                        <tr><td><code>options</code></td><td>The style names in the order shown; <code>&quot;&quot;</code>{' '}is &quot;none&quot;. The first is what a new portrait starts with, so put <code>&quot;&quot;</code>{' '}first for an optional layer.</td><td>none, then every style folder found, in name order</td></tr>
                        <tr><td><code>color</code></td><td>Which colours recolour it (a name or a list, applied in order): <code>body</code>, <code>hair</code>, <code>undy</code>{' '}(the alt/detail colour), <code>facialMask</code>, <code>own</code>{' '}(its own palette, picked on its own) or <code>none</code>.</td><td><code>body</code></td></tr>
                        <tr><td><code>colors</code></td><td>The palette for <code>own</code>: a list of colour options, written like <code>bodyColor</code>.</td><td></td></tr>
                        <tr><td><code>stack</code></td><td><code>true</code>{' '}lets a portrait wear several styles of this layer at once, drawn in the order picked.</td><td><code>false</code></td></tr>
                        <tr><td><code>masked</code></td><td><code>true</code>{' '}cuts the head part with the helmet&apos;s mask, as hair is cut. Leave it off for things painted on the skin.</td><td><code>false</code></td></tr>
                        <tr><td><code>above</code></td><td>Where each part is drawn, e.g. <code>{'{ "head": "hair" }'}</code>. See <a href='#order'>Layer order</a>.</td><td>just above the part it covers</td></tr>
                    </tbody>
                </table>

                <h3>The sprite files</h3>
                <p>Each style is a folder, with one sheet for each body part it covers:</p>
                <pre className={styles.code}>{TREE}</pre>
                <ul>
                    <li>
                        <strong>Lay each sheet out exactly like the race&apos;s own sheet for that part</strong>: same size, same
                        frames in the same places. The simplest way is to copy <code>malebody.png</code>{' '}(or <code>frontarm.png</code>, ...),
                        draw the marking over every frame, then erase the body. The creator cuts frames from your sheet with the
                        body part&apos;s own <code>.frames</code>{' '}file, so the marking follows every pose. Your style folder needs no{' '}
                        <code>.frames</code>{' '}file.
                    </li>
                    <li>File names are <code>head.png</code>, <code>body.png</code>, <code>frontarm.png</code>{' '}and <code>backarm.png</code>. A gendered name (<code>femalebody.png</code>, using the gender&apos;s <code>name</code>) wins over the plain one for that gender.</li>
                    <li>A style is offered only if at least one of its sheets exists.</li>
                </ul>

                <h3>Colours</h3>
                <p>
                    Colour options are Starbound&apos;s palette swaps: <code>{'{ "402010": "20a040" }'}</code>{' '}turns every pixel of
                    #402010 into #20a040. So to follow the player&apos;s pick, draw the marking in the source colours of the
                    palette you name. For <code>&quot;color&quot;: &quot;undy&quot;</code>, use the colours that are keys in
                    your <code>undyColor</code>{' '}options. Pixels in any other colour keep the colour you drew them in.
                    Members can still change any colour by hand in the Colours tab.
                </p>

                <h3 id='order'>Layer order</h3>
                <p>From back to front, the portrait is drawn in this order:</p>
                <p className={styles.order}>
                    backArm, backSleeve, back, head, emote, (hair), body, legs, chest, (facialHair, facialMask), headwear, frontArm, frontSleeve
                </p>
                <p>
                    A layer&apos;s part goes just above the body part it covers: the head part above <code>head</code>{' '}(under the
                    eyes and hair), the body part above <code>body</code>{' '}(under clothing), each arm part above its arm. Set{' '}
                    <code>above</code>{' '}for a part to put it over something else, for example{' '}
                    <code>{'"above": { "head": "hair" }'}</code>{' '}for horns over the hair, or <code>{'{ "body": "chest" }'}</code>{' '}for
                    something worn over the shirt. Any name in the list works, and so does another layer&apos;s <code>id</code>.
                    Layers placed above the same thing stack in the order they are listed.
                </p>

                <h2>Clothing fit: <code>ffClothingFit</code></h2>
                <p>
                    Clothing is drawn for the standard humanoid body. If your race is shorter, taller, wider or narrower, this
                    moves and stretches every piece of clothing it wears, in the portrait creator only. One rule per clothing
                    sprite: <code>headwear</code>, <code>chest</code>, <code>frontSleeve</code>, <code>backSleeve</code>,{' '}
                    <code>legs</code>, <code>back</code>. Each rule takes any of:
                </p>
                <table className={styles.table}>
                    <tbody>
                        <tr><td><code>offset</code></td><td><code>[x, y]</code>{' '}in pixels; y counts up, so <code>[0, -2]</code>{' '}moves it down 2.</td></tr>
                        <tr><td><code>columns</code></td><td><code>{'{ "at": 21, "add": 2 }'}</code>{' '}repeats column 21 of the frame twice more, making the sprite 2 pixels wider; a negative <code>add</code>{' '}removes that many columns starting at <code>at</code>. The sprite stays centred: what is left of the column moves left by half, the rest right.</td></tr>
                        <tr><td><code>rows</code></td><td>The same with rows, counted from the top of the frame. Everything below the changed rows stays where it was; everything above moves up (adding) or down (removing).</td></tr>
                    </tbody>
                </table>
                <p>
                    Columns and rows count from the top-left of the 43 by 43 frame, as an image editor shows it. Resizing happens
                    first, then the move. A helmet&apos;s mask moves and resizes with the helmet. A gender can carry its own{' '}
                    <code>ffClothingFit</code>; each of its rules replaces the species&apos; rule for that sprite.
                </p>

                <h2>An example</h2>
                <pre className={styles.code}>{EXAMPLE}</pre>

                <h2>Adding layers to someone else&apos;s race</h2>
                <p>
                    These are ordinary species keys, so a separate mod can add them with a <code>.species.patch</code>{' '}and ship
                    the sprites beside it. A race in the creator that leaves that mod out (an admin setting) loses the layer
                    along with the mod&apos;s sprites.
                </p>
                <pre className={styles.code}>{PATCH}</pre>
                <p>
                    The first batch makes the list only if the species has none yet (a plain <code>add</code>{' '}to{' '}
                    <code>/ffLayers</code>{' '}would replace layers the race already has); the second appends the new layer.
                </p>

                <h2>Trying it out</h2>
                <ol>
                    <li>Put the keys in your species file and the sprites in their folders.</li>
                    <li>Upload the mod at <Link href='/portraits/mods'>add mods</Link>. It is live as soon as the upload finishes.</li>
                    <li>Open the <Link href='/portraits'>portrait creator</Link>, pick your race and look in the Body tab.</li>
                </ol>
                <p>
                    A layer with no styles left, or a style whose sheets are all missing, is quietly left out. If a layer you
                    expect is not there, check the folder names against <code>group</code>{' '}and <code>options</code>{' '}(paths are
                    not case-sensitive). An admin can fix a layer to one style for a race at Admin, Portraits, by its{' '}
                    <code>id</code>.
                </p>
            </article>
        </main>
    );
}
