# nfE Portfolio

Site ao vivo: **[davirodrigues.dev](https://davirodrigues.dev)**

Portfólio pessoal que se comporta como um **recibo térmico**: botão de ligar, papel rasgado, sombra, inclinação, animação de impressão e som real de impressora. Skills e About me saem como folhas extras por cima do recibo. Sem framework, bundler ou servidor próprio — HTML, CSS e JavaScript, publicados na **Cloudflare Pages**.

## Destaques

- Recibo interativo: typewriter, horário de impressão, papéis de Skills / About me
- Projetos: **NfeKide** (desktop NF-e), coleção on-chain (~400 ETH secondary) e **Code3**
- Ícone em pixel, foto recortada, layout pensado para desktop e celular
- Hospedado em domínio próprio (`davirodrigues.dev`)

## Tecnologias

| Camada        | Escolha |
| ------------- | ------- |
| Marcação      | HTML5 |
| Estilo        | CSS3 — custom properties, flex, media queries, `@keyframes` |
| Comportamento | JavaScript no navegador + Three.js 0.180.0 local, sem bundler |
| Tipo          | Fragment Mono (`.woff2` local) |
| Som           | Gravação real de impressora térmica (`sounds/printer-thermal.mp3`) |
| Deploy        | Cloudflare Pages + Worker (redirect `*.pages.dev` → domínio) |

Arquivos centrais: `index.html`, `style.css`, `printer.css`, `script.js`, `printer-scene.js`, `vendor/three/`, `fonts/`, `images/`, `sounds/printer-thermal.mp3`.

## Impressora 3D e recibo HTML

A abertura usa uma impressora térmica procedural: carcaça com chanfros, tampa, saída, rolo, cabeçote e LED. A câmera é ortográfica, mais frontal no celular. O canvas é decorativo (`aria-hidden`, sem eventos de ponteiro); nenhum texto, projeto ou link do portfólio é desenhado no WebGL.

`script.js` controla uma única máquina de estados: `idle → powering-on` (600 ms) `→ warming-up` (1 s) `→ printing` (6,2 s) `→ completed`. O mesmo relógio sincroniza peças mecânicas, alimentação do HTML e som. Cliques repetidos não criam novas sequências. A rolagem cresce junto com a área impressa; ao concluir, o HTML inteiro volta a aceitar foco e interação. O botão **Skip animation** funciona desde o início da sequência, e a preferência por movimento reduzido abre o conteúdo imediatamente e sem áudio.

`printer-scene.js` projeta os dois extremos da saída 3D para pixels CSS. Esses valores definem a largura e a origem do recibo real. `printer.css` revela a folha de cima para baixo com altura progressiva e `overflow: clip`; o canvas cobre a junção. Resize, orientação, fonte e mudanças de altura recalculam a integração. A inclinação original continua, sem translate/scale temporário no recibo após a impressão. As folhas de Skills e About mantêm sua alimentação pela borda inferior, acima da cena, com fechamento por Escape e retorno do foco ao botão de origem.

### Carregamento e fallback

- O botão HTML e uma impressora estática em CSS aparecem antes do carregamento assíncrono do Three.js. Nenhum pedido de áudio é feito antes da ação do visitante.
- Falha no módulo, em suas dependências, ausência de WebGL2 ou perda de contexto mantém a representação CSS e a impressão HTML. Um prazo de 8 s encerra a espera pelo 3D; iniciar antes de ele estar pronto usa a versão estática durante toda a sequência.
- Falha ou bloqueio do áudio não interrompe o papel. Sem JavaScript, o conteúdo principal aparece diretamente, sem tela de bloqueio.
- Ao ocultar a aba, o relógio e o áudio param; retornar continua a fase existente. O canvas só renderiza durante a sequência e quando seu enquadramento muda. Não existe loop WebGL permanente em `idle` ou `completed`.

### Assets, licença e orçamento

Three.js **0.180.0** é a única dependência de produção. Seus dois módulos ES minificados são mantidos sem alterações em `vendor/three/`, com a [licença MIT original](vendor/three/LICENSE). Origem: distribuição npm `three@0.180.0`, arquivos `build/three.module.min.js`, `build/three.core.min.js` e `LICENSE`, obtidos pelo jsDelivr durante o desenvolvimento. O navegador usa somente as cópias locais; não há dependência de CDN em execução.

A geometria foi criada em código neste repositório. **Modelo baixado: 0 B. Texturas 3D: 0 B.** O som é a gravação [“epson receipt printer5” de azumarill](https://freesound.org/people/azumarill/sounds/345054/), distribuída sob [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). O navegador usa a cópia local; não há pedido externo durante a impressão.

Orçamento: **780 KiB de JavaScript bruto / 190 KiB gzip**, incluindo Three.js e os dois scripts da aplicação; **8 KiB de CSS novo**; **0 B de modelos e texturas 3D**. A medição gzip é uma estimativa local com nível 9, não uma medição de transferência do servidor de produção. Os tamanhos exatos da versão implementada e a validação estão em [tests/PRINTER-VALIDATION.md](tests/PRINTER-VALIDATION.md).

Pixel ratio limitado a **1,5**, ou **1** quando o navegador informa até quatro núcleos ou até 4 GB de memória. Nesse perfil o antialiasing também é desligado. Não há mapas de sombra, pós-processamento ou texturas; a sombra de contato é CSS, com blur menor no celular. Geometria e materiais são alocados ao criar a cena, não no render loop. A câmera frontal e os movimentos pequenos também reduzem a complexidade visual em telas estreitas.

Este repositório também documenta um **estudo comparativo de agentes de IA**. O site foi implementado, quebrado, corrigido e revisado várias vezes, de propósito, para observar como modelos grandes se comportam em pedidos básicos, em estética e em otimização.

---

## Sumário

- [Destaques](#destaques)
- [Tecnologias](#tecnologias)
- [Impressora 3D e recibo HTML](#impressora-3d-e-recibo-html)
- [Estudo com agentes de IA](#estudo-com-agentes-de-ia)
- [Estrutura](#estrutura)
- [Como ver](#como-ver)
- [Créditos](#créditos)

---

## Estudo com agentes de IA

Um ciclo de **implementar → olhar → recusar → pedir de outro jeito → revisar de novo**, passando o mesmo problema por agentes diferentes para aprender onde cada um acerta e onde inventa, em busca o papel de cada um, seus pontos negativos e positivos.

Ambiente principal: **Cursor** (IDE, Modelos, Pair-Programming, Skills). Parte das sessões também passou pelo **Antigravity**, para comparar o mesmo tipo de tarefa fora de um único produto.

### Pedidos básicos para modelos grandes

Uma parte do estudo foi propositalmente **simples**: “deixe responsivo sem mudar o desenho”, “desça o botão um pouco”, “esconda a barra de scroll”, “troque a cor do fundo” isso direcionado a modelos grandes, nesses pedidos, falham por **excesso**. O padrão observado:

- Reescrever o que não foi pedido (passar pelo CSS inteiro para um ajuste de `top`).
- “Melhorar” o visual quando a restrição era congelar o visual.
- Resolver o caso feliz e ignorar o pixel da costura, o overflow em 1100px, o botão coberto pelo papel.
- Entregar uma solução que funciona no desktop e quebra no mobile, ou o contrário.

Apos o projeto é notavel a diferença de caso de uso de cada modelo, no que eles se destacam e nos pontos negativos de cada um, claro que modelos como o Fable/Opus é o minimo estarem na frente pelo custo comparado aos outros agentes, apesar disso se faz necessario o uso pela capacidade tecnica entregue em pedidos com muito pouco contexto. 

### Agentes usados


| Agente          | Onde                    | Papel neste estudo                                                                      |
| --------------- | ----------------------- | --------------------------------------------------------------------------------------- |
| **Fable**       | Cursor (`claude-fable`) | Primeiro lugar em estética; itera CSS no detalhe e segue a direção visual               |
| **Opus**        | Cursor (`claude-opus`)  | À frente em otimização de site; revisão larga (peso, regressão, o que o visual esconde) |
| **Grok**        | Cursor                  | Melhor em criar / replicar estrutura e em edições pequenas pontuais                     |
| **Antigravity** | IDE / agentes Google    | Último no critério geral deste repo; destaque no custo-benefício de tokens              |




### Estética (Anthropic na frente)

Neste projeto, **os modelos Anthropic saíram bem à frente quando o critério era estética**: rasgo do papel, sombra, ritmo da impressão, hierarquia do recibo, varias vezes nesse projeto foi entregue tarefas propositalmente com pouco contexto e mesmo assim foi entregue um resultado muito bom. 

Ordem observada neste site:

1. **Fable**: primeiro lugar. Melhor em obedecer o desenho e em fechar o detalhe visual (rasgo, costura, tipo, papéis).
2. **Opus**: mesma família, mais forte quando o problema deixa de ser “ficar bonito” e passa a ser “ficar leve e correto”.
3. **Grok**: sólido para montar e copiar estrutura (HTML, blocos, pequenos diffs); menos afiado que Fable no julgamento estético fino.
4. **Antigravity**: último neste recorte. Compensa pelo **custo-benefício em tokens**: mais barato para tentar o pedido básico, pior quando o critério é o pixel e a identidade do recibo.



### Otimização de sites

Houve um recorte separado só de **peso e performance** (fonte local vs Google Fonts, `box-shadow` no lugar de `filter` em colunas grandes, timers com a aba oculta, overflow horizontal, sombras e hover no mobile).

Nesse recorte a ordem mudou:

1. **Opus**: na frente. Enxerga custo de GPU, trabalho duplicado e o que não precisa existir.
2. **Fable**: segundo. Entrega otimização sem destruir o visual que ele mesmo ajudou a travar.
3. **Grok**: terceiro. Resolve o pedido (fonte local, `overflow-x`, pausar o relógio), com menos iniciativa de varrer o CSS inteiro atrás de peso.

Antigravity não entrou no pódio deste recorte: útil para o experimento barato, não foi o agente com o qual o peso do site fechou.

### O que estava sendo comparado

Não foi um benchmark oficial de tokens. Foi um caderno de observação em tarefas reais deste site:

1. **Seguir o desenho.** “Não mude o visual, só deixe responsivo”, quem inventava layout novo e quem respeitava a caixa.
2. **CSS de efeito.** Rasgo em `linear-gradient`, sombra que vazava para dentro do papel, costura de 1px na rotação, `drop-shadow` vs `box-shadow`.
3. **Estado e interação.** Abrir / peek / z-index / som só nos papéis / botões clicáveis com a folha aberta.
4. **Prova.** Screenshot, zoom, leitura de pixel, overflow em 320px–1920px ,não “parece ok no meu monitor”."no celular está com problemas".
5. **Peso.** Fonte remota vs local, `will-change`, timers com a aba oculta, hover só com mouse.

### Como a revisão funcionava

```
pedido humano (direção + restrição)
        │
        ▼
agente A implementa
        │
        ▼
 revisão humana
        │
        ├─ falhou o pixel / o som / o mobile? ──► outro agente (B) no mesmo diff
        │
        └─ passou? ──► próximo recorte (Opus, Grok ou Antigravity lê de novo)
```

Três hábitos que o estudo forçou:

- **A direção é humana.** Recibo, papéis que imprimem, som só nas folhas, X sem fundo vermelho, isso não veio de um prompt genérico de “faça um portfólio”.
- **A primeira geração é rascunho.** Sombra invertida, rasgo para o lado errado, rolagem horizontal em 1100px, botão About me coberto pelo papel: cada um desses só apareceu olhando a tela.
- **Trocar de agente onde cada caso é um caso.** O ponto era sentir diferença de obediência à restrição, de cuidado com CSS e de honestidade quando o pedido era ambíguo.



### Conclusão deste estudo

Não é um ranking universal. É o que este portfólio mostrou, neste desenho, nestes pedidos:


| Critério                     | Ordem neste repo                                              |
| ---------------------------- | ------------------------------------------------------------- |
| Estética                     | Anthropic à frente                                            |
| Otimização de sites          | **Opus** → Fable → Grok                                       |
| Estrutura e edições pequenas | **Grok**                                                      |
| Custo-benefício (tokens)     | **Antigravity** (último no geral, melhor preço por tentativa) |


O valor do exercício continua o mesmo: saber pedir de novo e saber recusar. A diferença é que, depois de revisar todos, o resultado não é diferente: Fable para design, Opus para o peso, Grok para o diff pequeno, Antigravity quando o orçamento de tokens manda.

---



## Estrutura

```
nfE-portfolio/
├── index.html
├── style.css
├── script.js
├── printer.css
├── printer-scene.js
├── vendor/three/  # módulos locais e licença MIT
├── tests/        # verificação de comportamento e relatório
├── _worker.js
├── _routes.json
├── fonts/fragment-mono-latin.woff2
├── images/
├── sounds/printer-thermal.mp3
└── README.md
```

---



## Como ver

Ao vivo: [davirodrigues.dev](https://davirodrigues.dev)

Para o 3D, sirva a pasta por HTTP (módulos ES não devem ser abertos via `file://`). Com Python instalado:

```bash
python -m http.server 8765 --bind 127.0.0.1
```

Abra [localhost:8765](http://localhost:8765). Alternativa com Node.js:

```bash
npx live-server --port=5500
```

Não é necessário build. Para a bateria automatizada, use Node.js, Chrome e Playwright como dependência **opcional de desenvolvimento**:

```bash
npm install --no-save --package-lock=false playwright@1.62.1
node tests/printer.cjs
```

O servidor precisa estar rodando na porta 8765. `TEST_URL` altera a URL e `CHROME_PATH` altera o executável (o padrão é o Chrome instalado no Windows). As capturas e o relatório JSON ficam em `_verify/printer/`. A suíte cobre seis viewports, sequência completa, Skip, teclado, folhas, links, seleção, CLS, inatividade da GPU, falhas e preferências de movimento. Nenhum desses recursos de teste é carregado pelo site.

---

## Créditos

Projeto de **Davi Rodrigues**. Estudo e implementação com agentes Fable, Opus, Grok (Cursor) e Antigravity.

Se você **usar, copiar, adaptar ou publicar** este trabalho (o site, o CSS do recibo, o som da impressora, a mecânica dos papéis ou o texto deste estudo), dê crédito de forma visível:

1. Nome: Davi Rodrigues
2. Repositório: [github.com/davizinooo/nfe-portfolio](https://github.com/davizinooo/nfe-portfolio)

Sugestão de atribuição:

`
Baseado em nfe-portfolio, de Davi Rodrigues
https://github.com/davizinooo/nfe-portfolio
`

Uso pessoal / portfólio e material de estudo sobre agentes de IA. Ajuste nome, links, foto e textos antes de republicar como seu.
