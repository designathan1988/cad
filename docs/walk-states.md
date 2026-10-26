# Modo caminhar e tour: estados e transições

ref/chat.txt:180 pede a máquina de estado do modo caminhar escrita em tabela. Este é o que o código faz
(`src/app/app.ts`: `enterWalk`, `exitWalk`, `setView`, `playTour`, `stopTour`; `src/app/input.ts`: as
teclas). O tour entra porque ele e o caminhar disputam a câmera do 3D.

## Estados

| Estado | O que vale | Câmera |
| --- | --- | --- |
| **Editar** | planta ou 3D, ferramentas, seleção, atalhos de edição | a da vista (órbita no 3D) |
| **Caminhar** | só o 3D; `app.walker` com ponto, pavimento, olhar (yaw, pitch); ferramentas e seleção desligadas | em primeira pessoa, na altura dos olhos, lente de 65° |
| **Tour** | `app.tour` com a parada atual e se toca sozinho; a barra do tour aparece | voa de vista salva em vista salva (1,2 s) |

O caminhar e o tour nunca estão ligados juntos.

## Transições

| De | Evento | Para | O que acontece |
| --- | --- | --- | --- |
| Editar | botão Caminhar, tecla 3, ou "Caminhar daqui" no menu do botão direito | Caminhar | ferramenta volta a Selecionar, seleção limpa, vista 3D, começa no ponto clicado ou no meio do maior cômodo do pavimento; sem cômodo nem parede, fica em Editar e o rodapé diz por quê |
| Caminhar | Esc, tecla 3, ou o botão Caminhar de novo | Editar | a câmera volta à de antes |
| Caminhar | botão Planta ou o botão 3D | Editar | sai do caminhar (a planta não tem caminhar) |
| Caminhar | W A S D ou setas, ou o joystick na tela | Caminhar | anda com colisão (paredes param; vãos de porta passam; desliza ao longo da parede); Shift corre |
| Caminhar | arrastar | Caminhar | olha em volta |
| Caminhar | + e − | Caminhar | olhos mais altos ou mais baixos (0,80 a 2,20 m), guardado nas preferências |
| Caminhar | PageUp, PageDown | Caminhar | pavimento de cima ou de baixo, no mesmo ponto da planta |
| Caminhar | Reproduzir o tour | Tour | o caminhar termina antes |
| Editar | Reproduzir (painel do projeto ou diálogo "Vistas e tour") | Tour | com pelo menos uma vista salva; sem nenhuma, o rodapé diz que não há paradas |
| Tour | → e ←, ou os botões da barra | Tour | próxima ou parada anterior; depois da última, termina |
| Tour | Espaço, ou o botão da barra | Tour | pausa ou continua; tocando, passa sozinho depois do tempo por parada |
| Tour | Esc, ou × da barra | Editar | a câmera fica onde está |
| Tour | botão Caminhar ou "Caminhar daqui" | Caminhar | o tour termina antes (até 2026-10-26 continuava e voava a câmera para a próxima parada no meio da caminhada) |
| Tour | outras teclas | Tour | ignoradas: o tour não edita |
| Caminhar | outras teclas | Caminhar | ignoradas: caminhar não é editar |

Nada disso vai para o documento nem para o desfazer: é estado da interface. As paradas do tour são as
vistas salvas (documento, versão 6+); a altura dos olhos e o tempo por parada ficam nas preferências.
