# Uma prancheta nova para cada mudança do protótipo

No protótipo de interface (artifact Design "cad2 — nova interface"), cada mudança pedida vira uma prancheta nova no canvas, copiada da mais recente; as anteriores não são sobrescritas.

**Por quê:** o dono pediu "para de ficar sobrescrevendo as artes e cria uma prancheta nova para cada modificação" (2026-10-28): ele quer comparar as versões lado a lado.

**Como aplicar:** copiar o `.dc.html` mais recente para um nome novo, mudar só a cópia, pô-la em `canvas.json` à direita das outras (x + 1700) com título que diga a mudança, e publicar só a cópia e o `canvas.json`. O `launch` aponta para a nova. Corrigir um erro da própria prancheta recém-criada no mesmo turno não conta como mudança nova.
