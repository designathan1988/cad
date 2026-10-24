# ADR 0002: padrões da paleta, do menu de contexto, do tour e das áreas de toque

Data: 2026-10-24. Pedido: ref/chat.txt:249 ("antes de implementar, pesquise referências atuais").

## Fontes lidas

- W3C ARIA Authoring Practices, Combobox: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
- W3C ARIA Authoring Practices, Menu e Menubar: https://www.w3.org/WAI/ARIA/apg/patterns/menubar/
- WCAG 2.2, 2.5.5 Target Size (Enhanced): https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
- Manual do Blender, Menu Search e Operator Search (F3): https://docs.blender.org/manual/en/2.90/interface/controls/templates/operator_search.html
- Guia de onboarding acessível: https://ezud.com/accessible-onboarding-tutorials/
- Diálogos modais acessíveis: https://clearleft.com/thinking/accessibility-in-modal-dialogs

## Decisões

**Paleta (Ctrl+K).** É um diálogo modal com um campo `role="combobox"` e uma lista `role="listbox"`.
- O foco fica sempre no campo.
- A opção ativa é indicada por `aria-activedescendant`.
- Setas mudam a opção, Enter executa, Esc fecha e devolve o foco a quem abriu.
- Como no F3 do Blender, cada resultado mostra onde o comando mora (o grupo) e o atalho atual.
- A busca vai além das ferramentas: inclui ações, vistas, configurações e pavimentos.

**Menu de contexto.** É um `role="menu"` com itens `role="menuitem"`.
- Ao abrir, o foco vai ao primeiro item.
- Setas andam em volta pela lista; Home e End vão às pontas.
- Enter ou Espaço executam.
- Esc fecha e devolve o foco ao canvas; Tab também fecha.
- Uma letra digitada leva ao próximo item que começa com ela.
- Itens desativados recebem foco, mas não executam.

**Tour.** É um diálogo não modal, porque a página continua visível e destacada.
- A cada passo, o foco vai para o cartão, e Tab circula só dentro dele.
- Esc pula o tour, e há um botão visível "Pular".
- Cada passo descreve o alvo em palavras (onde fica, o que faz), sem depender do destaque visual.
- Uma região `aria-live` anuncia "passo X de 4".

**Áreas de clique.**
- 32 px na interface com mouse.
- Com `@media (pointer: coarse)`, alvos de 44 × 44 px, como pede a WCAG 2.5.5.
