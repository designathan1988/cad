# Prompt: resolver todos os problemas do cad2

Cole o bloco abaixo numa sessão nova aberta na pasta do cad2.

```
Resolva todos os problemas que o cad2 tem, na causa, até não sobrar nenhum, sem quebrar nada. Faça você mesmo, sem subagentes, sem me perguntar nada e sem parar.

A aplicação foi construída com muitos erros que a quebram, e não dá para eu apontar um por um. Achar todos é trabalho seu: leia tudo, ache tudo pelo código, registre tudo enquanto lê e corrija tudo.

## Memória (antes de qualquer coisa)
- O projeto tem uma memória que sobrevive à compactação (CLAUDE.md, seção "Memória que sobrevive à compactação"): docs/agent/orders.md, docs/agent/STATE.md e docs/agent/work.md, reimpressos pelos hooks a cada compactação. Use-a.
- Reescreva o docs/agent/work.md agora, com esta ordem palavra por palavra, o método abaixo e os passos.
- Depois de cada passo, atualize-o: o que leu (arquivos e linhas), o que achou (arquivo:linha), o que mudou, o commit e o próximo passo.
- Mantenha o docs/agent/STATE.md verdadeiro. Commite os dois a cada poucos passos.

## Passo 1: terminar o que está em andamento
- Há mudanças sem commit em src/app/app.ts, src/app/frame.ts, src/render/overlay-3d.ts e src/render/plan-view.ts (veja docs/agent/STATE.md).
- Leia o diff inteiro e entenda o que ele faz.
- Se estiver certo, termine, verifique (passo 5) e commite.
- Se estiver errado ou pela metade de um jeito que não se sustenta, conserte. Não descarte o trabalho sem a prova no código de que ele está errado.

## Passo 2: ler tudo e registrar tudo
- Faça o inventário em docs/agent/reading.md, cada arquivo com o número de linhas e [ ] na frente, em grupos:
  - a documentação: CLAUDE.md, .claude/memoria/*, docs/** (com docs/plano-de-escopo.md, docs/pendencias.md, docs/wall-joins-spec.md, os ADRs e as pesquisas), reports/breaks/RELATORIO.md;
  - todo o código de src/;
  - os testes de tests/;
  - a configuração (package.json, tsconfig.json, vite, vitest, index.html, public).
  Ficam de fora só node_modules, dist e os arquivos que não são texto.
- Leia cada arquivo inteiro, em blocos sequenciais (Read com offset e limit) até a última linha. Não vale dizer que é grande demais ou que não dá para ler tudo; busca por trechos não substitui a leitura.
- Logo depois de ler cada arquivo, acrescente a docs/agent/findings.md cada problema:
  - arquivo:linha;
  - o que está errado e por quê, com o caminho no código que prova;
  - o que afeta; a categoria; a gravidade (quebra, errado, ruim); a correção certa.
  Marque o arquivo com [x].
- Ache cada problema lendo: siga as chamadas, os imports, os tipos e os dados entre arquivos até a origem, e confira na documentação oficial da versão instalada cada uso de biblioteca que apontar como errado (three, three-bvh-csg, three-mesh-bvh, three-gpu-pathtracer, pdfjs-dist, polyclip-ts, Vite), citando o link.
- Problema é tudo que está errado:
  - o que quebra a aplicação ou corrompe o desenho;
  - o que contradiz a especificação (docs/plano-de-escopo.md, docs/wall-joins-spec.md);
  - cada quebra de reports/breaks/RELATORIO.md e cada item aberto de docs/pendencias.md;
  - estado mudado fora do único lugar que o controla (core/store.ts), ou guardado em dobro;
  - eventos e gestos que deixam a interface num estado inválido;
  - casos não tratados; tolerâncias absolutas que dependem de onde a planta está;
  - erros engolidos; recursos que vazam; trabalho refeito sem mudança;
  - código morto; testes que não testam o que dizem; textos e interface errados.
- No fim da leitura, releia docs/agent/findings.md inteiro e junte o que é a mesma causa. Ordene as correções: primeiro o que quebra ou corrompe, depois o que contradiz a especificação, depois o resto.

## Passo 3: corrigir cada problema na causa
- Um por vez, na ordem.
- Corrija a causa com a lógica real, que funcione para todos os casos válidos. Se a causa é a arquitetura do trecho, refaça o trecho do jeito certo, com uma única fonte da verdade e o estado mudando só pelo controlador.
- Fica proibido:
  - esconder o sintoma, engolir erro, fixar valores;
  - pôr caso especial só para o exemplo;
  - desligar funcionalidade, tirar funcionalidade;
  - apagar ou enfraquecer testes.
- Nada que funciona hoje pode deixar de funcionar.
- Se uma decisão registrada conflitar com a correção (como o flip de parede com a linha de referência na face, em reports/breaks/RELATORIO.md), siga a decisão registrada e diga no relatório.

## Passo 4: o que não fazer (regras deste projeto, em .claude/memoria)
- Não rode suítes de teste (vitest run), mutação (Stryker), fuzz nem processos pesados para achar problema (fix-in-code-verify-in-app). Um script pontual que termine em menos de 30 s pode servir de prova.
- Nunca use heredoc no shell; escreva arquivos com Write ou Edit (no-heredoc).
- No navegador, uma única janela do Playwright, aberta uma vez e reaproveitada: sem abas novas, sem browser_resize, sem browser_navigate enquanto o dono trabalha, sem roubar o foco (no-visible-browser, playwright-occlusion-hang).

## Passo 5: verificar cada correção
- npx tsc --noEmit sem erro, rodado sozinho, e a saída lida.
- No app, na janela do Playwright, repita com gestos humanos (mouse em trajeto irregular, pousar, arrastar, soltar, teclado) o caso que quebrava e os casos vizinhos (organic-gestures), num projeto novo em branco, com backup do projeto que estiver aberto antes (scope-plan).
- Tire a captura, abra, analise e informe onde ela foi salva. Desfaça no app o que o teste mudou.
- Só marque o problema como resolvido no docs/agent/findings.md depois dessa prova.

## Passo 6: commitar e publicar
- Commite cada correção verificada sozinha, com mensagem em inglês que diga a causa e a correção.
- Ponha no stage só os arquivos dela, com git add por caminho. Confira git diff --cached --name-only antes do commit, e nunca leve .claude/, .playwright-mcp/ nem arquivos de outra sessão.
- Faça push para origin main (commit-push-github).

## Fim
Repita os passos 3 a 6 até não sobrar nenhum problema aberto no docs/agent/findings.md. Depois, passe de novo por todos os fluxos do app com gestos humanos para achar o que as correções quebraram, e corrija.

No fim, informe:
- o que foi lido (arquivos e linhas, X de Y);
- os problemas achados, por gravidade;
- o que foi corrigido, com o commit e a captura de cada um;
- o que não foi corrigido e por quê, com a prova no código;
- o que não foi verificado.

Tudo no projeto em inglês (código, comentários, commits, documentação de agente); comigo, em português. Nunca diga que leu, testou, verificou ou corrigiu o que não fez.
```
