// Real Wikipedia HTML, trimmed, for the wikihtml parser tests (the
// tile-contrast.testkit.ts precedent: fixtures beside the test, not inline).
//
// Every snippet below is VERBATIM `action=parse&prop=text` output captured from
// en.wikipedia.org while building Phase 26, only shortened (rows dropped, long
// prose cut). Hand-written markup would have quietly omitted the exact things
// that break a parser, so it is kept literal: the `<style>` block living inside a
// table cell, `&#160;` entities, `<sup class="reference">` footnotes, `<br />`
// inside a header, the deduplicated-style `<link>`, and the MathML+annotation
// pair that carries the TeX.

/** Mohs scale: `wikitable sortable`, with a reference in a header, `<br />` in
 *  headers, chemistry markup, an inline TemplateStyles `<style>` INSIDE a cell,
 *  and an image-only "Example image" column (which we never reuse). */
export const MOHS_TABLE = `<table class="wikitable sortable" style="text-align:center">
<tbody><tr>
<th>Mohs<br />hardness
</th>
<th>Reference<br />mineral
</th>
<th>Chemical&#160;formula
</th>
<th>Absolute<br />hardness<sup id="cite_ref-14" class="reference"><a href="#cite_note-14"><span class="cite-bracket">&#91;</span>13<span class="cite-bracket">&#93;</span></a></sup>
</th>
<th class="unsortable">Example image</th></tr>
<tr>
<td><b>1</b>
</td>
<td><a href="/wiki/Talc" title="Talc">Talc</a>
</td>
<td><style data-mw-deduplicate="TemplateStyles:r1123817410">.mw-parser-output .template-chem2-su{display:inline-block;font-size:80%;line-height:1;vertical-align:-0.35em}.mw-parser-output sub.template-chem2-sub{font-size:80%;vertical-align:-0.35em}</style><span class="chemf nowrap">Mg<sub class="template-chem2-sub">3</sub>Si<sub class="template-chem2-sub">4</sub>O<sub class="template-chem2-sub">10</sub>(OH)<sub class="template-chem2-sub">2</sub></span>
</td>
<td>1
</td>
<td><span typeof="mw:File"><a href="/wiki/File:Talc_block.jpg" class="mw-file-description"><img src="//upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Talc_block.jpg/120px-Talc_block.jpg" decoding="async" width="100" height="95" class="mw-file-element" /></a></span></td></tr>
<tr>
<td><b>2</b>
</td>
<td><a href="/wiki/Gypsum" title="Gypsum">Gypsum</a>
</td>
<td><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1123817410" /><span class="chemf nowrap">CaSO<sub class="template-chem2-sub">4</sub>&#183;2H<sub>2</sub>O</span>
</td>
<td>2
</td>
<td><span typeof="mw:File"><a href="/wiki/File:Gypse_Arignac.jpg" class="mw-file-description"><img src="//upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Gypse_Arignac.jpg/120px-Gypse_Arignac.jpg" decoding="async" width="100" height="100" class="mw-file-element" /></a></span></td></tr>
<tr>
<td><b>3</b>
</td>
<td><a href="/wiki/Calcite" title="Calcite">Calcite</a>
</td>
<td><span class="chemf nowrap">CaCO<sub class="template-chem2-sub">3</sub></span>
</td>
<td>14
</td>
<td><span typeof="mw:File"><a href="/wiki/File:Calcite-sample2.jpg" class="mw-file-description"><img src="//upload.wikimedia.org/wikipedia/commons/thumb/9/97/Calcite-sample2.jpg/120px-Calcite-sample2.jpg" decoding="async" width="100" height="75" class="mw-file-element" /></a></span></td></tr></tbody></table>`;

/** A maintenance banner: a table, and one a reader must never see. */
export const AMBOX = `<table class="box-More&#95;citations&#95;needed&#95;section plainlinks metadata ambox ambox-content ambox-Refimprove" role="presentation"><tbody><tr><td class="mbox-image"></td><td class="mbox-text"><div class="mbox-text-span">This section <b>needs additional citations</b> for verification.</div></td></tr></tbody></table>`;

/** A navbox: also a table, also never reading. */
export const NAVBOX = `<table class="nowraplinks mw-collapsible autocollapse navbox-inner" style="border-spacing:0"><tbody><tr><th scope="col" class="navbox-title" colspan="2">Minerals</th></tr><tr><td class="navbox-list navbox-odd"><div><a href="/wiki/Quartz" title="Quartz">Quartz</a> &#183; <a href="/wiki/Topaz" title="Topaz">Topaz</a></div></td></tr></tbody></table>`;

/** Brooklyn Bridge lead: shortdescription + hatnote chrome, a `vcard` infobox
 *  with an image row and label/data rows, then real prose. */
export const BROOKLYN_LEAD = `<div class="mw-content-ltr mw-parser-output" lang="en" dir="ltr"><div class="shortdescription nomobile noexcerpt noprint searchaux" style="display:none">Bridge in New York City</div><style data-mw-deduplicate="TemplateStyles:r1257001546">.mw-parser-output .hatnote{font-style:italic}</style><div role="note" class="hatnote navigation-not-searchable">For other uses, see <a href="/wiki/Brooklyn_Bridge_(disambiguation)" class="mw-disambig" title="Brooklyn Bridge (disambiguation)">Brooklyn Bridge (disambiguation)</a>.</div><p class="mw-empty-elt">
</p>
<table class="infobox vcard"><tbody><tr><th colspan="2" class="infobox-above"><div style="display:inline;" class="fn org">Brooklyn Bridge</div></th></tr><tr><td colspan="2" class="infobox-image"><span class="mw-default-size" typeof="mw:File/Frameless"><a href="/wiki/File:Brooklyn_Bridge_Postdlf.jpg" class="mw-file-description"><img src="//upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Brooklyn_Bridge_Postdlf.jpg/300px-Brooklyn_Bridge_Postdlf.jpg" decoding="async" width="300" height="200" class="mw-file-element" /></a></span><div class="infobox-caption">The Brooklyn Bridge in 2009</div></td></tr><tr><th scope="row" class="infobox-label">Carries</th><td class="infobox-data">5 lanes of <a href="/wiki/Roadway" class="mw-redirect" title="Roadway">roadway</a><br /> <a href="/wiki/Cycling" title="Cycling">bicycles</a> and pedestrians</td></tr><tr><th scope="row" class="infobox-label">Crosses</th><td class="infobox-data"><a href="/wiki/East_River" title="East River">East River</a></td></tr><tr><th scope="row" class="infobox-label">Total length</th><td class="infobox-data">6,016&#160;ft (1,833.7&#160;m)<sup id="cite_ref-3" class="reference"><a href="#cite_note-3"><span class="cite-bracket">&#91;</span>2<span class="cite-bracket">&#93;</span></a></sup></td></tr><tr><th scope="row" class="infobox-label">Opened</th><td class="infobox-data">May&#160;24, 1883</td></tr></tbody></table>
<p>The <b>Brooklyn Bridge</b> is a <a href="/wiki/Cable-stayed_bridge" title="Cable-stayed bridge">cable-stayed</a>/<a href="/wiki/Suspension_bridge" title="Suspension bridge">suspension bridge</a> in <a href="/wiki/New_York_City" title="New York City">New York City</a>, spanning the <a href="/wiki/East_River" title="East River">East River</a> between the <a href="/wiki/Boroughs_of_New_York_City" title="Boroughs of New York City">boroughs</a> of <a href="/wiki/Manhattan" title="Manhattan">Manhattan</a> and <a href="/wiki/Brooklyn" title="Brooklyn">Brooklyn</a>.<sup id="cite_ref-5" class="reference"><a href="#cite_note-5"><span class="cite-bracket">&#91;</span>4<span class="cite-bracket">&#93;</span></a></sup>
</p>
<p>Proposals for a bridge connecting Manhattan and Brooklyn were first made in the early 19th century, which eventually led to the construction of the current span, designed by <a href="/wiki/John_A._Roebling" title="John A. Roebling">John A. Roebling</a>.
</p></div>`;

/** A taxobox: an infobox whose labels are plain cells ending in a colon. */
export const TAXOBOX = `<table class="infobox biota" style="text-align:left;width:200px"><tbody><tr><th colspan="2" class="infobox-above">Octopus</th></tr><tr><td colspan="2" class="infobox-image"><span typeof="mw:File"><img src="//upload.wikimedia.org/wikipedia/commons/thumb/octopus.jpg/220px-octopus.jpg" width="220" height="150" class="mw-file-element" /></span></td></tr><tr><th colspan="2" class="infobox-header">Scientific classification</th></tr><tr><td>Domain:</td><td><a href="/wiki/Eukaryote" title="Eukaryote">Eukaryota</a></td></tr><tr><td>Kingdom:</td><td><a href="/wiki/Animal" title="Animal">Animalia</a></td></tr><tr><td>Phylum:</td><td><a href="/wiki/Mollusca" title="Mollusca">Mollusca</a></td></tr><tr><td>Class:</td><td><a href="/wiki/Cephalopod" title="Cephalopod">Cephalopoda</a></td></tr></tbody></table>`;

/** Euler's identity lead: block math (MathML + TeX annotation + fallback image)
 *  and an inline formula, inside real prose. */
export const EULER_LEAD = `<div class="mw-content-ltr mw-parser-output" lang="en" dir="ltr"><p><b>Euler's identity</b><sup id="cite_ref-1" class="reference"><a href="#cite_note-1"><span class="cite-bracket">&#91;</span>a<span class="cite-bracket">&#93;</span></a></sup> (also known as <b>Euler's equation</b>) is the <a href="/wiki/Equality_(mathematics)" title="Equality (mathematics)">equality</a> <span class="mwe-math-element mwe-math-element-block"><span class="mwe-math-mathml-display mwe-math-mathml-a11y" style="display: none;"><math display="block" xmlns="http://www.w3.org/1998/Math/MathML" alttext="{\\displaystyle e^{i\\pi }+1=0}"> <semantics> <mrow class="MJX-TeXAtom-ORD"> <mstyle displaystyle="true" scriptlevel="0"> <msup> <mi>e</mi> <mrow class="MJX-TeXAtom-ORD"> <mi>i</mi> <mi>&#x03C0;<!-- π --></mi> </mrow> </msup> <mo>+</mo> <mn>1</mn> <mo>=</mo> <mn>0</mn> </mstyle> </mrow> <annotation encoding="application/x-tex">{\\displaystyle e^{i\\pi }+1=0}</annotation> </semantics> </math></span><img src="https://wikimedia.org/api/rest_v1/media/math/render/svg/a746.svg" class="mwe-math-fallback-image-display mw-invert skin-invert" aria-hidden="true" style="vertical-align: -0.505ex; width:11.089ex; height:2.843ex;" alt="{\\displaystyle e^{i\\pi }+1=0}"></span> where <span class="mwe-math-element mwe-math-element-inline"><span class="mwe-math-mathml-inline mwe-math-mathml-a11y" style="display: none;"><math xmlns="http://www.w3.org/1998/Math/MathML" alttext="{\\displaystyle e}"> <semantics> <mrow class="MJX-TeXAtom-ORD"> <mstyle displaystyle="true" scriptlevel="0"> <mi>e</mi> </mstyle> </mrow> <annotation encoding="application/x-tex">{\\displaystyle e}</annotation> </semantics> </math></span><img src="https://wikimedia.org/api/rest_v1/media/math/render/svg/e.svg" class="mwe-math-fallback-image-inline mw-invert skin-invert" aria-hidden="true" alt="{\\displaystyle e}"></span> is <a href="/wiki/E_(mathematical_constant)" title="E (mathematical constant)">Euler's number</a>, the base of natural logarithms.
</p></div>`;

/** A section as `action=parse&section=N` returns it: a heading, prose, a table. */
export const SECTION_WITH_TABLE = `<div class="mw-content-ltr mw-parser-output" lang="en" dir="ltr"><div class="mw-heading mw-heading2"><h2 id="Scale">Scale</h2></div>
<p>The Mohs scale of mineral hardness is based on the ability of one sample of a mineral to scratch another, as the table below shows.
</p>
${MOHS_TABLE}
<p>Hardness is a somewhat ambiguous term.
</p></div>`;
