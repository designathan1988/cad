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
