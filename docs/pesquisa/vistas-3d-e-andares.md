# Vistas 3D, cortes e andares: como as ferramentas de referência fazem e o que o cad2 tem

Pesquisa de 2026-10-25. Marcas: (O) documentação oficial; (F) fórum ou terceiro; (S) só o resumo do
buscador (a página não abriu). O inventário do cad2 foi feito no código em 2026-10-25.

## Já feito a partir desta pesquisa

- Pavimentos no 3D: todos, o em edição e os de baixo, ou só ele (c42c1ae). Como Sweet Home 3D ("Display
  all levels" / "Display selected level", que inclui os de baixo), o Floor Overview do Chief Architect
  (pavimento atual e os de baixo) e o `levelMode` do Pascal Editor (stacked, exploded, solo).
- Explodir: cada pavimento sobe 2,5 m além do de baixo, só na vista (Revit Displace Elements; Autodesk
  APS "vertical explode", que desloca só o Z por pavimento).
- Cortar na altura de corte da planta, com as paredes cortadas preenchidas numa cor só (Revit Coarse
  Poché, Chief Display Poché, Vectorworks em vermelho), a partir das mesmas peças que a planta desenha.

## Padrões que valem copiar (ainda não feitos)

1. Caixa de corte com alças nas faces e quadro para mover/girar (Revit Section Box com setas azuis;
   Vectorworks Clip Cube); "caixa justa na seleção" (Revit BX) e "caixa pela vista da planta" (Revit
   Orient to View).
2. Corte vertical a partir de uma linha na planta (Revit Section; ArchiCAD Section; Snaptrude orienta o
   plano paralelo à parede mais próxima), primeiro como plano de corte no 3D.
3. Preenchimento por camada no corte (Revit em Medium/Fine mostra a estrutura da parede).
4. Underlay de outro pavimento em meio-tom ou outra cor, escolhido (acima ou abaixo), nunca editável
   (Revit Underlay; Chief Reference Display em vermelho; Snaptrude cinza tracejado abaixo, azul acima);
   "esmaecer e encaixar" vs "editar os outros" (Vectorworks Layer Options).
5. Ocultar e isolar temporário, de elemento ou categoria, desfeito num clique (Revit Temporary
   Hide/Isolate); raio-X que ainda deixa encaixar (SketchUp X-ray).
6. Vistas salvas com câmera, pavimentos visíveis, cortes, estilo e sombras (SketchUp Scenes; câmeras do
   Chief com o estado do slider).
7. Paredes presas a pavimentos: topo "pavimento seguinte + offset" (ArchiCAD Home+1; Revit Up to level);
   espessura de laje entre pavimentos para a parede e a laje preencherem o pé-direito sem fresta (Sweet
   Home 3D floor thickness; Space Designer "C"); juntar paredes e lajes para sumir as arestas comuns
   (Revit Join Geometry; prioridades do ArchiCAD).
8. Alinhar paredes entre pavimentos (Chief Architect "Align With Wall Above/Below").
9. Arestas: gerar a face externa contínua entre pavimentos antes de extrair arestas; nunca contornar
   prisma por prisma (senão o topo e a base de cada pavimento viram uma costura).
10. Estilos visuais: arestas, cores uniformes, linhas ocultas, sombras (Revit 5 estilos; SketchUp).

## A linha na fachada entre andares (diagnóstico)

A linha clara na fachada direita da Casa Jardim era um degrau real de 2,5 cm, não um defeito de
desenho: a parede do Térreo tinha 20 cm e a de cima 15 cm, as duas pelo eixo, e sobrava à mostra uma
faixa do topo da parede de baixo, iluminada de cima (a cor da linha, medida, é a da camada de acabamento
×1,11, como o piso horizontal). Na fachada da frente (15 sobre 15, mesmo eixo) não havia linha. A parede
foi devolvida a 15 cm. O que falta para não acontecer de novo: aviso e ação "alinhar com a parede de
baixo" para faces empilhadas desalinhadas, encaixe na face da parede de baixo ao desenhar sobre o
underlay, e arestas finas no 3D.

Outras causas possíveis de costura no código, não vistas: vão entre pavimentos (as cotas são editáveis
em separado e só a sobreposição é avisada); a laje coplanar às faces internas das paredes de baixo
(z-fighting por dentro: os pisos não entram no cálculo de faces visíveis); cantos resolvidos por
pavimento.

## Inventário do cad2 (2026-10-25)

| Recurso | cad2 | Prioridade |
|---|---|---|
| Caixa de corte com alças | Falta | Alta |
| Corte horizontal na altura de corte | Feito (c42c1ae) | — |
| Corte vertical a partir da planta | Falta | Média |
| Preenchimento do corte | Feito, uma cor (c42c1ae); por camada falta | Média |
| Elevações N/S/L/O | Falta (o cubo só posiciona a câmera) | Média |
| Pavimentos: todos / até este / só este | Feito (c42c1ae) | — |
| Explodir pavimentos | Feito (c42c1ae) | — |
| Esmaecer os outros pavimentos | Falta | Média |
| Underlay configurável na planta | Parcial: só o pavimento de baixo, só paredes | Média |
| Ocultar por categoria | Existe (navegador do projeto) | — |
| Ocultar/isolar temporário | Falta | Alta |
| Raio-X | Falta | Média |
| Estilos visuais, arestas | Falta | Alta (arestas) |
| Ortográfica/perspectiva | Falta | Média |
| Vistas salvas | Falta | Média |
| Caminhar | Falta | Baixa |
| Faces coincidentes escondidas | Existe (entre paredes) | — |
| Aviso de faces empilhadas desalinhadas | Falta | Alta |
| Topo "até o pavimento X" | Falta | Média |
| Laje até a fachada; pisos no cálculo de faces | Parcial | Média |

## Fontes

Revit:
- (O) https://help.autodesk.com/cloudhelp/2017/ENU/Revit-DocumentPresent/files/GUID-BC219BE7-2917-47A8-9596-71C6C01659CF.htm
- (O) https://help.autodesk.com/cloudhelp/2026/ENU/Revit-DocumentPresent/files/GUID-7A68686B-2DA4-4ED0-AEF5-6BFBCDA93C89.htm
- (O) https://help.autodesk.com/cloudhelp/2018/ENU/Revit-DocumentPresent/files/GUID-C122C08D-74F1-4249-B171-F8504998739E.htm
- (O) https://help.autodesk.com/cloudhelp/2023/ENU/Revit-DocumentPresent/files/GUID-03F6C3B2-E930-4168-8BAC-E6B8A62D9CA8.htm
- (F) https://blog.hagerman.com/2015/07/21/revit-2016-selection-box/
- (O) https://help.autodesk.com/cloudhelp/2023/ENU/Revit-DocumentPresent/files/GUID-1423DE8C-8686-4D17-8B99-BF876F522915.htm
- (O) https://help.autodesk.com/cloudhelp/2021/ENU/Revit-DocumentPresent/files/GUID-361CD6B7-38FA-47B3-86AA-ECF8BD0F8F40.htm
- (O) https://help.autodesk.com/cloudhelp/2023/ENU/Revit-DocumentPresent/files/GUID-A5E51D5E-8E18-4834-8A2F-8B4E3E6379A1.htm
- (O) https://help.autodesk.com/cloudhelp/2023/ENU/Revit-DocumentPresent/files/GUID-12C2D6B0-71ED-490E-9CC6-AD3C635F092B.htm
- (O) https://help.autodesk.com/cloudhelp/2023/ENU/RevitLT-DocumentPresent/files/GUID-58711292-AB78-4C8F-BAA1-0855DDB518BF.htm
- (O) https://help.autodesk.com/cloudhelp/2023/ENU/Revit-DocumentPresent/files/GUID-77184183-E245-4F3B-8486-617E9A9FB296.htm
- (O) https://help.autodesk.com/cloudhelp/2023/ENU/Revit-DocumentPresent/files/GUID-F03617DC-541D-49CF-B40C-B2537175F561.htm
- (O) https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-D69E6B7D-8D8D-40E4-A6D4-7CAF1A927894.htm
- (S) https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-ED60CE62-B955-45E9-9D7D-00F1552D858C.htm
- (O) https://help.autodesk.com/cloudhelp/2023/ENU/Revit-Model/files/GUID-F3D6884F-F1E3-471B-81FB-ECE93D9C2671.htm
- (F) https://www.cad-notes.com/creating-floors/
- (S) https://help.autodesk.com/cloudhelp/2023/ENU/Revit-DocumentPresent/files/GUID-0B7C5662-43EE-4E96-9140-CB346AF6ED5F.htm
- (S) https://help.autodesk.com/cloudhelp/2018/ENU/Revit-DocumentPresent/files/GUID-D7EE0034-87CA-41C2-8B49-187395D77E0B.htm

ArchiCAD:
- (O) https://help.graphisoft.com/AC/28/INT/_AC28_Help/140_UserInterfaceDialogBoxes/140_UserInterfaceDialogBoxes-45.htm
- (O) https://help.graphisoft.com/AC/24/INT/_AC24_Help/050_ViewsVB/050_ViewsVB-23.htm
- (O) https://help.graphisoft.com/AC/23/INT/_AC23_Help/050_ViewsVB/050_ViewsVB-26.htm
- (O) https://help.graphisoft.com/AC/23/INT/_AC23_Help/050_ViewsVB/050_ViewsVB-18.htm
- (O) https://help.graphisoft.com/AC/28/INT/_AC28_Help/030_Interaction/030_Interaction-34.htm
- (F) https://community.graphisoft.com/t5/Modeling/Issue-Hide-Selection-in-3D/td-p/322417
- (S) https://community.graphisoft.com/t5/Visualization/Create-exploded-diagrams-in-Archicad/ta-p/691828
- (F) https://community.graphisoft.com/t5/Visualization/Exploded-axo-view/m-p/394492
- (O) https://help.graphisoft.com/AC/28/INT/_AC28_Help/030_Interaction/030_Interaction-103.htm
- (F) https://community.graphisoft.com/t5/Documentation/Trace-amp-Reference-not-lining-up/m-p/334446
- (S) https://help.graphisoft.com/AC/23/INT/_AC23_Help/050_ViewsVB/050_ViewsVB-11.htm
- (O) https://help.graphisoft.com/AC/23/INT/_AC23_Help/040_ElementsVB/040_ElementsVB-5.htm
- (O) https://help.graphisoft.com/AC/28/INT/_AC28_Help/040_ElementsVB/040_ElementsVB-271.htm
- (S) https://help.graphisoft.com/AC/29/INT/_AC29_Help/140_UserInterfaceDialogBoxes/140_UserInterfaceDialogBoxes-33.htm
- (S) https://help.graphisoft.com/AC/28/INT/_AC28_Help/140_UserInterfaceDialogBoxes/140_UserInterfaceDialogBoxes-46.htm
- (S) https://helpcenter.graphisoft.com/?p=76021
- (S) https://help.graphisoft.com/AC/29/INT/_AC29_Help/050_ViewsVB/050_ViewsVB-33.htm
- (S) https://help.graphisoft.com/AC/30/INT/Topics/025_Attributes/025_Attributes-6.html

SketchUp:
- (O) https://help.sketchup.com/en/sketchup/slicing-model-peer-inside
- (O) https://help.sketchup.com/en/sketchup/creating-scenes
- (O) https://help.sketchup.com/en/face-style
- (O) https://help.sketchup.com/en/sketchup/controlling-visibility-tags
- (S) https://help.sketchup.com/en/sketchup-viewer/viewing-model-sketchup-desktop-viewer
- (F) https://forums.sketchup.com/t/when-i-double-click-on-a-group-the-rest-of-my-model-disappears/205418
- (F) https://forums.sketchup.com/t/sketchup-free-capability/177961

Chief Architect / Home Designer:
- (O) https://chiefarchitect.com/support/article/KB-00066/clipping-cross-section-elevation-views.html
- (O) https://www.chiefarchitect.com/support/article/KB-00631/using-the-cross-section-slider.html
- (F) https://chieftalk.chiefarchitect.com/topic/36586-showing-different-floors-in-3d-in-x10
- (O) https://chiefarchitect.com/support/article/KB-00475
- (O) https://www.chiefarchitect.com/support/article/KB-00332/aligning-walls-between-floors-in-chief-architect.html
- (O) https://www.homedesignersoftware.com/support/article/KB-00140/controlling-floor-and-ceiling-heights.pdf
- (O) https://www.homedesignersoftware.com/support/article/KB-00221/understanding-wall-heights-in-a-doll-house-view.html
- (O) https://www.chiefarchitect.com/support/article/KB-00579/changing-the-height-of-walls.html
- (O) https://www.chiefarchitect.com/products/3d-viewer/help/camera-views.html
- (F) https://chieftalk.chiefarchitect.com/topic/10309-rendering-techniques-benefits/

Sweet Home 3D:
- (O) https://www.sweethome3d.com/userGuide.jsp
- (F) https://www.sweethome3d.com/support/forum/printpost_post,61891
- (F) https://www.sweethome3d.com/support/forum/viewthread_thread,2818
- (S) https://sweethome3d.com/support/forum/viewthread_thread,10781

Vectorworks:
- (O) https://app-help.vectorworks.net/2024/eng/VW2024_Guide/Views/Viewing_a_model_with_the_clip_cube.htm
- (O) https://app-help.vectorworks.net/2022/eng/VW2022_Guide/Basic2/Setting%20global_visibility_with_class_and_design_layer_options.htm
- (O) https://app-help.vectorworks.net/2021/eng/VW2021_Guide/Views/Unified_layer_view.htm
- (O) https://app-help.vectorworks.net/2024/eng/VW2024_Guide/Floors_slabs/..%5CStructure%5CConcept_Stories_and_story-aware_objects.htm
- (S) https://app-help.vectorworks.net/2016/eng/VW2016_Guide/Walls_edit/Editing_Walls.htm

Planejadores web e motores:
- (O) https://support.planner5d.com/en/articles/16475679-how-to-create-a-new-floor
- (O) https://planoplan.com/en/help-center/documentation/2d-work/floors/
- (F) https://www.homestyler.com/forum/view/1518839334753980418
- (O) https://pro.houzz.com/pro-help/r/how-to-add-multiple-floors-in-3d-floor-planner
- (O) https://www.spacedesigner3d.com/resources/help/floors-and-stairwells
- (O) https://intercom.help/arcol/en/articles/10447921-buildings-and-floor-plans
- (S) https://www.apkmirror.com/?p=4935045
- (O) https://www.snaptrude.com/blog/configure-storey-visibility-plan-views
- (S) https://help.snaptrude.com/en/articles/9059650-create-section-views
- (S) https://help.snaptrude.com/en/articles/9053976-managing-storeys-on-snaptrude
- (O) https://cdn.jsdelivr.net/gh/pascalorg/editor@main/README.md
- (O) https://mintlify.wiki/pascalorg/editor/api/viewer/viewer-store
- (O) https://aps.autodesk.com/blog/view-each-floor-using-vertical-explode
- (O) https://xeokit.io/blog/creating-storey-plan-views
- (O) https://xeokit.io/blog/hatching-sliced-objects-using-xeokit-sdk

Renderização:
- (O) https://threejs.org/docs/pages/EdgesGeometry.html
- (O) https://threejs.org/docs/pages/Material.html
- (O) https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/webgl_clipping_stencil.html
- (F) https://discourse.threejs.org/t/clipping-plane-stencil-capping/74018
- (O) https://learnopengl.com/Advanced-OpenGL/Depth-testing
- (S) https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/polygonOffset

Não confirmados: como Floorplanner, HomeByMe e Arcol mostram os pavimentos no 3D; os interruptores de
pavimento do Planner 5D no 3D; como o Chief Architect leva a parede através da plataforma de piso; se o
Revit tem um interruptor de sombras separado.
