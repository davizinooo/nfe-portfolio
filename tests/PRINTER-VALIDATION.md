# Validação da impressora — 10/09/2026

Ambiente: Windows, Chrome 152.0.7977.83 headless, Playwright 1.62.1, servidor HTTP local. A suíte reproduzível é `tests/printer.cjs`; instruções no README. Capturas e resultados de execução ficam em `_verify/printer/` (ignorados pelo Git).

## Resultado

19 cenários automatizados aprovados. A sequência inteira foi executada em **320×568, 375×812, 768×1024, 1024×768, 1440×900 e 2560×1080**. Em cada resolução foram verificados:

- Ordem dos cinco estados e resistência a clique repetido.
- Ausência de áudio antes de interação, crescimento monotônico da área de papel e liberação do HTML ao concluir.
- Navegação por teclado: iniciar, abrir Skills e About, fechar com Escape e retornar ao botão de origem.
- Hit testing e clique de todos os links do recibo, com navegação externa interceptada no teste; seleção do texto real do título.
- Ausência de overflow horizontal e de erros de console no fluxo normal.
- Nenhuma nova chamada WebGL `drawElements`/`drawArrays` durante amostras de inatividade antes e após imprimir.
- Capturas do estado desligado, impressão, conclusão e de cada folha aberta.

Outros cenários: WebGL indisponível; módulo da cena ausente; dependência Three.js ausente; áudio bloqueado; áudio ausente; Skip em cada fase ativa; movimento reduzido; mudança de orientação durante a impressão; pausa/retomada de visibilidade simulada; perda real de contexto via `WEBGL_lose_context`; carregamento 3D pendente; JavaScript desabilitado.

**CLS observado: aproximadamente 0,00006–0,003**, medido com `PerformanceObserver`, excluindo deslocamentos associados a interação recente. Não é um resultado de campo nem um Lighthouse de produção. O crescimento intencional do papel não desloca seu conteúdo já revelado.

Verificação adicional em DPR 3 com hardware simulado de dois núcleos / 2 GB: canvas de 375 pixels físicos para 375 pixels CSS e antialiasing desligado. Inspeção visual incluiu o rodapé, rasgo inferior, código de barras e texto após a animação. Os transforms temporários de alimentação não persistem; a inclinação e o ajuste de cabeçalho existentes foram preservados.

## Orçamento medido

| Recurso | Bytes brutos | Bytes gzip (nível 9) |
| --- | ---: | ---: |
| `vendor/three/three.core.min.js` | 381.124 | 100.908 |
| `vendor/three/three.module.min.js` | 338.908 | 79.147 |
| `script.js` | 14.120 | 4.022 |
| `printer-scene.js` | 7.463 | 2.600 |
| **JavaScript total** | **741.615 (724,2 KiB)** | **186.677 (182,3 KiB)** |
| `printer.css` | 5.904 | 1.959 |
| Modelos / texturas 3D | 0 | 0 |
| Som de impressora térmica (CC0) | 173.679 | — |

Dentro do teto de **780 KiB bruto / 190 KiB gzip para JavaScript**, **8 KiB para CSS novo** e **zero modelos/texturas**. Esses números não incluem as imagens, fontes e o CSS do portfólio preexistente. Compressão de transferência depende do servidor. Não foi adicionado bundler, framework ou dependência de CDN em execução.

## Escopo e limites

- Diff inspecionado contra os arquivos de trabalho iniciais, que já tinham alterações locais. Textos, projetos, URLs e lógica das folhas anteriores preservados. Nenhum commit ou deploy.
- A perda do WebGL durante a impressão muda o enquadramento para a representação CSS e recalcula a saída; o conteúdo continua disponível.
- Ausência de GLB é intencional: falha de asset 3D foi exercitada bloqueando o módulo da cena e os módulos vendorizados.
- Telas de celular/tablet e hardware fraco foram emulados. Não houve teste em aparelhos físicos, Safari, Firefox ou leitor de tela real. Semântica, `inert`, anúncios de status e foco foram verificados no DOM e por teclado; confirmação auditiva com leitores de tela continua sendo uma verificação manual recomendada.
- O teste de links confirma interação e destino preservados, não disponibilidade dos sites externos. A sincronização do áudio foi verificada pelo comportamento do navegador, sem avaliação auditiva em alto-falantes físicos.
