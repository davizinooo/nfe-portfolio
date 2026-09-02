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
| Comportamento | JavaScript no navegador, zero dependências |
| Tipo          | Fragment Mono (`.woff2` local) |
| Som           | Efeito de recibo (`sounds/printer.mp3`) |
| Deploy        | Cloudflare Pages + Worker (redirect `*.pages.dev` → domínio) |

Arquivos centrais: `index.html`, `style.css`, `script.js`, `fonts/`, `images/`, `sounds/printer.mp3`.

Este repositório também documenta um **estudo comparativo de agentes de IA**. O site foi implementado, quebrado, corrigido e revisado várias vezes, de propósito, para observar como modelos grandes se comportam em pedidos básicos, em estética e em otimização.

---

## Sumário

- [Destaques](#destaques)
- [Tecnologias](#tecnologias)
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
├── _worker.js
├── _routes.json
├── fonts/fragment-mono-latin.woff2
├── images/
├── sounds/printer.mp3
└── README.md
```

---



## Como ver

Ao vivo: [davirodrigues.dev](https://davirodrigues.dev)

Localmente, abrir `index.html` no navegador, ou:

```bash
npx live-server --port=5500
```

---

Uso pessoal / portfólio e material de estudo sobre agentes de IA. Ajuste nome, links, foto e textos antes de republicar como seu.
