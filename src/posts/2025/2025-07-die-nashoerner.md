---
title: 'Die Nashörner'
description: "Alle verwandeln sich in Nashörner, nur Beringer nicht. Aber welche? Indische? Afrikanische?"
discover:
  description: "Wahlweise ein oder zwei Hörner"
date: 2025-01-19
image: '/assets/images/gallery/2025-nashoerner/rhino-poster.png'
alt: 'Poster von Die Nashörner'
credit: Poster designt von Dominic Lupas
gallery:
  - image: ./src/assets/images/gallery/2025-nashoerner/rhino-1.jpg
  - image: ./src/assets/images/gallery/2025-nashoerner/rhino-2.jpg
  - image: ./src/assets/images/gallery/2025-nashoerner/rhino-3.jpg
  - image: ./src/assets/images/gallery/2025-nashoerner/rhino-4.jpg
  - image: ./src/assets/images/gallery/2025-nashoerner/rhino-5.jpg
  - image: ./src/assets/images/gallery/2025-nashoerner/rhino-6.jpg
  - image: ./src/assets/images/gallery/2025-nashoerner/rhino-7.jpg
---

 {% if reservierung.verkauf %}
    <article class="full | region">
    <div class="wrapper flow prose">
      <p>
        <a href="/reservierung/" class="button">🎟️ Jetzt Karten für {{ reservierung.titel }} reservieren 🎟️</a>
      </p>
      <p>
    </div>
  </article>
  {% endif %}

## Eckdaten
<ul>
<li>Autor: Eugène Ionesco</li>
<li>Termine: 7., 8., 10. und 11. Juli 2025</li>
</ul>

<ul class="gallery" role="list" style="padding: 0;">
  {%- for item in gallery -%}
    <li>{% image item.image, item.alt %}</li>
  {%- endfor -%}
</ul>