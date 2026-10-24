# O que falta

Lista viva do que ainda não está feito, com a origem de cada item. Um item sai daqui quando o commit que
o resolve existe e, se for de interface, quando a sessão de teste o viu no navegador.

## Em andamento

- **Tipos de parede com camadas, para ver e editar** (ref/chat.txt:12; revisão do testador, D5 / 17).
  Plano aprovado: comandos de tipo → planta por camada → 3D por camada → diálogo de tipos. O editor
  de camadas deve servir também aos tipos de piso e laje, sem duplicar código.

## Detalhes da revisão do testador (checklist em 3287502)

- Arco selecionado sem cota temporária e sem alça de curvatura; raio, corda e comprimento só leitura;
  com zoom grande a curva mostra os trechos retos.
- Regra "De outra abertura": as cotas temporárias medem das pontas da parede, não até a outra abertura.
- Lista "Alinhada a outra → Com" não diz o pavimento da abertura.
- Nome do cômodo não volta ao centro quando o cômodo muda.
- Depois de recarregar ou abrir um arquivo, a vista volta ao Térreo vazio.
- Distribuir com aberturas dos dois lados de um encontro usa a parede inteira (ADR 0003, "Not done").

## Motor de paredes

- T contra um arco mais largo que um trecho (hoje: aviso `arcJoinUnsupported`).
- X com arco.
- No L na ponta de um arco, canto em miter (ou reta que encosta) que alcança os trechos seguintes:
  ainda avisa (wall-joins-spec.md, parte 6). Nenhum caso real achado até agora.
- Casos com duas juntas que o gerador da suíte de arcos pula (ponta longe sobre o arco, ou passando
  perto da outra ponta).
- Alturas diferentes entre paredes ligadas.
- Faces de corte no 3D.
- Overrides de junta (desligar, butt, miter, corte reto).
- Mutação ≥ 90 %.

## Adendos 2 e 3 (etapas 16 em diante)

- Modo caminhar (ref/chat.txt:203), tour, exportação web, conjunto BIM completo.
- Toque: alvos de 44 px conferidos só pelos tokens; não testado com toque de verdade (ref/chat.txt:244).
- **Lajes e pisos com camadas**, inclinação e furos (ref/chat.txt:87 e 135).
- **Biblioteca de materiais do projeto** (cor, textura, rugosidade, escala), editável e aplicável a
  qualquer elemento ou face (ref/chat.txt:105). Hoje o material de uma camada é só um id.
