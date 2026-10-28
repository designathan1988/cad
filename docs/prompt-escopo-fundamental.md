# Prompt: reduzir o cad2 ao fundamental e fazê-lo funcionar

Escrito em 2026-10-28 a partir de uma análise do repositório (veja "Base desta análise" no fim). Use numa sessão nova, sozinha nesta pasta.

---

O cad2 tentou fazer tudo de uma vez (15 fases do plano atacadas em largura) e quebra em poucos segundos de uso. Agora ele vai ter só o fundamental, e o fundamental tem de funcionar de verdade. O resto sai do aplicativo por enquanto, sem perder nada: fica guardado no histórico do git e os dados dele nos arquivos dos projetos continuam intactos.

## O que fica (o fundamental)

- **Paredes completas:** desenhar (reta, retângulo, arco, Espaço ao desenhar), tipos com camadas, referência, junções L/T/X e nós, dividir, unir, canto, flip, alinhar e distribuir.
- **Elementos de construção:** portas e janelas, pisos e lajes, forros, telhados, escadas, guarda-corpos, pilares, vigas, parede-cortina, cômodos e separadores, pavimentos.
- **Objetos:** objetos e mobiliário, editor de definições, biblioteca, importação de modelo como objeto.
- **Vistas:** planta, 3D, cortes, elevações, caixa de corte, vistas salvas, sobreposições gráficas e camadas.
- **Precisão:** encaixes, guias (linha, ponto, círculo), grade, eixos, entrada digitada com expressões, cotas (linear, angular, raio, coordenada, nível, cotagem automática), medir, variáveis, unidades, escala de desenho.
- **Editar e arquivo:** selecionar, mover, copiar, girar, espelhar, escalar, desfazer e refazer, área de transferência, projetos (abrir, salvar, recentes), imagem ou PDF de referência.
- **Configurações que esses elementos usam:** materiais, tipos, unidades, pavimentos, escala de desenho, atalhos (as partes da aba Gerenciar que servem ao modelo ficam).

## O que sai por enquanto

Cada área foi mapeada pelos imports de todos os 358 arquivos de `src/`. As linhas são as de 2026-10-28; reconfira no código atual.

| Área | Arquivos | Linhas | Onde entra na interface |
| --- | --- | --- | --- |
| Instalações | `elements/mep/*` (7), `elements/kinds/mep.ts`, `app/mep-route.ts`, `app/mep-ui.ts`, `ui/services-dialog.ts` | ~2.300 + diálogo | aba Instalações, `mep.autoRoute`, `services.open` |
| Simulações | `sim/*` (6), `app/sim-map.ts`, `app/sim-tables.ts`, `app/sun.ts`, `ui/simulation-dialog.ts`, `io/export-sim.ts` | ~1.500 + diálogo | aba Analisar: `sim.open` |
| Normas e diagnóstico de regras | `rules/*` (3), `app/diagnostics.ts`, `app/diagnostic-fixes.ts`, `ui/rules-dialog.ts` | ~700 + diálogo | aba Analisar: `rules.edit`, `rules.report` |
| Orçamento | `costs/*` (6), `ui/budget-dialog.ts` | ~680 + diálogo | aba Analisar: `budget.open` |
| Aprovação | `approval/*` (2), `ui/approval-dialog.ts` | ~290 | aba Aprovação |
| Lote e terreno | `elements/terrain/*` (3), `elements/kinds/terrain.ts`, `app/lot.ts`, `app/lot-areas.ts`, `app/terrain-ui.ts`, `ui/lot-dialog.ts`, `ui/site-dialog.ts` | ~1.030 | aba Terreno; `site.edit` e `lot.edit` na aba Gerenciar |
| Documentação | `app/sheets.ts`, `elements/sheet/*`, `ui/sheets-dialog.ts`, `app/print.ts`, `ui/print-dialog.ts`, `app/schedules.ts`, `ui/schedules-dialog.ts`, `app/quantities.ts`, `app/documents.ts`, `app/project-folder.ts` | ~3.100 | `view.sheets`, `view.schedules`, imprimir, quantitativos |
| Apresentação | `app/walk.ts`, `app/walk-ui.ts`, `ui/tour.ts`, `ui/tour-dialog.ts` | ~480 | `view.walk`, `view.tourEdit`, tour de ajuda |

Atenção: `elements/wall/geometry/footprint.ts` NÃO é documentação (o nome tem "print"): é geometria de parede e fica.

Decida e registre no caderno, sem me perguntar, estes casos de fronteira, sempre pelo critério "serve ao modelo de paredes, elementos, objetos, vistas e precisão?":
- anotação além das cotas (nota, etiqueta, nuvem, chamada, etiquetas de aberturas);
- exportações (IFC, DXF, GLB, imagem);
- pontos (`view.points`), estrutura analítica e o painel de depuração (`ui/debug-panel.ts`, que usa o diagnóstico de regras).

## Onde o fundamental depende do que sai (os pontos de corte)

Medido pelos imports; cada um tem de ser resolvido na causa:

- `app/app.ts` importa diagnósticos, regras, documentos, lote, terreno, instalações, simulação, aprovação e caminhar.
- `app/document.ts` (o `Doc`) e `io/project-file.ts` (o formato do arquivo) guardam campos de regras, folhas, terreno, lote, instalações, sol, simulação, orçamento e aprovação.
- `app/frame.ts` (folhas, sol, mapa de simulação, orçamento), `app/input.ts` (folhas, imprimir, tabelas, sítio, tour), `app/input-buttons.ts` (imprimir).
- `app/actions.ts`, `app/chrome.ts`, `app/ribbon-tabs.ts` e `app/next-element.ts` usam o esquema de instalações.
- `elements/registry.ts` registra os tipos de instalações e de terreno; `render/scene-3d.ts` desenha terreno; `render/plan-view.ts` desenha o mapa de simulação; `elements/kinds/object.ts` usa o esquema de terreno.
- `elements/wall/fields.ts` importa quantitativos e tabelas; `ui/sections-dialog.ts` põe cortes em folhas; `elements/kinds/note.ts` usa o esquema de folhas.
- `elements/material/schema.ts`, `elements/material/commands.ts` e `ui/materials-dialog.ts` usam `sim/physics.ts` (propriedades térmicas do material).

## Passo 0: antes de tudo

1. Há mudanças sem commit de outra sessão (`src/app/app.ts`, `src/app/frame.ts`, `src/render/overlay-3d.ts`, `src/render/plan-view.ts`) e arquivos soltos (`scripts/`, `vigia.json`, `vigia-log.txt`). Leia o diff inteiro. Se estiver certo, termine e commite; se estiver errado, conserte; nunca descarte sem a prova no código.
2. Crie a tag `escopo-completo-2026-10-28` no commit atual e faça push dela: é o ponto de volta de tudo o que vai sair.
3. Reescreva `docs/agent/work.md` com este prompt e os passos, e mantenha `docs/agent/STATE.md` verdadeiro (seção "Memória que sobrevive à compactação" do CLAUDE.md).

## Passo 1: tirar o que sai, sem perder dados

- Para cada área da tabela: tire do aplicativo as entradas (abas e botões da faixa, ações de `actions.ts`, teclas, paleta de comandos, menu do botão direito, diálogos), os módulos e os testes que só testam esses módulos. Nada de esconder com `if` ou bandeira: o código sai do aplicativo e fica na tag.
- Os dados dessas áreas que já existem nos projetos salvos não se perdem: o `Doc` passa a guardar, sem interpretar, os campos que o aplicativo não usa agora, e o arquivo os grava de volta iguais, com uma migração versionada em `io/project-file.ts`. Abrir e salvar um projeto antigo devolve o mesmo JSON nesses campos.
- Resolva cada ponto de corte na causa. Por exemplo, as propriedades térmicas do material passam a ser dados do material, sem importar `sim/`; os campos de quantitativo das paredes saem.
- No fim deste passo:
  - `npx tsc --noEmit` passa;
  - nenhum arquivo do fundamental importa as áreas tiradas (refaça o mapa de imports e mostre);
  - o aplicativo abre;
  - um projeto antigo abre igual, salvo e reaberto;
  - commit e push (`git add` por caminho).

## Passo 2: fazer o fundamental funcionar, com a skill

1. Instale a skill a partir do arquivo `C:\Users\Jonathan\Documents\Arquivos\reviewing-whole-codebase.zip`, extraindo-o para `C:\Users\Jonathan\.claude\skills\`:

   ```powershell
   Expand-Archive -Path "C:\Users\Jonathan\Documents\Arquivos\reviewing-whole-codebase.zip" -DestinationPath "C:\Users\Jonathan\.claude\skills" -Force
   ```

   Confira que existe `C:\Users\Jonathan\.claude\skills\reviewing-whole-codebase\SKILL.md`. Se a skill não aparecer na lista de skills da sessão, peça para eu reiniciar o Claude Code e pare até lá.
2. Leia inteiros o `SKILL.md` e os dois arquivos de `references/` da skill. Depois invoque `/reviewing-whole-codebase fix` e siga a skill do começo ao fim, sem pular nenhuma fase e sem substituir os passos dela por outros:
   - `init` com o objetivo abaixo e `--check "npx tsc --noEmit"`;
   - `set-app` com o comando de desenvolvimento do `package.json` e a URL do Vite.

   O Playwright vem do projeto. Se não estiver lá, instale-o com o comando que a skill indica.
3. A skill lê cada arquivo que ficou até a última linha, pesquisa a documentação das bibliotecas da versão instalada (three, three-bvh-csg, three-mesh-bvh, pdfjs-dist, polyclip-ts, Vite), registra cada problema com a prova, verifica, corrige com fonte citada e, só no fim, testa o aplicativo no Chrome com gestos humanos e fotos.

Objetivo para a skill (cole no `--goal`):

> O fundamental do cad2 (paredes, elementos de construção, objetos, vistas, precisão) funciona sem quebrar. Já se sabe de três causas raiz, a confirmar no código atual e a corrigir primeiro:
>
> 1. **A mesma opção definida em vários lugares.**
>    - O painel flutuante e o menu do botão direito têm a sua própria tabela em `app/context-menu.ts`, fora de `app/actions.ts`.
>    - Portas e janelas têm `openingFields` e `nextOpeningFields` (`elements/opening/fields.ts`).
>    - Paredes têm `wallFields` e `nextWallFields`.
>    - A faixa e o painel lateral montam cada um a sua ordem.
>
>    A correção: uma lista por elemento, e a "próxima" peça como elemento-modelo, como já é em `app/next-element.ts`.
> 2. **Mover uma porta mexe nas vizinhas.**
>    - A posição é recalculada de uma regra (`fromOpening`, `aligned`, `inGroup` em `elements/opening/schema.ts`).
>    - Soltar a porta a prende à vizinha mais próxima (`app/select-drag.ts`).
>    - `settleDimensions`, `keepOpenings` e `keepRooms` rodam juntos em todo dispatch.
>
>    A correção: posição explícita; vínculo só quando o usuário cria, visível; migração que mantém cada abertura onde está.
> 3. **Controladores gigantes.** `app/app.ts` e `app/input.ts` misturam responsabilidades.
>
> Os fluxos que têm de funcionar no fim:
> - desenhar paredes e pôr porta e janela;
> - mover a porta sem mexer nas vizinhas nem nos cômodos;
> - mover a parede levando as aberturas dela;
> - a mesma opção igual na faixa, no painel lateral e no painel flutuante;
> - uma tecla mudada aparece igual em todos os lugares;
> - cada elemento de construção, objeto, vista e ferramenta de precisão que ficou é criado, editado, desfeito, refeito, salvo e reaberto;
> - tudo isso em ~880, ~1280 e 1920 px de largura.

## Regras

- Uma sessão só nesta pasta. Se aparecerem mudanças que não são suas, pare e me avise.
- Sem subagentes. Sem heredoc no shell (use Write ou Edit).
- Nenhuma função nova: só tirar o que sai e consertar o que fica.
- Nada do que fica pode deixar de funcionar; não desligue nem esconda funcionalidade do fundamental.
- Commit por passo verificado, com mensagem em inglês que diga a causa e a correção; `git add` por caminho, conferindo `git diff --cached --name-only`; push para `origin main`.
- Tudo no projeto em inglês; comigo, em português.

## No fim, informe

- as áreas tiradas (arquivos e linhas), os pontos de corte resolvidos e a prova de que nenhum import sobrou;
- a prova de que projetos antigos abrem e salvam sem perder os campos guardados;
- o relatório da skill: arquivos e linhas lidos, pesquisa feita, problemas por gravidade, correções com fonte e verificação, rodadas de teste no Chrome com as fotos;
- o que não foi feito ou não foi verificado, e por quê.

---

## Base desta análise (o que foi e o que não foi lido)

- **Lidos inteiros:** `CLAUDE.md` (84 linhas), `docs/plano-de-escopo.md` (510 linhas) e o trecho das abas da faixa em `src/app/ribbon-tabs.ts` (linhas 84-298).
- **Mapa de imports:** feito por script sobre todos os 358 arquivos de `src/` (68.958 linhas). O script leu cada arquivo inteiro para extrair os imports, mas o conteúdo de cada um não foi lido por mim.
- **Causas raiz:** vêm da análise de 2026-10-27, conferida em 2026-10-28 (`docs/prompt-resolver-tudo.md`), e devem ser reconferidas no código atual.
- **Não lidos nesta análise:** `docs/pendencias.md` (672), `docs/wall-joins-spec.md` (1.323), os ADRs, as pesquisas, os 160 arquivos de `tests/` e o conteúdo dos arquivos de `src/`. A leitura integral é o trabalho do passo 2 (a skill obriga).
