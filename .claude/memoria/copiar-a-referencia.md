# Copiar a referência elemento por elemento

Quando o dono manda uma imagem de outro software ("uma assim"), a forma dela é o pedido: olhar a imagem de perto e copiar cada traço (formato das abas, largura, como a aba aberta se liga à faixa, tamanho e cor dos ícones, campos embutidos), não fazer uma "versão moderna" parecida.

**Por quê:** ele pediu o painel de abas do 3ds Max R3 e eu fiz abas de texto sublinhadas, estilo web, com ícones pequenos e monocromáticos; ele respondeu que aquilo não era nem abas nem ribbon (2026-10-28).

**Como aplicar:** antes de desenhar, abrir a imagem com Read e listar o que ela mostra (ex.: abas de pasta de largura igual por toda a barra, aba ativa unida à faixa de ícones, ícones de ~22 px coloridos, listas suspensas no meio dos ícones). Implementar essa lista e dizer no relatório o que foi copiado de cada traço.

Copiar a ESTRUTURA da referência, nunca o estilo visual dela: ícones, cores, tamanhos e espaçamentos seguem o resto da interface. Ícones coloridos e de 22 px copiados do Max quebraram a consistência (o dono reclamou, 2026-10-28). O padrão do protótipo: ícone 16 px monocromático (#b4b9c2), botão 24 px, campo 22 px, texto 11 px, separador 1×14 px; antes de publicar, procurar no arquivo qualquer tamanho fora disso.

Esconder uma parte do layout: antes de publicar, conferir quem é o pai dela. A janela do protótipo é um grid de linhas fixas (título, faixa, desenho, status); tirar um filho do grid com sc-if desloca todos os outros de linha. Sempre deixar um contêiner fixo no lugar e esconder só o que está dentro (quebrou assim em 2026-10-28, sem eu ver).
