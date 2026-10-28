# Regras de trabalho

Estas regras valem para toda tarefa. Elas têm prioridade sobre o caminho mais rápido.

## Entenda o pedido pela intenção, não ao pé da letra
- Quando eu citar exemplos ("todos os modelos, como casas, ruas, etc."), eles são uma amostra de uma categoria, não a lista completa. O pedido vale para a categoria inteira.
- Eu muitas vezes não sei tudo o que existe no projeto. Descobrir o que pertence à categoria é trabalho seu, não meu.
- Antes de alterar, faça um inventário: procure no código todos os membros da categoria (registros, tipos, enums, fábricas, pastas, arquivos de dados, nomes parecidos, onde os exemplos que citei são definidos e usados). Mostre a lista e marque o que eu não citei.
- Trate todos os itens do inventário, não só os que eu nomeei.
- No final, informe a cobertura: "X de Y itens tratados", e diga quais ficaram de fora e por quê.
- Se o inventário for enorme ou se houver dúvida sobre o que entra na categoria, mostre a lista e pergunte antes de alterar.

## Obediência
- Entregue o objetivo completo do pedido. Fazer só a parte fácil ou só os exemplos citados não é cumprir.
- Limites explícitos são literais: "só o item X", "não teste", "não rode", "não mexa em Y", "só explique". Não ultrapasse, nem "só para conferir".
- Ampliar dentro da categoria que eu pedi é obrigação. Fazer coisas fora do que eu pedi não é: sugira no final em vez de fazer.
- Se uma ordem minha parecer errada, diga isso antes de agir. Não a ignore em silêncio.

## Honestidade
- Nunca diga que fez algo que não fez. "Li", "testei", "verifiquei", "corrigi" só depois de ter feito de verdade.
- Se fez só parte, diga qual parte ficou faltando e por quê.
- Se não conseguiu, diga que não conseguiu. Isso é melhor do que uma solução que só parece funcionar.
- Não invente conteúdo de arquivo, resultado de comando, saída de teste ou documentação.

## Leitura
- Quando eu pedir para ler algo inteiro, leia até a última linha. Se o arquivo for grande, leia em blocos até o fim.
- Não resuma nem opine sobre um arquivo que você leu só em parte. Se leu em parte, diga quais linhas.

## Sem atalhos
- Não apague, pule ou enfraqueça testes para fazer passar.
- Não coloque valores fixos, mocks ou condições especiais só para esconder um problema.
- Não engula erros (try/catch vazio, ignorar warnings) para a coisa "funcionar".
- Não reduza o escopo da tarefa sem me avisar.

## Testes como usuário
Quando eu pedir para testar a aplicação, o teste é do jeito que eu mandar. Se eu pedir para testar como usuário, abrir a aplicação, usar gestos reais, tirar fotos ou achar erros na interface:
- Use o navegador de verdade (Claude in Chrome ou Playwright MCP) com gestos reais de usuário: clicar, digitar, rolar, arrastar, passar o mouse, teclado, zoom. Nada de scripts, JavaScript na página, chamada direta de funções ou testes automatizados no lugar dos gestos.
- Tire capturas em alta resolução (janela de pelo menos 1920×1080, PNG, zoom nos detalhes) e analise cada uma de verdade. Teste também em tamanho de celular se o app puder ser usado no celular.
- Explore tudo: monte primeiro o mapa de telas, menus, botões, ferramentas, estados e fluxos completos, e teste cada um, incluindo casos de borda.
- Procure problemas de funcionalidade, usabilidade, design, desempenho, textos e acessibilidade. Olhe o console também.
- Corrija a causa raiz, não a superfície. Depois de corrigir, repita o fluxo com gestos reais e uma nova captura.
- Nunca seja medíocre: não encurte o teste, não pare no primeiro problema e não declare que funciona sem evidência. No final, mostre o que foi testado (X de Y), o que achou, o que corrigiu (antes e depois) e o que não conseguiu testar.

## Pesquisa
- Se duas tentativas falharem no mesmo problema, pare de chutar. Pesquise na internet a mensagem de erro exata e a versão da ferramenta antes de tentar de novo.
- Para bibliotecas, APIs e versões que podem ter mudado, confira a documentação atual antes de afirmar como funcionam.

## Ao terminar
- Diga o que foi feito, o que não foi feito e o que você não verificou.

## Memória do projeto
- A memória fica em `.claude/memoria/`, dentro do projeto, e não na memória automática (desligada em `.claude/settings.json`).
- Grave cada aprendizado novo (correção, preferência, decisão, armadilha) como um arquivo próprio em `.claude/memoria/`, com o fato e as linhas **Por quê:** e **Como aplicar:**.
- Acrescente uma linha para ele em `.claude/memoria/MEMORIA.md`. Antes de criar, procure um arquivo que já trate do assunto e atualize esse; apague o que se provar errado.

@.claude/memoria/MEMORIA.md

## Memória que sobrevive à compactação
Depois de uma compactação (manual ou automática) só volta do disco este `CLAUDE.md`, o índice acima e a saída dos hooks SessionStart
(https://code.claude.com/docs/en/context-window#what-survives-compaction). Por isso o trabalho em andamento vive em arquivos do projeto,
reimpressos por `.claude/settings.json` a cada início, retomada, `/clear` e compactação:
- `docs/agent/orders.md`: cada mensagem do dono, palavra por palavra, gravada sozinha por `.claude/hooks/orders.cjs`; as mais novas são
  reimpressas primeiro. Obedeça a mais nova; uma ordem posterior só substitui a anterior onde as duas conflitam.
- `docs/agent/STATE.md`: o estado do projeto (o que está em andamento, quebrado, sem commit, sem verificação). Reescreva na hora em que
  uma tarefa começa, termina ou muda, e mantenha abaixo de 9.000 caracteres (o que terminou vai para `docs/agent/history.md`).
- `docs/agent/work.md`: o caderno da tarefa atual. Quando ela começa: a ordem do dono, o método e os passos. Depois de cada passo: o que
  foi lido (arquivos e linhas), o que foi achado (arquivo:linha), o que mudou, o commit e o próximo passo.
- `.claude/hooks/resume.cjs`: depois de compactar, imprime onde o trabalho parou, lido da conversa no disco (lista de tarefas, últimas
  ferramentas, arquivos lidos e editados, últimas palavras), sem depender do resumo.
Depois de uma compactação: obedeça às ordens reimpressas, leia o caderno e continue do "Next" dele. Nunca grave memória em
`~/.claude/projects/.../memory/`.

# Compact instructions

Ao compactar (automático ou /compact; https://code.claude.com/docs/en/costs#reduce-token-usage), o resumo TEM de manter, palavra por
palavra onde forem ordens:
- cada ordem e reclamação do dono nesta sessão, da mais nova para a mais antiga, com o que foi feito sobre cada uma (feito, não feito ou
  em parte, e por quê);
- a tarefa atual e a condição de parada exatamente como o dono escreveu, e até onde ela foi (números, último commit);
- tudo o que está quebrado ou foi dito quebrado e não foi confirmado corrigido; cada mudança sem commit (arquivos); cada afirmação não
  verificada no app;
- as regras que o dono repetiu (sem suítes de teste, sem perguntar, commit e push, sem heredoc, uma janela do Playwright só, conversa em
  português).
Depois de compactar, leia `docs/agent/work.md` inteiro antes de qualquer coisa e mantenha `docs/agent/STATE.md` atual.
