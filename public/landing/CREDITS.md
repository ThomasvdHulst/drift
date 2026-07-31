# Landing illustration credits

These 24 files are **hosted copies** served from Drift's own origin, unlike card images,
which are hotlinked from the source. Copying a file to our origin and serving it is
reproduction and distribution by us, which makes the attribution position stricter, not
looser (compliance audit M-1).

The landing page is also the only page that is public and indexed, so it is the page a
reverse-image search would surface first.

Provenance below is as recorded in `src/components/landing/data.ts` when the files were
added on 17 July 2026. **One group is unverified and is flagged.**

## Art and ancient — The Art Institute of Chicago, CC0 1.0

No attribution required. The museum requests the caption "Artist. Title, Date. The Art
Institute of Chicago."

| File | Depicts |
|---|---|
| `great-wave.jpg` | The Great Wave off Kanagawa |
| `fuji.jpg` | Mount Fuji |
| `ukiyo-e.jpg` | Ukiyo-e print |
| `impressionism.jpg` | Impressionist painting |
| `monet.jpg` | Claude Monet |
| `rainy-day.jpg` | Paris Street; Rainy Day (Caillebotte) |
| `realm-encyclopedia.jpg` | Realm tile |
| `realm-gallery.jpg` | Realm tile |
| `ancient-amphora.jpg`, `ancient-hadrian.jpg`, `ancient-horus.jpg`, `ancient-kylix.jpg`, `ancient-stele.jpg` | Antiquities |

## Nature — Ernst Haeckel, public domain

Haeckel died in 1919, so these are public domain in the EU (life + 70 = 1989) as well as
the US. No attribution required, no term-of-protection question.

`nature-anemone.jpg`, `nature-jellyfish.jpg`, `nature-octopus.jpg`,
`nature-siphonophore.jpg`, `nature-slug.jpg`

## Cosmos — resolved 31 July 2026

Each file was identified by eye and its credit traced to the publishing agency. The group
is **no longer recorded as uniformly public domain**, because it never was.

| File | Subject | Credit | Position |
|---|---|---|---|
| `cosmos-earth.jpg` | Earthrise, Apollo 8, 1968 | William Anders / NASA | Public domain. NASA content is not subject to copyright. |
| `cosmos-saturn.jpg` | Saturn, Cassini | NASA / JPL / Space Science Institute | Public domain, same basis. |
| `cosmos-jupiter.jpg` | Jupiter, Cassini ([PIA04866](https://images.nasa.gov/details/PIA04866)) | NASA / JPL / Space Science Institute | Public domain, same basis. **Replaced 31 July 2026, see below.** |
| `cosmos-nebula.jpg` | Pillars of Creation | NASA, ESA and the Hubble Heritage Team (STScI/AURA) | Credited as **CC BY 4.0**. See the note below. |
| `cosmos-galaxy.jpg` | The Whirlpool Galaxy | NASA, ESA and the Hubble Heritage Team (STScI/AURA) | Credited as **CC BY 4.0**. See the note below. |

### ⚠️ The Jupiter image had to be replaced, and this is the one to remember

The original `cosmos-jupiter.jpg` was the JunoCam "Jupiter Blues" close-up, a striking
blue-toned cloudscape. JPL's own page for it
([PIA21972](https://www.jpl.nasa.gov/images/pia21972-jupiter-blues/)) gives the credit as:

> NASA/JPL-Caltech/SwRI/MSSS/Gerald Eichstadt/Sean Doran **© CC NC SA**

That is **CC BY-NC-SA**: a **NonCommercial** licence. Two citizen scientists processed the
raw JunoCam data, and their processing carries their own terms even though NASA hosts the
result. NonCommercial is not curable by crediting, and it is squarely incompatible with a
site being prepared to carry advertising. It was replaced with the Cassini Jupiter portrait
(PIA04866), downloaded from `images.nasa.gov` under NASA's media guidelines, which carries
no copyright notice and a plain NASA mission credit.

**The lesson for anything added later: a NASA-hosted image is not automatically public
domain.** NASA's own guidelines say so ("NASA occasionally licenses copyrighted material
from partners... clearly marked with the copyright holder's name"). Citizen-scientist
processing of JunoCam and other raw mission data is the common case, and it is common for
those to be NC or ND. **Check the credit line on the source page for a `©` before using a
NASA image**, not just the fact that NASA is hosting it.

### The two Hubble images: why they are credited rather than replaced

The same file has two publishers with two different positions:

- **NASA** states that NASA content, including Hubble outreach imagery, "generally [is] not
  subject to copyright in the United States", and asks only that NASA be acknowledged as the
  source. `hubblesite.org/copyright` now **301-redirects** to that policy page
  (<https://www.nasa.gov/nasa-brand-center/images-and-media/>), verified 31 July 2026.
- **ESA/Hubble** publishes the same images under **CC BY 4.0**, and asks that the credit be
  "presented clearly and visibly" and not "hidden or disassociated from the image"
  (<https://esahubble.org/copyright/>).

Provenance for these two files is unknown: the session that added them did not record which
site they came from. Rather than argue the point, both are credited as CC BY 4.0 on
`/colophon`, naming the creators and linking the licence. That is compliant if ESA's reading
is right, and merely courteous (and requested) if NASA's is. Crediting costs nothing;
guessing does not.

**Why the credit is on `/colophon` and not beside the image.** These appear as small
trail-map thumbnails and auto-advancing demo cards, where a credit next to each one is not
a workable medium. CC BY 4.0 §3(a)(2) allows attribution to be satisfied "by providing a URI
or hyperlink to a resource that includes the required information", and the footer of every
public page links to that resource. If the images ever move somewhere a caption fits, put
the caption there instead.

**If you want the residual argument gone entirely:** replace both with NASA-only mission
imagery (Spitzer, Chandra, WISE, JWST is NASA/ESA/CSA and does not help). The landing does
not depend on these particular pictures.

## Rule for anything added later

Only add a file here that is **CC0, a public domain dedication, or an expired term in the
EU**. If a candidate is CC BY or CC BY-SA, either credit it visibly where it appears or add
it to the `/colophon` list and pick something else if that is easier. On a marketing page,
picking something else usually is.

**Never add anything NonCommercial or NoDerivatives.** Drift is preparing to carry
advertising, which makes it a commercial use, and an NC image on the only public indexed
page is the kind of thing that turns into a letter. This is not hypothetical here: it is
exactly what `cosmos-jupiter.jpg` was.

**Record the source URL when you add a file.** Half the work in this file came from not
knowing where an image had been downloaded from. A single line saying where it came from
and what the credit line said would have saved all of it.
