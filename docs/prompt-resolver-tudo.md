# Prompt: resolver todos os problemas do cad2

Resolva todos os problemas que o cad2 tem, na causa, sem quebrar nada. Faça você mesmo, numa sessão só.

A aplicação quebra em poucos segundos de uso: uma mesma opção é diferente na faixa e no painel flutuante, e mover uma porta ou janela mexe nas vizinhas. As três causas raiz já foram achadas (abaixo). Corrija primeiro essas causas, na estrutura, e só depois o resto, que você acha lendo tudo.

## As causas raiz (análise de 2026-10-27, conferida no código em 2026-10-28)

Comece cada uma reachando no código atual o arquivo:linha citado. O que já mudou, você registra com a prova.

### Causa 1: a fonte única da verdade existe no comentário, não no código
- src/app/actions.ts diz no topo que a faixa, as teclas e os menus leem dali. Não leem:
  - o painel flutuante e o menu do botão direito usam outra lista em src/app/context-menu.ts, com outra tabela do que cada botão faz, outros textos (ctx.move = "Mover…"), outros ícones e as teclas escritas à mão. Mudar uma tecla no keymap muda a faixa e não muda o painel flutuante;
  - portas e janelas têm as opções escritas duas vezes em src/elements/opening/fields.ts: openingFields (a selecionada, linha 37) e nextOpeningFields (a próxima, linha 329);
  - paredes, o mesmo: wallFields e nextWallFields em src/elements/wall/fields.ts;
  - mesmo com a mesma lista, a faixa e o painel lateral montam cada um a sua: a faixa põe o lado e a dobradiça da porta primeiro (ribbon-tabs.ts:387), o painel põe por último, em outra seção (src/elements/opening/panel.ts); a faixa separa "Tipo" e "Próximo elemento", o painel não.
- O padrão certo já existe para objetos, pilares e vigas: a próxima peça é um elemento-modelo passado pelas mesmas opções (src/app/next-element.ts).

### Causa 2: mover uma porta mexe nas vizinhas, por construção
- A posição de uma abertura não é guardada; é recalculada de uma regra: a partir da face da parede, de outra abertura (fromOpening), alinhada a outra (aligned) ou em grupo (inGroup), em src/elements/opening/schema.ts:17-22.
- Soltar uma porta refaz a regra a partir da face ou abertura mais próxima (src/app/select-drag.ts:6). A porta fica presa a uma vizinha sem o usuário saber, e as peças formam correntes.
- Toda ação passa por três correções automáticas no dispatch (src/app/app.ts:289-303): settleDimensions (cotas travadas puxam o que está preso nelas), keepOpenings (reposiciona as aberturas de toda parede que mudou) e keepRooms (ajusta os cômodos). Cada uma nasceu de um caso isolado, e ninguém testou as três juntas.

### Causa 3: o processo
- 485 commits em 4 dias, as 15 fases do plano atacadas em largura; correções do sintoma relatado, não da causa; várias sessões ao mesmo tempo nesta pasta.
- Os 1287 testes automáticos testam só cálculo: nenhum dos 158 arquivos toca a tela. Eles passam enquanto a interface quebra.
- src/app/app.ts (2280 linhas) e src/app/input.ts (1199) misturam responsabilidades.
- O que está razoável: o motor de paredes, as geometrias, os cálculos, a leitura e a gravação de arquivos e as migrações.

## Antes de começar

1. **Memória.** O projeto tem uma memória que sobrevive à compactação (CLAUDE.md, seção "Memória que sobrevive à compactação"): docs/agent/orders.md, docs/agent/STATE.md e docs/agent/work.md, reimpressos pelos hooks. Reescreva o docs/agent/work.md agora com este prompt e os passos. Depois de cada passo, registre nele o que leu (arquivos e linhas), o que achou (arquivo:linha), o que mudou, o commit e o próximo passo. Mantenha o STATE.md verdadeiro.
2. **As regras que o programa garante**, em .claude/settings.json (https://code.claude.com/docs/en/permissions, https://code.claude.com/docs/en/hooks):
   - `"permissions": { "deny": ["Agent"] }`: sem subagentes;
   - um hook `Stop` que sai com código 2 enquanto `npx tsc --noEmit` falhar ou enquanto docs/agent/reading.md ou docs/agent/findings.md tiver um `[ ]`, com o motivo na saída de erro. Um problema que não pode ser corrigido fica `[-]` com o motivo e a prova, nunca `[ ]`.
3. **Uma sessão por vez nesta pasta.** Se aparecerem mudanças que não são suas enquanto você trabalha, pare e me avise.
4. **Nenhuma função nova** até o fim deste prompt.

## Passo 1: terminar o que está em andamento
- Há mudanças sem commit em src/app/app.ts, src/app/frame.ts, src/render/overlay-3d.ts e src/render/plan-view.ts, e arquivos não versionados (scripts/, vigia.json, vigia-log.txt).
- Leia o diff inteiro e entenda o que ele faz. Se estiver certo, termine, verifique e commite. Se estiver errado, conserte. Não descarte trabalho sem a prova no código de que ele está errado.

## Passo 2: o roteiro dos fluxos básicos
Escreva docs/agent/flows.md, o roteiro fixo que prova que a base aguenta o uso. Cada fluxo com os gestos, o que deve acontecer e onde fica a captura:
- desenhar paredes, pôr uma porta e uma janela;
- mover a porta: as vizinhas e os cômodos não se mexem;
- mover a parede: as aberturas dela vão junto, as das outras paredes não se mexem;
- mudar a mesma opção da porta pela faixa, pelo painel lateral e pelo painel flutuante: o mesmo nome, a mesma ordem, o mesmo valor nos três;
- mudar uma tecla no keymap: ela aparece igual na faixa, no painel flutuante e no menu do botão direito;
- desfazer e refazer cada um desses;
- salvar, reabrir e ver tudo no mesmo lugar.

Rode o roteiro inteiro no app agora, com gestos humanos, e registre em docs/agent/findings.md o que já quebra. Ele é rodado de novo depois de cada correção dos passos 3 e 4.

## Passo 3: causa 1, uma só definição por opção
- Cada tipo de elemento tem uma única lista de opções. A "próxima" parede, porta ou janela é um elemento-modelo passado pela mesma lista, como já é com os objetos (next-element.ts). nextOpeningFields e nextWallFields deixam de existir.
- A faixa, o painel lateral e o painel flutuante só desenham essa lista, cada um no seu formato, na mesma ordem e com os mesmos nomes.
- As ações do painel flutuante e do menu do botão direito saem do mesmo registro da faixa (actions.ts), com o mesmo texto, o mesmo ícone e a tecla lida do keymap. A tabela própria de context-menu.ts deixa de existir.
- Uma terceira lista tem de ficar impossível por construção: os painéis recebem a lista do elemento e não têm onde declarar opções próprias.
- Nenhuma opção some: faça o inventário de todas as opções das listas de hoje antes de juntar, e confira que todas estão na lista única (X de Y).

## Passo 4: causa 2, posição explícita
- A abertura guarda a sua posição ao longo da parede. Soltar uma porta não a prende a nada.
- O vínculo com uma vizinha (fromOpening, aligned, inGroup) só existe quando o usuário o cria de propósito, e fica visível na planta.
- settleDimensions, keepOpenings e keepRooms só movem o que tem um vínculo explícito, e o app diz o que moveu.
- Os arquivos salvos com as regras antigas abrem com cada abertura exatamente onde está hoje, pela migração versionada. Diga no relatório o que aconteceu com os vínculos antigos.

## Passo 5: ler tudo e registrar tudo
- Faça o inventário em docs/agent/reading.md, cada arquivo com o número de linhas e [ ] na frente, em grupos:
  - a documentação: CLAUDE.md, .claude/memoria/*, docs/** (com docs/plano-de-escopo.md, docs/pendencias.md, docs/wall-joins-spec.md, os ADRs e as pesquisas), reports/breaks/RELATORIO.md;
  - todo o código de src/;
  - os testes de tests/;
  - a configuração (package.json, tsconfig.json, vite, vitest, index.html, public).

  Ficam de fora só node_modules, dist e os arquivos que não são texto.
- Leia cada arquivo inteiro, em blocos sequenciais (Read com offset e limit) até a última linha. Busca por trechos não substitui a leitura.
- Logo depois de ler cada arquivo, acrescente a docs/agent/findings.md cada problema, com [ ] na frente:
  - arquivo:linha;
  - o que está errado e por quê, com o caminho no código que prova;
  - o que afeta; a categoria; a gravidade (quebra, errado, ruim); a correção certa.

  Marque o arquivo com [x] em reading.md.
- Ache cada problema lendo: siga as chamadas, os imports, os tipos e os dados entre arquivos até a origem, e confira na documentação oficial da versão instalada cada uso de biblioteca que apontar como errado (three, three-bvh-csg, three-mesh-bvh, three-gpu-pathtracer, pdfjs-dist, polyclip-ts, Vite), citando o link.
- Problema é tudo que está errado:
  - o que quebra a aplicação ou corrompe o desenho;
  - o que contradiz a especificação (docs/plano-de-escopo.md, docs/wall-joins-spec.md);
  - cada quebra de reports/breaks/RELATORIO.md e cada item aberto de docs/pendencias.md;
  - estado mudado fora do único lugar que o controla (core/store.ts), ou guardado em dobro;
  - a mesma coisa definida em dois lugares (o padrão da causa 1, em qualquer parte do app);
  - posição ou valor que depende de outra peça sem o usuário saber (o padrão da causa 2);
  - eventos e gestos que deixam a interface num estado inválido;
  - casos não tratados; tolerâncias absolutas que dependem de onde a planta está;
  - erros engolidos; recursos que vazam; trabalho refeito sem mudança;
  - código morto; testes que não testam o que dizem; textos e interface errados.
- No fim da leitura, releia docs/agent/findings.md inteiro e junte o que é a mesma causa. Ordene: primeiro o que quebra ou corrompe, depois o que contradiz a especificação, depois o resto.

## Passo 6: corrigir cada problema na causa
- Um por vez, na ordem.
- Corrija a causa com a lógica real, que funcione para todos os casos válidos. Se a causa é a arquitetura do trecho, refaça o trecho com uma única fonte da verdade e o estado mudando só pelo controlador.
- Fica proibido:
  - esconder o sintoma, engolir erro, fixar valores;
  - pôr caso especial só para o exemplo;
  - desligar ou tirar funcionalidade;
  - apagar ou enfraquecer testes.
- Nada que funciona hoje pode deixar de funcionar.
- Se uma decisão registrada conflitar com a correção (como o flip de parede com a linha de referência na face, em reports/breaks/RELATORIO.md), siga a decisão registrada e diga no relatório.

## Regras deste projeto (em .claude/memoria)
- Não rode suítes de teste (vitest run), mutação (Stryker), fuzz nem processos pesados para achar problema (fix-in-code-verify-in-app). Um script pontual que termine em menos de 30 s pode servir de prova.
- Nunca use heredoc no shell; escreva arquivos com Write ou Edit (no-heredoc).
- No navegador, uma única janela do Playwright, aberta uma vez e reaproveitada: sem abas novas, sem browser_resize, sem browser_navigate enquanto o dono trabalha, sem roubar o foco (no-visible-browser, playwright-occlusion-hang). Teste também com ~880 e ~1280 px de largura (test-window-sizes).
- Decida sozinho o que for de rotina (never-ask-permission).

## Como verificar cada correção
- `npx tsc --noEmit` sem erro, e a saída lida.
- No app, na janela do Playwright, com gestos humanos (mouse em trajeto irregular, pousar, arrastar, soltar, teclado; organic-gestures), num projeto novo em branco, com backup antes do projeto que estiver aberto (scope-plan):
  - o caso que quebrava e os casos vizinhos;
  - depois de cada correção dos passos 3 e 4, e de toda correção que mexa na faixa, nos painéis, nas aberturas, nas cotas ou nos cômodos, o roteiro inteiro do docs/agent/flows.md.
- Tire as capturas, abra, analise e informe onde foram salvas. Desfaça no app o que o teste mudou.
- Só marque o problema com [x] em docs/agent/findings.md depois dessa prova.

## Commit e publicação
- Commite cada correção verificada sozinha, com mensagem em inglês que diga a causa e a correção.
- Ponha no stage só os arquivos dela, com git add por caminho. Confira git diff --cached --name-only antes do commit, e nunca leve .claude/, .playwright-mcp/ nem arquivos de outra sessão.
- Faça push para origin main (commit-push-github).

## Fim
Quando não sobrar nenhum [ ] em findings.md, rode o roteiro inteiro mais uma vez e corrija o que as correções quebraram. Tire do settings o hook Stop da lista (o deny de subagentes e o type check podem ficar).

No fim, informe:
- o que foi lido (arquivos e linhas, X de Y);
- o resultado do roteiro antes e depois, com as capturas;
- as opções juntadas na lista única (X de Y) e o que aconteceu com os vínculos antigos das aberturas;
- os problemas achados, por gravidade;
- o que foi corrigido, com o commit e a captura de cada um;
- o que não foi corrigido e por quê, com a prova no código;
- o que não foi verificado.

Tudo no projeto em inglês (código, comentários, commits, documentação de agente); comigo, em português. Nunca diga que leu, testou, verificou ou corrigiu o que não fez.
